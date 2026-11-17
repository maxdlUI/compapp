// Repline question bot for the #ask-a-question channel (a normal text channel).
// The database calls this every minute ({"poll": true}, 015/016_questions_bot.sql). It reads new messages in the channel,
// replies to each question with the player mentioned, and DMs the devs when it has no sure answer.
// It stays out when a dev helps someone or a player replies to a dev, and never repeats a topic to the same player within an hour.
// The answers come from the FAQ below (no paid AI, nothing costs money).
//
// Secrets: DISCORD_BOT_TOKEN. Deploy with verify_jwt = false (the call carries nothing to trust; it only reads Discord).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BOT = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const GUILD = "1570385914096783381";
const CHANNEL = "1572188220970635324"; // #ask-a-question
const BUG_CH = "1572181354353926165", IDEA_CH = "1572183657177940049", PARTNER_CH = "1570387452609433690";
const API = "https://discord.com/api/v10";
const H = { Authorization: `Bot ${BOT}`, "Content-Type": "application/json" };
const SITE = "https://repline.pages.dev";

async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204) return {};
  const d = await r.json().catch(() => ({}));
  if (!r.ok) console.log("discord", method, path, r.status, JSON.stringify(d).slice(0, 300));
  return r.ok ? d : null;
}
async function devIds(): Promise<string[]> {
  const { data } = await db.from("profiles").select("discord_id").eq("is_dev", true).not("discord_id", "is", null);
  return (data || []).map((r: any) => String(r.discord_id)).filter(Boolean);
}
async function dm(userId: string, payload: Record<string, unknown>) {
  const ch = await api("/users/@me/channels", "POST", { recipient_id: userId });
  if (ch && ch.id) await api(`/channels/${ch.id}/messages`, "POST", payload);
}
const clip = (s: string, n: number) => { const t = String(s || "").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const big = (s: string) => { try { return BigInt(s); } catch { return 0n; } };

// ---------- what the bot knows ----------
// Each entry: words that point to it (with weight) and the answer. The best match wins if it is sure enough.
type Faq = { id: string; keys: [RegExp, number][]; a: string };
const FAQ: Faq[] = [
  { id: "ban", keys: [[/\bban+(ed|nt)?\b|gebannt|sperre|anti.?cheat|\beac\b|easy ?anti|\bsafe\b|sicher|detect(ed)? by|legal|allowed/, 3], [/windows app|app|overlay|tracking|kovaak/, 1]],
    a: "**No, Repline can't get you banned.** It never touches Fortnite: no memory, no game files, no network. The Windows app only looks at the list of running programs (like Task Manager or Discord does), and for KovaaK's it reads the result files KovaaK's saves itself. You can turn both off in **Settings → Tracking**." },
  { id: "download", keys: [[/download|install|herunterlad|installier|setup|\.exe|windows app|desktop app|pc app/, 3], [/where|wo |how|wie|get|bekomm|link/, 1], [/smartscreen|protected your pc|windows warn|virus|defender|unknown publisher|run anyway/, 4]],
    a: `**Get the Windows app here:** ${SITE}/download/windows (free, Windows 10 and 11). Run the installer once, after that Repline updates itself.\nIf Windows shows **“Windows protected your PC”**, click **More info → Run anyway**. That shows up because the app is new and not signed, it's safe.` },
  { id: "mac", keys: [[/\bmac\b|macos|macbook|apple|iphone|ipad|android|phone|handy|mobile|console|playstation|ps5|xbox|switch/, 3]],
    a: `The Windows app is for Windows 10 and 11 only. On **Mac, iPhone, iPad, Android or next to your console** use the website: ${SITE}. It has every routine, timer, map code and leaderboard. Tip for iPhone: open it in Safari → Share → **Add to Home Screen**, then you stay signed in.` },
  { id: "signin", keys: [[/sign.?in|log.?in|anmeld|einlogg|account|konto|signed out|logged out|ausgeloggt|abgemeldet/, 3], [/discord|work|geht nicht|doesn.?t|cant|can.?t|problem|error|stay/, 1]],
    a: "You sign in with **Discord**, it's free (top right on the website or in the app → **Sign in**). You stay signed in on that device until you sign out.\nIf you get signed out on **iPhone**: Safari deletes website data after 7 days without a visit. Add Repline to your Home Screen (Share → Add to Home Screen) and that stops.\nStill stuck? Tell us what you see after you click Sign in, a screenshot helps." },
  { id: "plans", keys: [[/price|preis|cost|kost|plan|abo|subscription|premium|\bpro\b|standard|pay|bezahl|kauf|buy|purchase|paypal|card|€|euro|free|kostenlos|gratis/, 2], [/how much|wie viel|when|wann|upgrade|get pro/, 2]],
    a: `**Plans:** Free · **Standard** €3.99 a month (€29.99 a year) · **Pro** €6.99 a month (€49.99 a year). Details: ${SITE}/#plans\n**Right now you don't need to pay anything:** it's launch month, and every Pro feature is free for everyone who is signed in until **12 December 2026**. Payments aren't open yet (“Coming soon”).` },
  { id: "count", keys: [[/count|zählt|zaehlt|verified|verifiziert|not counted|didn.?t count|no points|keine punkte|no spin|kein spin|minutes? missing|minuten fehlen/, 3], [/routine|training|set/, 1]],
    a: "**A routine counts when you really trained it:** sets can't be skipped, and our server checks that the real time has passed.\n**Verified** (Windows app): Fortnite or KovaaK's also has to be running during the game sets. A Verified routine gives a spin with **2 Golden Tickets** and a mark on the leaderboard.\nA routine that doesn't count keeps your streak, but gives no spin and no points. Pausing a lot or skipping ahead with the clock is the usual reason." },
  { id: "skip", keys: [[/skip|überspring|ueberspring|next set|nächste(n)? set|naechste(n)? set/, 3]],
    a: "Sets can't be skipped: the next set starts when the current one is done. That's how we keep the leaderboard fair.\nTo get to the next map faster, use the pause between sets (30 seconds by default, change it in **Settings**). Keys: **Space** start/pause · **R** restart · **F** full screen. In the Windows app the same works in game with **Ctrl+Shift+Space / R**." },
  { id: "board", keys: [[/leaderboard|rangliste|rank|platz|points|punkte|prize|preis(e)?|gewinn|\bwin\b|reward|belohnung|top ?\d+/, 2], [/how|wie|get|bekomm|month|monat|week|woche/, 1]],
    a: `**Points:** +1 per minute in a running set · +25 for finishing a routine (once a day) · streak bonus +2 per day (max +40). At most 180 points a day count.\n**Monthly prizes:** #1 3 months Pro · #2–3 1 month Pro · #4–10 1 month Standard · #11–50 a badge. **Weekly Top 3** get a badge and a shout-out here.\nYour account has to be at least 7 days old, one account per person. Leaderboard: ${SITE}/#board` },
  { id: "drops", keys: [[/drop|spin|wheel|glücksrad|gluecksrad|\brad\b|golden ticket|ticket|draw|verlosung|jackpot/, 3]],
    a: `**Drops:** every routine that counts gives you **1 spin** (up to 3 a day). The prize is drawn on our server: points, streak freezes, items (backgrounds, titles, overlay skins, timer rings, sound packs), Pro days and more.\nEvery spin is also a **Golden Ticket** for the monthly draw (a year of Pro on the 1st). A Verified spin from the Windows app counts as **2 tickets**. Spins can't be bought. Wheel: ${SITE}/#drops` },
  { id: "items", keys: [[/item|skin|background|hintergrund|title|titel|\bring\b|timer ring|sound pack|equip|ausrüst|ausruest|anlegen|cosmetic/, 3]],
    a: "Items you won in Drops are equipped in **Settings**: background, title and name color, **overlay skin** (shows in the Windows app overlay), **timer ring** and **sound pack**. Pick one and it's on right away. Everything you own is listed there too." },
  { id: "streak", keys: [[/streak|serie|freeze|freez|lost my|verloren/, 3]],
    a: "Your **streak** grows with every day you train. Miss a day and a **streak freeze** saves it on its own. You earn one freeze for every 7 days in a row (hold up to 2, Pro 3), and you can also win them in Drops. A day saved by a freeze keeps the streak but gives no points." },
  { id: "overlay", keys: [[/overlay|in.?game|hotkey|tastenkürzel|shortcut|keybind|taste/, 3]],
    a: "The **in-game overlay** is in the Windows app: it shows your timer on top of Fortnite. Set position (or drag it), size, opacity, sound and skin in **Settings → Overlay**.\n**Hotkeys in game:** Ctrl+Shift+Space start/pause · Ctrl+Shift+N next · Ctrl+Shift+R restart · Ctrl+Shift+O overlay on/off · Ctrl+Shift+E open Repline.\nTip: run Fortnite in **Windowed Fullscreen**, in Fullscreen no overlay can show on top." },
  { id: "kovaaks", keys: [[/kovaak|kovak|aim ?trainer|aim score|aim progress|playlist/, 3]],
    a: "**KovaaK's tracking** (Windows app): Repline reads the result files KovaaK's saves itself and shows your progress on the **Aim** page. Turn it on in **Settings → Tracking**. If nothing shows up, play one scenario after turning it on, and if KovaaK's is on another drive, pick the folder there (**Choose folder**).\nThe playlist share codes are in each KovaaK's set: copy, then KovaaK's → Playlists → Import." },
  { id: "detect", keys: [[/game detect|not detected|nicht erkannt|erkennt|doesn.?t see|fortnite (isn.?t|not) (running|open)|no verified|nicht verifiziert/, 4]],
    a: "**Game detection** checks the list of running programs for Fortnite or KovaaK's during the game sets. Make sure **Settings → Tracking → Game detection** is on and the game is really running (not only the launcher) during at least most of the game sets. It only works in the Windows app, the website can't see your games." },
  { id: "coach", keys: [[/personal plan|coach|ai routine|ki routine|\bai\b|\bki\b|made for (me|you)|custom routine for me/, 3]],
    a: `**Personal Plan** (${SITE}/#ai): write what you want to train, like “45 min, my edits are bad, cup in 3 days”, and you get a routine made for you. Standard: 1 a day, Pro: 3 a day (during launch month everyone signed in counts as Pro).\nThe more you say (time, weak spots, cup date, input), the better it fits.` },
  { id: "own", keys: [[/own routine|eigene routine|create (a )?routine|make (a )?routine|builder|erstell|import code|share code|teilen|share (my|a) routine/, 3]],
    a: "**Your own routines:** Home → **My routines → New**, pick sets and times. Free: 1 own routine, Standard: 2, Pro: unlimited.\nTo **share** one, open it and copy its code. To use a friend's, click **Import code** and paste it." },
  { id: "creator", keys: [[/creator code|support.?a.?creator|code von|creator/, 3]],
    a: "**Creator codes:** enter a creator's code in **Settings → Creator code** to support them. Want your own code as a creator? Post in <#" + PARTNER_CH + ">." },
  { id: "partner", keys: [[/partner|sponsor|collab|zusammenarbeit|map creator|my map|meine map|team/, 2]],
    a: "Map creator, team, creator or coach? Tell us who you are in <#" + PARTNER_CH + "> and we'll get back to you." },
  { id: "remind", keys: [[/remind|erinner|notification|benachrichtig|push/, 3]],
    a: "**Reminders:** Settings → **Reminder**. Pick a time and days, then how you want it: Discord DM (stay in this server so the bot can message you), browser push or the Windows app. You can skip it on days you already trained." },
  { id: "mapcode", keys: [[/map ?code|island code|code for|wo finde ich die map|which map|welche map/, 3]],
    a: "Every set shows its **map code** with a copy button. In Fortnite: Discover → search the code → play. The maps we use are listed in each routine before you start." },
  { id: "update", keys: [[/update|version|aktualis|new version|neue version|outdated|veraltet/, 2]],
    a: "The Windows app **updates itself**: when a new version is out it downloads in the background and asks you to restart. If it got stuck, reinstall from " + SITE + "/download/windows, your data stays (it's in your account)." },
  { id: "bug", keys: [[/bug|error|fehler|crash|absturz|stürzt|broken|kaputt|doesn.?t work|not working|funktioniert nicht|geht nicht|freez(es|ing)|black screen|schwarz/, 3]],
    a: `Sounds like a bug. Please report it in <#${BUG_CH}> (button or \`/bug\`) or in Repline → **Settings → Help → Report a bug**: version and device are added for you and the devs get it right away. You'll get a message when it's fixed.` },
  { id: "idea", keys: [[/idea|idee|suggest|vorschlag|feature|wish|wunsch|would be (cool|nice)|wäre cool|waere cool|please add|can you add|could you add|könnt ihr|koennt ihr|bitte (ein)?bauen|hinzufügen/, 3]],
    a: `Love it! Post ideas in <#${IDEA_CH}> (button or \`/idea\`) or in Repline → **Settings → Help → Suggest a feature**. Everyone can upvote, the devs see every idea.` },
  { id: "keys", keys: [[/keyboard|keys|tasten|controls|steuerung/, 2]],
    a: "Keys on the website and in the app: **Space** start/pause · **R** restart (+15 s while you switch) · **N** next when the set is done · **F** full screen. In game (Windows app): **Ctrl+Shift+Space / N / R / O / E**." },
  { id: "pause", keys: [[/pause|break|countdown|timer (between|zwischen)|zwischen den sets/, 2]],
    a: "Between sets there's a short break to open the next map: **30 seconds** by default, then the set starts on its own. Change it in **Settings**." },
  { id: "what", keys: [[/what is repline|was ist repline|how does (it|repline) work|wie funktioniert|what does repline/, 4]],
    a: `**Repline** is daily Fortnite training like the pros do it: pick a routine, then train set by set with timers, map codes and KovaaK's playlists. Streaks, leaderboards with prizes, Drops and a Personal Plan made for you. Start here: ${SITE}` },
];

const norm = (t: string) => " " + String(t || "").toLowerCase().replace(/<@!?\d+>/g, " ").replace(/\s+/g, " ") + " ";
function match(text: string, skip: string[] = []) {
  const t = norm(text);
  const scored = FAQ.filter((f) => !skip.includes(f.id)).map((f) => ({ f, s: f.keys.reduce((n, [re, w]) => n + (re.test(t) ? w : 0), 0) }))
    .filter((x) => x.s >= 3).sort((a, b) => b.s - a.s);
  if (!scored.length) return [];
  // a second answer only if it is just as sure as the first (questions often ask two things)
  return scored.filter((x, i) => i === 0 || (i === 1 && x.s >= scored[0].s)).map((x) => x.f);
}
const THANKS = /^\s*(thx|thanks|thank you|ty|danke|dankeschön|merci|ok(ay)?|perfect|perfekt|works|klappt|geht jetzt|solved|gelöst|nice|top|👍|🙏|❤️)[\s!.,]*\S{0,20}$/i;

// ---------- the poll ----------
const QUESTION = /\?|^\s*(how|what|why|when|where|which|who|can|could|is|are|do|does|did|will|wie|was|warum|wieso|wann|wo|welche[rsn]?|kann|könnt|gibt|ist|sind|hat|habe|muss)\b|\bhelp\b|hilfe|problem/i;
const jump = (id: string) => `https://discord.com/channels/${GUILD}/${CHANNEL}/${id}`;

async function reply(m: any, content: string) {
  await api(`/channels/${CHANNEL}/messages`, "POST", {
    content: clip(content, 1990),
    allowed_mentions: { users: [m.author.id] },
    message_reference: { message_id: m.id, fail_if_not_exists: false },
  });
}
async function recent(user: string, minutes: number) {
  const { data } = await db.from("ask_answers").select("faq").eq("user_id", user).gt("at", new Date(Date.now() - minutes * 60000).toISOString());
  return (data || []).map((r: any) => String(r.faq));
}

async function poll() {
  let { data: cur } = await db.from("ask_threads").select("*").eq("thread_id", CHANNEL).maybeSingle();
  if (!cur) {
    await db.from("ask_threads").upsert({ thread_id: CHANNEL, title: "#ask-a-question", last_seen: CHANNEL }, { onConflict: "thread_id", ignoreDuplicates: true });
    ({ data: cur } = await db.from("ask_threads").select("*").eq("thread_id", CHANNEL).maybeSingle());
  }
  if (!cur) return { error: "no cursor" };
  const msgs = ((await api(`/channels/${CHANNEL}/messages?after=${cur.last_seen}&limit=50`)) || [])
    .sort((a: any, b: any) => (big(a.id) < big(b.id) ? -1 : 1));
  if (!msgs.length) return { messages: 0 };
  // claim these messages (conditional update: only one run wins)
  const { data: claimed } = await db.from("ask_threads").update({ last_seen: msgs[msgs.length - 1].id, updated_at: new Date().toISOString() })
    .eq("thread_id", CHANNEL).eq("last_seen", cur.last_seen).select();
  if (!claimed || !claimed.length) return { skipped: true };
  const devs = new Set(await devIds());
  let answered = 0;
  for (const m of msgs) {
    if (!m.author || m.author.bot || ![0, 19].includes(m.type)) continue;
    const uid = String(m.author.id);
    const ref = m.referenced_message;
    // a dev helping someone (reply to or mention of another player): stay out of it; a dev's own question gets an answer
    if (devs.has(uid) && ((ref && ref.author && !ref.author.bot && String(ref.author.id) !== uid) || (m.mentions || []).some((u: any) => !u.bot && String(u.id) !== uid))) continue;
    if (ref && ref.author && String(ref.author.id) !== uid && devs.has(String(ref.author.id))) continue; // talking with a dev
    const text = String(m.content || "");
    const given = await recent(uid, 60);
    if (THANKS.test(text)) {
      if (given.length) await api(`/channels/${CHANNEL}/messages/${m.id}/reactions/${encodeURIComponent("✅")}/@me`, "PUT");
      continue;
    }
    const faqs = match(text, given);
    if (faqs.length) {
      const first = !given.length;
      await reply(m, `${first ? "Hey " : ""}<@${uid}>${first ? "! 👋" : ""} ` + faqs.map((f) => f.a).join("\n\n") +
        (first ? "\n-# I'm the Repline bot. Not what you meant? Ask again in other words, or the team will help." : ""));
      await db.from("ask_answers").insert(faqs.map((f) => ({ user_id: uid, faq: f.id })));
      answered++;
    } else if (QUESTION.test(text) && text.trim().length >= 8 && !given.includes("devs")) {
      await reply(m, `<@${uid}> Good question! I don't have a sure answer, so I've asked the team. Someone will reply here soon. ⏳`);
      for (const d of devs) {
        await dm(d, { content: `❓ **Question in #ask-a-question the bot couldn't answer**\nFrom **${clip(m.author.global_name || m.author.username, 40)}**\n> ${clip(text, 600).replace(/\n/g, "\n> ")}\n${jump(m.id)}`, allowed_mentions: { parse: [] } });
      }
      await db.from("ask_answers").insert({ user_id: uid, faq: "devs" });
      answered++;
    }
  }
  return { messages: msgs.length, answered };
}

// ---------- welcome DMs for new players (017_welcome.sql) ----------
const linkBtn = (label: string, url: string) => ({ type: 2, style: 5, label, url });
async function welcomeDms() {
  const now = Date.now(), iso = (ms: number) => new Date(ms).toISOString();
  let sent = 0;
  const { data: fresh } = await db.from("profiles").select("id, discord_id, username").is("welcome_dm_at", null)
    .not("discord_id", "is", null).gt("created_at", iso(now - 2 * 864e5)).limit(10);
  for (const p of fresh || []) {
    await db.from("profiles").update({ welcome_dm_at: iso(now) }).eq("id", p.id).is("welcome_dm_at", null);
    await dm(String(p.discord_id), {
      embeds: [{ color: 0x38e0ff, title: `Welcome to Repline${p.username ? ", " + clip(p.username, 40) : ""}!`,
        description: "Your first routine takes 30 minutes. Pick one and go, or let us build one just for you: your **Personal Plan** is free once.\n\nFinish your first routine and you get a **bonus spin** on the Drops wheel." }],
      components: [{ type: 1, components: [linkBtn("Start my first routine", `${SITE}/#goal`), linkBtn("Build my Personal Plan", `${SITE}/#ai`)] }],
    });
    sent++;
  }
  const { data: waiting } = await db.from("profiles").select("id, discord_id").not("welcome_dm_at", "is", null).is("nudge_dm_at", null)
    .not("discord_id", "is", null).lt("created_at", iso(now - 864e5)).gt("created_at", iso(now - 4 * 864e5)).limit(10);
  for (const p of waiting || []) {
    const { count: runs } = await db.from("routine_runs").select("id", { count: "exact", head: true }).eq("user_id", p.id).eq("counted", true);
    const { count: days } = await db.from("training_days").select("day", { count: "exact", head: true }).eq("user_id", p.id).gt("routines", 0);
    await db.from("profiles").update({ nudge_dm_at: iso(now) }).eq("id", p.id).is("nudge_dm_at", null);
    if ((runs || 0) + (days || 0) > 0) continue;
    await dm(String(p.discord_id), {
      content: "Your bonus spin is still waiting. One routine, 30 minutes, and it's yours. Want a quick one?",
      components: [{ type: 1, components: [linkBtn("Start Quick: Aim", `${SITE}/#goal`), linkBtn("Open Repline", SITE)] }],
    });
    sent++;
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  let b: any = {}; try { b = await req.json(); } catch { /* ignore */ }
  if (b && b.test) return new Response(JSON.stringify(match(String(b.test)).map((f) => f.id)), { headers: { "Content-Type": "application/json" } });
  if (!b || !b.poll) return new Response("{}", { status: 400 });
  try {
    const out: any = await poll();
    try { out.welcome = await welcomeDms(); } catch (e) { console.log("welcome", e); }
    return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
  }
  catch (e) { console.log("poll", e); return new Response(JSON.stringify({ error: String(e) }), { status: 500 }); }
});
