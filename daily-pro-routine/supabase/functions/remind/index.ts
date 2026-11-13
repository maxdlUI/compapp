// Repline reminders: called every 5 minutes by pg_cron (see 004_gifts_reminders.sql).
// Also sends a DM for every gifted plan (see sendGiftDMs) and posts wheel wins in #drops (see postDrops).
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
let pushReady = false;
try { if (VPUB && VPRIV) { webpush.setVapidDetails("https://repline.pages.dev", VPUB, VPRIV); pushReady = true; } } catch { pushReady = false; }

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

async function discordDM(discordId: string, content: string, embed?: Record<string, unknown>) {
  if (!BOT || !discordId) return false;
  const h = { Authorization: `Bot ${BOT}`, "Content-Type": "application/json" };
  const ch = await fetch("https://discord.com/api/v10/users/@me/channels", { method: "POST", headers: h, body: JSON.stringify({ recipient_id: discordId }) });
  if (!ch.ok) return false;
  const { id } = await ch.json();
  const msg: Record<string, unknown> = { content, allowed_mentions: { parse: [] } };
  if (embed) msg.embeds = [embed];
  const r = await fetch(`https://discord.com/api/v10/channels/${id}/messages`, { method: "POST", headers: h, body: JSON.stringify(msg) });
  return r.ok;
}

