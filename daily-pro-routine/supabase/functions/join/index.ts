// Adds a signed-in player to the Repline Discord server (scope guilds.join), right after Discord sign-in.
// The client sends its Supabase session (Authorization) and the Discord access token it just got.
// The token is used once for the join and is never stored. Then the bot sends a short welcome DM.
// Secrets: DISCORD_BOT_TOKEN. Deploy with verify_jwt = true.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BOT = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const GUILD = "1570385914096783381";
const API = "https://discord.com/api/v10";
const SITE = "https://repline.pages.dev";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ error: "method" }, 405);
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  if (!u || !u.user) return out({ error: "signed_out" }, 401);
  let body: any = {}; try { body = await req.json(); } catch { /* ignore */ }
  const token = typeof body.token === "string" ? body.token : "";
  if (!token || token.length > 200) return out({ error: "no_token" }, 400);
  // who is this Discord token for? It must be the same Discord account as the Repline profile.
  const me = await fetch(API + "/users/@me", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : null).catch(() => null);
  if (!me || !me.id) return out({ error: "discord_token" }, 400);
  const { data: prof } = await db.from("profiles").select("discord_id, discord_joined_at, username").eq("id", u.user.id).maybeSingle();
  if (!prof || String(prof.discord_id) !== String(me.id)) return out({ error: "mismatch" }, 403);
  const r = await fetch(`${API}/guilds/${GUILD}/members/${me.id}`, { method: "PUT", headers: { Authorization: `Bot ${BOT}`, "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token }) });
  if (r.status !== 201 && r.status !== 204) { console.log("join failed", r.status, (await r.text()).slice(0, 200)); return out({ error: "join_failed", status: r.status }, 502); }
  const first = !prof.discord_joined_at;
  if (first) await db.from("profiles").update({ discord_joined_at: new Date().toISOString() }).eq("id", u.user.id);
  if (first) {
    const ch = await fetch(API + "/users/@me/channels", { method: "POST", headers: { Authorization: `Bot ${BOT}`, "Content-Type": "application/json" }, body: JSON.stringify({ recipient_id: me.id }) }).then((x) => x.ok ? x.json() : null).catch(() => null);
    if (ch && ch.id) await fetch(`${API}/channels/${ch.id}/messages`, { method: "POST", headers: { Authorization: `Bot ${BOT}`, "Content-Type": "application/json" }, body: JSON.stringify({
      content: `You're in the Repline Discord${prof.username ? ", " + String(prof.username).slice(0, 40) : ""}! 🎉 Questions? Ask in #ask-a-question, the bot answers in seconds.`,
      components: [{ type: 1, components: [{ type: 2, style: 5, label: "Quick Start · 15 min", url: `${SITE}/#quick` }] }],
    }) }).catch(() => {});
  }
  return out({ ok: true, joined: r.status === 201, first });
});
