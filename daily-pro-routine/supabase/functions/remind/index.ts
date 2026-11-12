// Repline reminders: called every 5 minutes by pg_cron (see 004_gifts_reminders.sql).
// Sends the daily training reminder and the "streak in danger" alert as a Discord DM from the Repline bot
// and/or as a web push to the browser/iPhone. It only sends what is due and remembers what it sent,
// so calling it more often does no harm.
//
// Secrets (Supabase → Edge Functions → Secrets): DISCORD_BOT_TOKEN, VAPID_PUBLIC, VAPID_PRIVATE.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const SITE = "https://repline.pages.dev";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BOT = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const VPUB = Deno.env.get("VAPID_PUBLIC") || "", VPRIV = Deno.env.get("VAPID_PRIVATE") || "";
if (VPUB && VPRIV) webpush.setVapidDetails("https://repline.pages.dev", VPUB, VPRIV);

type Rem = {
  user_id: string; enabled: boolean; at_time: string; days: number[]; tz: string; skip_if_trained: boolean; danger: boolean;
  via_discord: boolean; via_push: boolean; push_sub: unknown; last_sent: string | null; last_danger: string | null;
};

function localNow(tz: string) {
  let zone = tz;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: zone }); } catch { zone = "Europe/Berlin"; }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday) + 1;
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const y = new Date(`${date}T12:00:00Z`); y.setUTCDate(y.getUTCDate() - 1);
  return { date, yesterday: y.toISOString().slice(0, 10), dow, mins: Number(parts.hour) * 60 + Number(parts.minute) };
}
const toMins = (t: string) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };

async function discordDM(discordId: string, content: string) {
  if (!BOT || !discordId) return false;
  const h = { Authorization: `Bot ${BOT}`, "Content-Type": "application/json" };
  const ch = await fetch("https://discord.com/api/v10/users/@me/channels", { method: "POST", headers: h, body: JSON.stringify({ recipient_id: discordId }) });
  if (!ch.ok) return false;
  const { id } = await ch.json();
  const r = await fetch(`https://discord.com/api/v10/channels/${id}/messages`, { method: "POST", headers: h, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) });
  return r.ok;
}
async function push(sub: unknown, title: string, body: string) {
  if (!sub || !VPUB || !VPRIV) return false;
  try { await webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify({ title, body, url: SITE })); return true; }
  catch (e) { if ((e as { statusCode?: number }).statusCode === 410) return "gone"; return false; }
}

Deno.serve(async () => {
  const { data: rems, error } = await db.from("reminders").select("*").eq("enabled", true).or("via_discord.eq.true,via_push.eq.true");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  let sent = 0;
  for (const r of (rems || []) as Rem[]) {
    const now = localNow(r.tz || "Europe/Berlin");
    const at = toMins(r.at_time || "18:00");
    const dueReminder = (r.days || []).includes(now.dow) && now.mins >= at && now.mins < at + 180 && r.last_sent !== now.date;
    const dueDanger = r.danger && now.mins >= 21 * 60 && now.mins < 23 * 60 + 30 && r.last_danger !== now.date;
    if (!dueReminder && !dueDanger) continue;

    const [{ data: days }, { data: prof }, { data: state }] = await Promise.all([
      db.from("training_days").select("day, routines, minutes, streak, frozen").eq("user_id", r.user_id).in("day", [now.date, now.yesterday]),
      db.from("profiles").select("discord_id").eq("id", r.user_id).maybeSingle(),
      db.from("user_state").select("settings").eq("user_id", r.user_id).maybeSingle()
    ]);
    const today = (days || []).find((d) => d.day === now.date), yday = (days || []).find((d) => d.day === now.yesterday);
    const trained = !!(today && (today.routines > 0 || today.minutes > 0));
    const done = !!(today && today.routines > 0);
    const streak = Math.max(yday ? (yday.streak || (yday.routines > 0 || yday.frozen ? 1 : 0)) : 0, today ? today.streak || 0 : 0);
    const freezes = Number((state?.settings as { freezes?: number } | null)?.freezes || 0);

    const send = async (title: string, body: string) => {
      let ok = false;
      if (r.via_discord && prof?.discord_id) ok = (await discordDM(prof.discord_id, `**${title}**\n${body}\n${SITE}`)) || ok;
      if (r.via_push && r.push_sub) {
        const p = await push(r.push_sub, title, body);
        if (p === "gone") await db.from("reminders").update({ via_push: false, push_sub: null }).eq("user_id", r.user_id);
        ok = p === true || ok;
      }
      if (ok) sent++;
    };

    if (dueReminder) {
      if (!(r.skip_if_trained && trained)) {
        await send("Time for your routine", streak > 0 ? `Day ${streak + 1} is waiting. One routine keeps your streak alive.` : "One routine today. Day 1 starts now.");
      }
      await db.from("reminders").update({ last_sent: now.date }).eq("user_id", r.user_id);
    }
    if (dueDanger) {
      if (!done && streak > 0 && freezes === 0) {
        await send("Your streak is in danger", `Your ${streak}-day streak ends at midnight. One routine keeps it alive.`);
      }
      await db.from("reminders").update({ last_danger: now.date }).eq("user_id", r.user_id);
    }
  }
  return new Response(JSON.stringify({ checked: rems?.length || 0, sent }), { headers: { "Content-Type": "application/json" } });
});