// Gifted plans: a DM from the Repline bot right after a dev gifts a plan (dev_gift calls this function at once;
// the 5-minute cron catches anything missed). Each gift is claimed first, so it is never sent twice.
const PLAN_NAME: Record<string, string> = { standard: "Standard", pro: "Pro" };
async function sendGiftDMs() {
  const since = new Date(Date.now() - 2 * 86400000).toISOString();
  const { data: gifts } = await db.from("notices").select("id, user_id, payload").eq("kind", "gift").is("dm_at", null).gte("created_at", since).limit(50);
  let sent = 0;
  for (const g of gifts || []) {
    const { data: claimed } = await db.from("notices").update({ dm_at: new Date().toISOString() }).eq("id", g.id).is("dm_at", null).select("id");
    if (!claimed || !claimed.length) continue;
    const { data: prof } = await db.from("profiles").select("discord_id, bonus_until").eq("id", g.user_id).maybeSingle();
    if (!prof?.discord_id) continue;
    const p = (g.payload || {}) as { plan?: string; months?: number; from?: string; note?: string };
    const plan = PLAN_NAME[p.plan || ""] || "a plan", months = Number(p.months || 1);
    const until = prof.bonus_until ? new Date(prof.bonus_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }) : "";
    const lines = [
      `You got **Repline ${plan}** for **${months} ${months === 1 ? "month" : "months"}**${p.from ? `, a gift from **${p.from}**` : ""}. It's already active.`,
      p.note ? `> ${String(p.note).replace(/\n/g, " ")}` : "",
      until ? `Active until **${until}**.` : "",
      `Open Repline and sign in with Discord to use it.`
    ].filter(Boolean);
    const ok = await discordDM(prof.discord_id, "", {
      title: `🎁 You got Repline ${plan}!`, description: lines.join("\n\n"), url: SITE, color: 0xa855f7,
      footer: { text: "Repline · repline.pages.dev" }
    });
    if (ok) sent++;
  }
  return sent;
}
// Wheel wins (item or better) and the monthly jackpot, posted in #drops with a ping. Claimed first, posted once.
const DROPS_CHANNEL = "1570793070125908108";
const DROP_COLOR: Record<string, number> = { item: 0x3f8dff, pro3d: 0xa855f7, pro1m: 0xff4fa3, prolife: 0xffcf4a };
const DROP_ODDS: Record<string, string> = { item: "14 % chance", pro3d: "5 % chance", pro1m: "about 1 in 100", prolife: "1 in 50,000" };
async function channelPost(content: string, embed: Record<string, unknown>, ping: string) {
  if (!BOT) return false;
  const r = await fetch(`https://discord.com/api/v10/channels/${DROPS_CHANNEL}/messages`, {
    method: "POST", headers: { Authorization: `Bot ${BOT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content, embeds: [embed], allowed_mentions: { users: ping ? [ping] : [] } })
  });
  return r.ok;
}
async function postDrops() {
  const since = new Date(Date.now() - 2 * 86400000).toISOString();
  const { data: rows } = await db.from("drops").select("id, user_id, prize, item").in("prize", ["item", "pro3d", "pro1m", "prolife"]).is("posted_at", null).gte("created_at", since).order("id").limit(30);
  let n = 0;
  for (const d of rows || []) {
    const { data: claimed } = await db.from("drops").update({ posted_at: new Date().toISOString() }).eq("id", d.id).is("posted_at", null).select("id");
    if (!claimed || !claimed.length) continue;
    const [{ data: prof }, { data: it }] = await Promise.all([
      db.from("profiles").select("discord_id, username").eq("id", d.user_id).maybeSingle(),
      d.item ? db.from("drop_items").select("name").eq("id", d.item).maybeSingle() : Promise.resolve({ data: null })
    ]);
    const who = prof?.discord_id ? `<@${prof.discord_id}>` : `**${prof?.username || "Someone"}**`;
    const what = d.prize === "item" ? (it?.name || "a new item") : d.prize === "pro3d" ? "3 days Pro" : d.prize === "pro1m" ? "1 month Pro" : "PRO FOREVER";
    const head = d.prize === "prolife" ? "🚨🚨 GOLDEN SPIN 🚨🚨 " : d.prize === "pro1m" ? "🔥 " : d.prize === "pro3d" ? "⚡ " : "✨ ";
    const ok = await channelPost(`${head}${who} won **${what}**!`, {
      title: what, color: DROP_COLOR[d.prize] || 0x38e0ff, url: SITE,
      description: `${DROP_ODDS[d.prize] || ""}. Finish a routine and spin for yours on Repline.`,
      footer: { text: "Repline Drops · repline.pages.dev" }
    }, prof?.discord_id || "");
    if (ok) n++;
  }
  const { data: jps } = await db.from("jackpots").select("month, user_id, tickets").is("posted_at", null).limit(3);
  for (const j of jps || []) {
    const { data: claimed } = await db.from("jackpots").update({ posted_at: new Date().toISOString() }).eq("month", j.month).is("posted_at", null).select("month");
    if (!claimed || !claimed.length || !j.user_id) continue;
    const { data: prof } = await db.from("profiles").select("discord_id, username").eq("id", j.user_id).maybeSingle();
    const who = prof?.discord_id ? `<@${prof.discord_id}>` : `**${prof?.username || "Someone"}**`;
    const monthName = new Date(`${j.month}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (await channelPost(`🎟️ Golden Ticket draw for ${monthName}: ${who} wins **1 year of Pro**!`, {
      title: "Monthly jackpot · 1 year Pro", color: 0xffcf4a, url: SITE,
      description: `Drawn from ${j.tickets} tickets. Every spin is a ticket. Next draw on the 1st.`,
      footer: { text: "Repline Drops · repline.pages.dev" }
    }, prof?.discord_id || "")) n++;
  }
  return n;
}
async function push(sub: unknown, title: string, body: string) {
  if (!sub || !pushReady) return false;
  try { await webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify({ title, body, url: SITE })); return true; }
  catch (e) { if ((e as { statusCode?: number }).statusCode === 410) return "gone"; return false; }
}

// The public VAPID key the website uses (index.html). A health check compares it, never prints a secret.
const SITE_VAPID = "BL1_JnQ__0aDN0r83IBLweagLTxyyuCOhgzkmLzJ6Pwn0lGatksVYpFH6308HecpEa-syIeqTYS2pmT-Y6ryTVM";

Deno.serve(async (req) => {
  let body: { check?: boolean } = {};
  try { body = await req.json(); } catch { /* cron sends {} */ }
  if (body.check) {
    let vapidValid = false;
    try { webpush.getVapidHeaders("https://fcm.googleapis.com", "https://repline.pages.dev", VPUB, VPRIV, "aes128gcm"); vapidValid = true; } catch { vapidValid = false; }
    return new Response(JSON.stringify({ discordToken: !!BOT, vapidPublic: !!VPUB, vapidPrivate: !!VPRIV, vapidValid, vapidMatchesSite: VPUB === SITE_VAPID }), { headers: { "Content-Type": "application/json" } });
  }
  const gifts = await sendGiftDMs();
  const drops = await postDrops().catch(() => 0);
  const b2 = body as { gifts?: boolean; drops?: boolean };
  if (b2.gifts || b2.drops) return new Response(JSON.stringify({ gifts, drops }), { headers: { "Content-Type": "application/json" } });
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
  return new Response(JSON.stringify({ checked: rems?.length || 0, sent, gifts, drops }), { headers: { "Content-Type": "application/json" } });
});
