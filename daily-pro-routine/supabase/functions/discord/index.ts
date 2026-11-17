// Repline bug bot. Discord sends button presses, /bug and form submits here (Interactions Endpoint URL);
// the database pings it with {"bugs": true} when a report comes from the app (013_bug_reports.sql).
// It sorts each report, opens a thread in #report-a-bug, asks the reporter follow-up questions by DM,
// DMs the devs with status buttons, and thanks the reporter when a dev marks the bug fixed.
//
// Secrets: DISCORD_BOT_TOKEN. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Deploy with verify_jwt = false (Discord signs its requests; the database ping carries nothing to trust).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BOT = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const PUBLIC_KEY = "29c4bd3d09ce957a1f4c81e242ecb2f97f3b303494a87292362eed99791d3440";
const CHANNEL = "1572181354353926165"; // #report-a-bug
const API = "https://discord.com/api/v10";
const H = { Authorization: `Bot ${BOT}`, "Content-Type": "application/json" };
const EPH = 64;
const CYAN = 0x38e0ff, COLORS: Record<string, number> = { critical: 0xf23f43, high: 0xff9f0a, medium: 0x38e0ff, low: 0x86868b };
const PRIO_TXT: Record<string, string> = { critical: "🔴 Critical", high: "🟠 High", medium: "🔵 Medium", low: "⚪ Low" };

type Report = Record<string, any>;

// ---------- helpers ----------
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const clip = (s: string | null | undefined, n: number) => { const t = String(s || "").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204) return {};
  const d = await r.json().catch(() => ({}));
  if (!r.ok) console.log("discord", method, path, r.status, JSON.stringify(d).slice(0, 300));
  return r.ok ? d : null;
}
async function dm(userId: string, payload: Record<string, unknown>) {
  if (!userId) return null;
  const ch = await api("/users/@me/channels", "POST", { recipient_id: userId });
  if (!ch || !ch.id) return null;
  return api(`/channels/${ch.id}/messages`, "POST", payload);
}
async function devIds(): Promise<string[]> {
  const { data } = await db.from("profiles").select("discord_id").eq("is_dev", true).not("discord_id", "is", null);
  return (data || []).map((r: any) => String(r.discord_id)).filter(Boolean);
}
function hexToBytes(h: string) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
let KEY: CryptoKey | null = null;
async function verify(req: Request, body: string) {
  const sig = req.headers.get("X-Signature-Ed25519"), ts = req.headers.get("X-Signature-Timestamp");
  if (!sig || !ts) return false;
  KEY = KEY || await crypto.subtle.importKey("raw", hexToBytes(PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify("Ed25519", KEY, hexToBytes(sig), new TextEncoder().encode(ts + body));
}

// ---------- sorting ----------
const AREAS: [RegExp, string][] = [
  [/sign.?in|log.?in|login|logout|discord (auth|login)|account/i, "Sign-in"],
  [/overlay|hotkey|ctrl\+shift/i, "Overlay"],
  [/timer|set|routine|switch|pause|next set|skip/i, "Timer & routines"],
  [/drop|wheel|spin|item|theme|skin|ring|ticket|jackpot/i, "Drops"],
  [/personal plan|coach/i, "Personal Plan"],
  [/kovaak|aim progress|scenario|curve/i, "KovaaK's"],
  [/leaderboard|points|rank|verified/i, "Leaderboard"],
  [/update|install|download|windows app|setup/i, "Windows app"],
  [/streak|badge|freeze/i, "Streak & badges"],
  [/friend|invite/i, "Friends"],
  [/remind|notification/i, "Reminders"]
];
function areaOf(t: string) { for (const [re, a] of AREAS) if (re.test(t)) return a; return "Other"; }
function prioOf(t: string) {
  if (/crash|can'?t (open|start|sign|log)|cannot (open|start|sign|log)|won'?t (open|start|load)|black screen|white screen|blank|lost (my )?(streak|progress|items|account)|geht nicht mehr|stürzt|absturz/i.test(t)) return "critical";
  if (/stop|freez|stuck|hang|not working|doesn'?t work|does not work|broken|disappear|missing|wrong|kaputt|funktioniert nicht/i.test(t)) return "high";
  if (/typo|spelling|text|colou?r|looks|align|small|tippfehler/i.test(t)) return "low";
  return "medium";
}
const words = (t: string) => new Set(String(t).toLowerCase().replace(/[^a-z0-9äöüß ]/g, " ").split(/\s+/).filter((w) => w.length > 3));
async function similarCount(r: Report) {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data } = await db.from("bug_reports").select("id, what, area").neq("id", r.id).gte("created_at", since).eq("area", r.area).limit(200);
  const w = words(r.what);
  return (data || []).filter((x: any) => { let n = 0; words(x.what).forEach((k) => { if (w.has(k)) n++; }); return n >= 2; }).length;
}

// ---------- messages ----------
function reportEmbed(r: Report, title?: string) {
  const fields = [
    { name: "What happened", value: clip(r.what, 1000) || "–" },
    ...(r.before ? [{ name: "Right before", value: clip(r.before, 600) }] : []),
    { name: "Where", value: clip([r.where_, r.platform, r.version ? "v" + r.version : ""].filter(Boolean).join(" · "), 200) || "Not given", inline: true },
    { name: "Area", value: r.area || "Other", inline: true },
    { name: "Priority", value: PRIO_TXT[r.priority] || r.priority, inline: true },
    ...(r.freq ? [{ name: "How often", value: r.freq, inline: true }] : []),
    ...(r.similar_count ? [{ name: "Similar", value: `${r.similar_count} other report${r.similar_count === 1 ? "" : "s"} this week`, inline: true }] : []),
    ...(r.extra ? [{ name: "More from the player", value: clip(r.extra, 800) }] : []),
    ...(r.last_error ? [{ name: "Last error (from the app)", value: "`" + clip(r.last_error, 300) + "`" }] : [])
  ];
  return { title: title || `Bug #${r.id}`, color: COLORS[r.priority] || CYAN, fields, footer: { text: `${r.source === "app" ? "Sent from the app" : "Sent in Discord"}${r.discord_name ? " · " + r.discord_name : ""}` }, timestamp: r.created_at };
}
function questions(r: Report) {
  const rows: any[] = [];
  const msg: string[] = [];
  if (!r.version) {
    msg.push("**Where are you playing, and is your app up to date?**");
    rows.push({ type: 1, components: [["latest", "Newest app"], ["older", "Older app"], ["website", "Website"], ["unsure", "Not sure"]].map(([v, l]) => ({ type: 2, style: 2, label: l, custom_id: `bq:${r.id}:ver:${v}` })) });
  }
  if (!r.freq) {
    msg.push("**Does it happen every time?**");
    rows.push({ type: 1, components: [["every", "Every time"], ["sometimes", "Sometimes"], ["once", "Only once"]].map(([v, l]) => ({ type: 2, style: 2, label: l, custom_id: `bq:${r.id}:freq:${v}` })) });
  }
  if (String(r.what || "").length < 40 || !r.before) {
    msg.push("**Can you tell us a bit more?** What did you click, and what did you expect?");
    rows.push({ type: 1, components: [{ type: 2, style: 1, label: "Add details", custom_id: `bq:${r.id}:more` }] });
  }
  return { msg, rows };
}
function devButtons(id: number, status: string) {
  return [{ type: 1, components: [
    { type: 2, style: status === "working" ? 1 : 2, label: "Working on it", custom_id: `bs:${id}:working`, disabled: status !== "new" },
    { type: 2, style: 3, label: "Fixed", custom_id: `bs:${id}:fixed`, disabled: status === "fixed" || status === "notabug" },
    { type: 2, style: 2, label: "Not a bug", custom_id: `bs:${id}:notabug`, disabled: status === "fixed" || status === "notabug" }
  ] }];
}

// ---------- new reports: sort, thread, questions, dev DMs ----------
async function processPending() {
  const { data } = await db.from("bug_reports").select("*").is("posted_at", null).order("id").limit(10);
  for (const r of (data || []) as Report[]) {
    // claim it first so a second ping can't post it twice
    const { data: claimed } = await db.from("bug_reports").update({ posted_at: new Date().toISOString() }).eq("id", r.id).is("posted_at", null).select("id");
    if (!claimed || !claimed.length) continue;
    const text = `${r.what} ${r.before || ""} ${r.where_ || ""}`;
    r.area = areaOf(text); r.priority = prioOf(text); r.similar_count = await similarCount(r);
    const th = await api(`/channels/${CHANNEL}/threads`, "POST", { name: clip(`#${r.id} · ${r.what.replace(/\s+/g, " ")}`, 90), type: 11, auto_archive_duration: 4320, rate_limit_per_user: 10 });
    r.thread_id = th && th.id ? th.id : null;
    await db.from("bug_reports").update({ area: r.area, priority: r.priority, similar_count: r.similar_count, thread_id: r.thread_id, updated_at: new Date().toISOString() }).eq("id", r.id);
    const q = questions(r);
    if (r.thread_id) {
      await api(`/channels/${r.thread_id}/messages`, "POST", {
        content: `${r.discord_id ? `<@${r.discord_id}> ` : ""}Thanks for the report! This is your thread for bug #${r.id}. We reply here, and a screenshot or clip helps a lot: just drop it in.`,
        embeds: [reportEmbed(r)], allowed_mentions: { users: r.discord_id ? [r.discord_id] : [] }
      });
    }
    // follow-up questions go to the reporter by DM
    if (r.discord_id && q.rows.length) {
      await dm(r.discord_id, { content: `Hey! Thanks for reporting bug #${r.id} (“${clip(r.what, 80)}”). A few quick questions so we can fix it faster:\n\n${q.msg.join("\n")}`, components: q.rows.slice(0, 5) });
    }
    const link = r.thread_id ? `https://discord.com/channels/1570385914096783381/${r.thread_id}` : "";
    for (const d of await devIds()) {
      await dm(d, { content: `${r.priority === "critical" ? "🚨 " : ""}New bug #${r.id}${link ? ` · ${link}` : ""}`, embeds: [reportEmbed(r, `${PRIO_TXT[r.priority]} · Bug #${r.id}`)], components: devButtons(r.id, "new") });
    }
  }
}

// ---------- the reporter answers / a dev sets a status ----------
async function getReport(id: number) { const { data } = await db.from("bug_reports").select("*").eq("id", id).maybeSingle(); return data as Report | null; }
async function noteToDevs(r: Report, line: string) {
  for (const d of await devIds()) await dm(d, { content: `Bug #${r.id}: ${line}` });
}
async function setStatus(r: Report, status: string) {
  await db.from("bug_reports").update({ status, updated_at: new Date().toISOString() }).eq("id", r.id);
  const texts: Record<string, [string, string]> = {
    working: [`🛠️ We're working on bug #${r.id}. Thanks for your patience!`, `Good news: we're working on your bug #${r.id} (“${clip(r.what, 80)}”). We'll message you when it's fixed.`],
    fixed: [`✅ Bug #${r.id} is fixed. Thank you for reporting it, you helped make Repline better!`, `✅ Your bug #${r.id} (“${clip(r.what, 80)}”) is fixed! Thank you so much for reporting it, you helped make Repline better for everyone. 🙏`],
    notabug: [`Bug #${r.id} was checked: it works as intended, so we're closing it. Thanks for taking the time to report it!`, `Thanks for reporting #${r.id} (“${clip(r.what, 80)}”)! We checked it and it works as intended, so we're closing it. If something still feels wrong, just report it again with a bit more detail.`]
  };
  const [thread, dmText] = texts[status] || ["", ""];
  if (r.thread_id && thread) {
    await api(`/channels/${r.thread_id}/messages`, "POST", { content: thread });
    if (status !== "working") await api(`/channels/${r.thread_id}`, "PATCH", { archived: true });
  }
  if (r.discord_id && dmText) await dm(r.discord_id, { content: dmText });
  if (r.user_id && status !== "working") await db.from("notices").insert({ user_id: r.user_id, kind: "bug", payload: { id: r.id, status, what: clip(r.what, 120) } });
}

function modal(customId: string, title: string, inputs: any[]) { return { type: 9, data: { custom_id: customId, title, components: inputs.map((c) => ({ type: 1, components: [c] })) } }; }
const reportModal = () => modal("bug_modal", "Report a bug", [
  { type: 4, custom_id: "where", label: "Where did it happen?", style: 1, required: true, max_length: 100, placeholder: "Website, Windows app or Discord" },
  { type: 4, custom_id: "what", label: "What happened?", style: 2, required: true, min_length: 3, max_length: 1500, placeholder: "The timer stopped after the second set…" },
  { type: 4, custom_id: "before", label: "What did you do right before?", style: 2, required: false, max_length: 1000 },
  { type: 4, custom_id: "version", label: "Version (if you know it)", style: 1, required: false, max_length: 40, placeholder: "e.g. 1.10.0" }
]);
const field = (it: any, id: string) => { for (const row of it.data.components || []) for (const c of row.components || []) if (c.custom_id === id) return String(c.value || "").trim(); return ""; };

async function handle(it: any, wait: (p: Promise<unknown>) => void) {
  const user = it.member ? it.member.user : it.user;
  const uid = user ? String(user.id) : "";
  if (it.type === 1) return json({ type: 1 });
  if (it.type === 2 && it.data && it.data.name === "bug") return json(reportModal());
  if (it.type === 3) {
    const id: string = it.data.custom_id || "";
    if (id === "bug_open") return json(reportModal());
    if (id === "bug_mine") {
      const { data } = await db.from("bug_reports").select("id, what, status").eq("discord_id", uid).order("id", { ascending: false }).limit(10);
      const st: Record<string, string> = { new: "🆕 New", working: "🛠️ Working on it", fixed: "✅ Fixed", notabug: "☑️ Closed" };
      const lines = (data || []).map((r: any) => `**#${r.id}** · ${st[r.status] || r.status} · ${clip(r.what, 60)}`);
      return json({ type: 4, data: { flags: EPH, content: lines.length ? lines.join("\n") : "You haven't reported a bug yet. Thanks for keeping an eye out!" } });
    }
    let m = /^bq:(\d+):(ver|freq):(.+)$/.exec(id);
    if (m) {
      const r = await getReport(+m[1]);
      if (!r || r.discord_id !== uid) return json({ type: 4, data: { flags: EPH, content: "This question is for the person who reported the bug." } });
      const patch: Record<string, string> = m[2] === "ver" ? { version: ({ latest: "newest app", older: "older app", website: "website", unsure: "not sure" } as Record<string, string>)[m[3]] || m[3] } : { freq: { every: "Every time", sometimes: "Sometimes", once: "Only once" }[m[3]] || m[3] };
      await db.from("bug_reports").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", r.id);
      wait((async () => {
        const line = m![2] === "ver" ? `version ${patch.version}` : `happens: ${patch.freq}`;
        if (r.thread_id) await api(`/channels/${r.thread_id}/messages`, "POST", { content: `ℹ️ From the reporter: ${line}` });
        await noteToDevs(r, line);
      })());
      return json({ type: 4, data: { flags: EPH, content: "Got it, thanks! 🙏" } });
    }
    m = /^bq:(\d+):more$/.exec(id);
    if (m) return json(modal(`bm:${m[1]}`, `More about bug #${m[1]}`, [{ type: 4, custom_id: "extra", label: "What did you click, what did you expect?", style: 2, required: true, max_length: 1500 }]));
    m = /^bs:(\d+):(working|fixed|notabug)$/.exec(id);
    if (m) {
      if (!(await devIds()).includes(uid)) return json({ type: 4, data: { flags: EPH, content: "Only the Repline team can change this." } });
      const r = await getReport(+m[1]);
      if (!r) return json({ type: 4, data: { flags: EPH, content: "Bug not found." } });
      const status = m[2];
      wait(setStatus(r, status));
      const label = { working: "🛠️ Working on it", fixed: "✅ Fixed, the reporter was thanked", notabug: "☑️ Closed as not a bug" }[status];
      return json({ type: 7, data: { content: `${it.message.content}\n**Status:** ${label}`, embeds: it.message.embeds, components: devButtons(r.id, status) } });
    }
    return json({ type: 4, data: { flags: EPH, content: "This button is no longer active." } });
  }
  if (it.type === 5) {
    const id: string = it.data.custom_id || "";
    if (id === "bug_modal") {
      const what = field(it, "what");
      if (what.length < 3) return json({ type: 4, data: { flags: EPH, content: "Please tell us what happened." } });
      const { count } = await db.from("bug_reports").select("id", { count: "exact", head: true }).eq("discord_id", uid).gte("created_at", new Date(Date.now() - 864e5).toISOString());
      if ((count || 0) >= 5) return json({ type: 4, data: { flags: EPH, content: "You've sent 5 reports today. Thanks a lot! Please add more details to your existing threads." } });
      const { data: prof } = await db.from("profiles").select("id").eq("discord_id", uid).maybeSingle();
      const { data, error } = await db.from("bug_reports").insert({
        source: "discord", discord_id: uid, discord_name: user ? (user.global_name || user.username) : null, user_id: prof ? prof.id : null,
        where_: field(it, "where").slice(0, 100), what: what.slice(0, 1500), before: field(it, "before").slice(0, 1000) || null, version: field(it, "version").slice(0, 40) || null
      }).select("id").single();
      if (error || !data) return json({ type: 4, data: { flags: EPH, content: "Couldn't save your report. Please try again in a minute." } });
      wait(processPending());
      return json({ type: 4, data: { flags: EPH, content: `Thanks! Your report is **#${data.id}**. You'll find your own thread in <#${CHANNEL}> in a moment, and we may DM you a quick question.` } });
    }
    const m = /^bm:(\d+)$/.exec(id);
    if (m) {
      const r = await getReport(+m[1]);
      if (!r || r.discord_id !== uid) return json({ type: 4, data: { flags: EPH, content: "This is for the person who reported the bug." } });
      const extra = field(it, "extra").slice(0, 1500);
      await db.from("bug_reports").update({ extra: [r.extra, extra].filter(Boolean).join("\n").slice(0, 1500), updated_at: new Date().toISOString() }).eq("id", r.id);
      wait((async () => {
        if (r.thread_id) await api(`/channels/${r.thread_id}/messages`, "POST", { content: `ℹ️ More from the reporter:\n> ${clip(extra, 900).replace(/\n/g, "\n> ")}` });
        await noteToDevs(r, `more details: “${clip(extra, 300)}”`);
      })());
      return json({ type: 4, data: { flags: EPH, content: "Thanks, that helps a lot! 🙏" } });
    }
  }
  return json({ type: 4, data: { flags: EPH, content: "Something went wrong. Please try again." } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const body = await req.text();
  // EdgeRuntime.waitUntil keeps work going after we answered Discord (it needs an answer within 3 seconds)
  const wait = (p: Promise<unknown>) => { try { (globalThis as any).EdgeRuntime.waitUntil(p.catch((e) => console.log("bg", e))); } catch { p.catch(() => {}); } };
  if (req.headers.get("X-Signature-Ed25519")) {
    if (!(await verify(req, body))) return new Response("invalid request signature", { status: 401 });
    try { return await handle(JSON.parse(body), wait); } catch (e) { console.log("handle", e); return json({ type: 4, data: { flags: EPH, content: "Something went wrong. Please try again." } }); }
  }
  let b: any = {}; try { b = JSON.parse(body); } catch { /* ignore */ }
  if (b && b.bugs) { await processPending(); return json({ ok: true }); }
  return json({ ok: false }, 400);
});
