// Schlanker Client für Supabase Auth (GoTrue) und die Profil-Tabelle (PostgREST).
// Bewusst ohne Fremdbibliothek: nur fetch, Web Crypto und localStorage.
//
// Sicherheitsgrundsätze:
//  * Im Browser steckt nur der öffentliche Schlüssel (anon/publishable). Der Service-Role-Schlüssel gehört NIE hierher.
//  * Passwörter prüft und speichert ausschließlich der Auth-Server. Der Browser sendet sie nur per HTTPS an ihn.
//  * Discord-Anmeldung und -Verknüpfung laufen über Supabase Auth mit PKCE: Der Code-Verifier bleibt im Browser und wird nie in
//    einer URL übertragen. Ein fremder Rückkehr-Code lässt sich ohne diesen Verifier nicht einlösen (Schutz gegen CSRF und
//    untergeschobene Anmeldungen). Das Discord-Client-Secret liegt nur in Supabase, nie im Frontend.
//  * Ein Konto ist immer die interne Supabase-Nutzer-ID (UUID). Discord hängt als Identität mit der festen Discord-User-ID daran,
//    nicht mit dem änderbaren Discord-Namen.
//  * Alle Berechtigungen (eigene Profile, eindeutige Namen) setzt die Datenbank durch (siehe supabase/001_krevo_profiles.sql).
//    Der Browser zeigt nur an und fängt Fehler verständlich ab.
//  * Rohe Servertexte werden nicht angezeigt, nur kurze Fehlercodes (siehe mapAuthError).

import { validateUsername } from './username.js';

export const SESSION_KEY = 'fnc.v1.auth';
export const FLOW_KEY = 'fnc.v1.authFlow';

export class AuthError extends Error {
  constructor(code, { status = 0, detail = '' } = {}) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

// ---------- Fehler vereinheitlichen ----------

/** Wandelt eine Antwort von Auth-Server oder PostgREST in einen kurzen Fehlercode. */
export function mapAuthError(status, body) {
  const b = body && typeof body === 'object' ? body : {};
  const rawCode = String(b.error_code || (typeof b.code === 'string' ? b.code : '') || '').toLowerCase();
  const msg = String(b.msg || b.message || b.error_description || b.error || '').toLowerCase();

  // PostgREST / Postgres
  if (/^pgrst30[0-9]$/.test(rawCode) || (status === 401 && msg.includes('jwt'))) return 'session_expired';
  if (rawCode === '23505') return 'username_taken';
  if (rawCode === '23514') {
    if (msg.includes('estimated_qual')) return 'qual_invalid';
    if (msg.includes('username_reserved')) return 'username_reserved';
    return 'username_invalid';
  }
  if (msg.includes('no_valid_draft')) return 'no_valid_draft';
  if (rawCode === 'pgrst202' || rawCode === 'pgrst205' || rawCode === '42p01' || rawCode === '42883') return 'schema_missing';
  if (rawCode === '42501' || msg.includes('row-level security')) return 'forbidden';
  // Speicherdienst (Bilder): Größe und Dateityp prüft der Server noch einmal
  if (status === 413 || rawCode === '413' || msg.includes('exceeded the maximum allowed size') || msg.includes('payload too large')) return 'file_too_large';
  if (status === 415 || rawCode === '415' || rawCode === 'invalid_mime_type' || msg.includes('mime type')) return 'file_type';

  // Auth-Server
  if (rawCode === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'invalid_credentials';
  if (rawCode === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'email_not_confirmed';
  if (rawCode === 'user_already_exists' || rawCode === 'email_exists' || msg.includes('already registered')) return 'user_exists';
  if (rawCode === 'weak_password' || msg.includes('password should be at least') || msg.includes('weak password')) return 'weak_password';
  if (rawCode === 'same_password' || msg.includes('different from the old password')) return 'same_password';
  if (rawCode === 'signup_disabled' || msg.includes('signups not allowed')) return 'signup_disabled';
  if (rawCode === 'over_request_rate_limit' || rawCode === 'over_email_send_rate_limit' || status === 429) return 'rate_limited';
  if (rawCode === 'otp_expired' || rawCode === 'flow_state_expired' || rawCode === 'flow_state_not_found' || rawCode === 'bad_code_verifier'
      || msg.includes('expired') || msg.includes('invalid flow state')) return 'link_expired';
  if (rawCode === 'access_denied' || msg.includes('access_denied') || msg.includes('access denied')) return 'access_denied';
  if (rawCode === 'identity_already_exists' || msg.includes('identity is already linked')) return 'identity_taken';
  if (rawCode === 'manual_linking_disabled' || msg.includes('manual linking')) return 'linking_disabled';
  if (rawCode === 'single_identity_not_deletable' || msg.includes('only identity')) return 'last_identity';
  if (rawCode === 'provider_disabled' || msg.includes('provider is not enabled') || msg.includes('unsupported provider')) return 'provider_disabled';
  if (['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired'].includes(rawCode)
      || (b.error === 'invalid_grant' && msg.includes('refresh'))) return 'session_expired';
  if (rawCode === 'validation_failed' || rawCode === 'email_address_invalid' || msg.includes('unable to validate email')) {
    return msg.includes('email') ? 'invalid_email' : 'invalid_input';
  }
  if (status === 401 || status === 403) return 'forbidden';
  if (status >= 500) return 'server';
  return 'unknown';
}

// ---------- kleine Hilfen ----------

const b64url = (bytes) => {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export async function makePkce(cryptoApi) {
  if (!cryptoApi || !cryptoApi.subtle || !cryptoApi.getRandomValues) throw new AuthError('insecure_context');
  const raw = new Uint8Array(32);
  cryptoApi.getRandomValues(raw);
  const verifier = b64url(raw);
  const digest = new Uint8Array(await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge: b64url(digest) };
}

/** Liest die Rückkehr-Parameter nach Discord-Login, E-Mail-Link oder Fehler. Gibt null zurück, wenn nichts zu tun ist. */
export function parseReturn(loc) {
  const search = new URLSearchParams(loc.search || '');
  const hashRaw = String(loc.hash || '').replace(/^#/, '');
  const hash = hashRaw.includes('=') ? new URLSearchParams(hashRaw) : new URLSearchParams('');
  const pick = (k) => hash.get(k) || search.get(k) || '';
  if (pick('error') || pick('error_code')) {
    return { kind: 'error', code: pick('error_code') || pick('error'), description: pick('error_description'), fromHash: hash.has('error') || hash.has('error_code') };
  }
  if (hash.get('access_token') && hash.get('refresh_token')) {
    return {
      kind: 'tokens',
      access_token: hash.get('access_token'),
      refresh_token: hash.get('refresh_token'),
      expires_in: Number(hash.get('expires_in')) || 3600,
      type: hash.get('type') || '',
      fromHash: true,
    };
  }
  if (search.get('code')) return { kind: 'code', code: search.get('code'), fromHash: false };
  return null;
}

const looksLikeJwt = (k) => typeof k === 'string' && k.startsWith('eyJ');

/**
 * @param {object} o
 * @param {string} o.url            Projekt-URL, z. B. https://abcd.supabase.co
 * @param {string} o.anonKey        öffentlicher Schlüssel (anon JWT oder sb_publishable_…)
 * @param {object} o.storage        { get(key), set(key, value), remove(key) } (synchron, darf nie werfen)
 * @param {Function} [o.fetch]
 * @param {object} [o.location]     window.location
 * @param {object} [o.history]      window.history
 * @param {object} [o.crypto]
 * @param {object} [o.locks]        navigator.locks
 * @param {Function} [o.now]        () => Millisekunden
 */
export function createAuthClient(o) {
  const base = String(o.url || '').replace(/\/+$/, '');
  const anonKey = String(o.anonKey || '');
  const configured = /^https:\/\/[^/\s]+$/.test(base) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);
  const ok = configured && anonKey.length > 10;
  const doFetch = o.fetch || ((...a) => fetch(...a));
  const now = o.now || (() => Date.now());
  const storage = o.storage;
  const loc = o.location || { origin: '', pathname: '/', search: '', hash: '' };
  const hist = o.history || { replaceState() {} };
  const timeoutMs = o.timeoutMs || 15000;
  const listeners = new Set();
  const redirectUrl = () => `${loc.origin}${loc.pathname}`;

  let state = { status: ok ? 'loading' : 'out', session: null, profile: null, profileStatus: 'idle', configured: ok, returnError: null, returnType: '', isAdmin: null };
  let settingsPromise = null;
  let refreshTimer = null;
  let inflightRefresh = null;

  const emit = () => { const snap = { ...state }; listeners.forEach((fn) => { try { fn(snap); } catch { /* Anzeige darf nichts blockieren */ } }); };
  const setState = (patch) => { state = { ...state, ...patch }; emit(); };

  // ---------- Speicher ----------
  const readJson = (key) => { try { const raw = storage.get(key); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const writeJson = (key, v) => { try { storage.set(key, JSON.stringify(v)); } catch { /* ohne Speicher gilt die Sitzung nur bis zum Schließen */ } };
  function readSession() {
    const s = readJson(SESSION_KEY);
    if (!s || typeof s.access_token !== 'string' || typeof s.refresh_token !== 'string' || typeof s.expires_at !== 'number' || !s.user || typeof s.user.id !== 'string') return null;
    return s;
  }
  const writeSession = (s) => writeJson(SESSION_KEY, s);
  const clearSession = () => { try { storage.remove(SESSION_KEY); } catch { /* ignorieren */ } };
  const nowSec = () => Math.floor(now() / 1000);
  const expiresSoon = (s, margin = 60) => s.expires_at - nowSec() <= margin;

  function toSession(body) {
    if (!body || typeof body.access_token !== 'string' || typeof body.refresh_token !== 'string' || !body.user) throw new AuthError('unknown', { detail: 'bad session body' });
    const expires_at = typeof body.expires_at === 'number' ? body.expires_at : nowSec() + (Number(body.expires_in) || 3600);
    return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at, user: body.user };
  }

  // ---------- HTTP ----------
  async function http(path, { method = 'GET', query, body, token, prefer, signal, rawBody, contentType, extraHeaders, timeout } = {}) {
    if (!ok) throw new AuthError('not_configured');
    const qs = query ? '?' + Object.entries(query).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
    const headers = { apikey: anonKey, Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (looksLikeJwt(anonKey)) headers.Authorization = `Bearer ${anonKey}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (rawBody !== undefined && contentType) headers['Content-Type'] = contentType; // FormData: Typ und Trennzeichen setzt der Browser
    if (extraHeaders) Object.assign(headers, extraHeaders);
    if (prefer) headers.Prefer = prefer;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeout || timeoutMs) : null;
    let res;
    try {
      res = await doFetch(base + path + qs, { method, headers, body: rawBody !== undefined ? rawBody : (body !== undefined ? JSON.stringify(body) : undefined), signal: signal || (ctl && ctl.signal), credentials: 'omit' });
    } catch {
      throw new AuthError('network');
    } finally {
      if (timer) clearTimeout(timer);
    }
    let data = null;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null; // z. B. HTML-Fehlerseite eines Proxys
    }
    if (!res.ok) throw new AuthError(mapAuthError(res.status, data), { status: res.status, detail: data && (data.message || data.msg || data.error_description || '') });
    return data;
  }

  // ---------- Einstellungen des Projekts ----------
  function settings() {
    if (!ok) return Promise.resolve(null);
    if (!settingsPromise) {
      settingsPromise = http('/auth/v1/settings').then((s) => ({
        discord: !!(s && s.external && s.external.discord),
        email: !s || !s.external || s.external.email !== false,
        autoconfirm: !!(s && s.mailer_autoconfirm),
        signupDisabled: !!(s && s.disable_signup),
      })).catch(() => { settingsPromise = null; return null; });
    }
    return settingsPromise;
  }

  // ---------- Sitzung ----------
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    const s = readSession();
    if (!s || typeof setTimeout !== 'function') return;
    const wait = Math.min(Math.max((s.expires_at - nowSec() - 60) * 1000, 5000), 6 * 3600 * 1000);
    refreshTimer = setTimeout(() => { refreshSession().catch(() => {}); }, wait);
    if (refreshTimer && refreshTimer.unref) refreshTimer.unref();
  }

  // Eine Sitzung aus dem Passwort-Reset-Link wird als solche gemerkt (recovery), bis ein neues Passwort gesetzt ist,
  // auch wenn die Seite dazwischen neu geladen wird.
  function adopt(session, status = 'in', extra = {}) {
    const { recovery, ...clean } = session;
    const persisted = status === 'recovery' ? { ...clean, recovery: true } : clean;
    writeSession(persisted);
    const sameUser = state.session && state.session.user && persisted.user && state.session.user.id === persisted.user.id;
    setState({ status, session: persisted, ...(sameUser ? {} : { isAdmin: null }), ...extra });
    scheduleRefresh();
  }

  function dropSession(extra = {}) {
    clearTimeout(refreshTimer);
    clearSession();
    setState({ status: 'out', session: null, profile: null, profileStatus: 'idle', isAdmin: null, ...extra });
  }

  async function withLock(fn) {
    const locks = o.locks;
    if (locks && typeof locks.request === 'function') return locks.request('fnc.v1.auth-refresh', fn);
    return fn();
  }

  /** Erneuert den Token. Parallele Aufrufe (auch aus anderen Tabs) teilen sich eine Anfrage. */
  function refreshSession() {
    if (inflightRefresh) return inflightRefresh;
    inflightRefresh = withLock(async () => {
      const cur = readSession();
      if (!cur) throw new AuthError('session_expired');
      if (!expiresSoon(cur, 10)) { // ein anderer Tab war schneller
        if (!state.session || state.session.access_token !== cur.access_token) setState({ status: cur.recovery ? 'recovery' : 'in', session: cur });
        return cur;
      }
      try {
        const body = await http('/auth/v1/token', { method: 'POST', query: { grant_type: 'refresh_token' }, body: { refresh_token: cur.refresh_token } });
        const fresh = toSession(body);
        adopt(fresh, cur.recovery ? 'recovery' : 'in');
        return fresh;
      } catch (e) {
        if (e instanceof AuthError && e.code !== 'network' && e.code !== 'server' && e.code !== 'rate_limited') {
          dropSession();
          throw new AuthError('session_expired');
        }
        throw e; // Netzwerkfehler: Sitzung bleibt erhalten, später erneut versuchen
      }
    }).finally(() => { inflightRefresh = null; });
    return inflightRefresh;
  }

  async function freshToken() {
    let s = readSession();
    if (!s) throw new AuthError('not_signed_in');
    if (expiresSoon(s, 15)) {
      try { s = await refreshSession(); } catch (e) { if (e.code === 'network' && s.expires_at > nowSec()) return s.access_token; throw e; }
    }
    return s.access_token;
  }

  /** Anfrage mit dem Token des angemeldeten Nutzers (erneuert ihn bei Bedarf einmal selbst). */
  async function authed(fullPath, opts = {}) {
    let token = await freshToken();
    try {
      return await http(fullPath, { ...opts, token });
    } catch (e) {
      if (e instanceof AuthError && e.code === 'session_expired') { // Token war abgelaufen: einmal erneuern, einmal wiederholen
        const cur = readSession();
        if (cur) { try { cur.expires_at = 0; writeSession(cur); token = (await refreshSession()).access_token; } catch (e2) { throw e2; } }
        return http(fullPath, { ...opts, token });
      }
      throw e;
    }
  }
  const rest = (path, opts) => authed('/rest/v1' + path, opts);

  // ---------- Rückkehr von Discord / E-Mail-Link ----------
  function cleanUrl(ret) {
    try {
      const search = new URLSearchParams(loc.search || '');
      ['code', 'error', 'error_code', 'error_description'].forEach((k) => search.delete(k));
      const rest = search.toString();
      hist.replaceState(null, '', loc.pathname + (rest ? `?${rest}` : ''));
    } catch { /* nur Kosmetik */ }
  }

  async function handleReturn(ret) {
    cleanUrl(ret);
    if (ret.kind === 'error') {
      const code = mapAuthError(400, { error_code: ret.code, error_description: ret.description });
      setState({ returnError: new AuthError(code === 'unknown' ? 'oauth_failed' : code, { detail: ret.description }) });
      return false;
    }
    if (ret.kind === 'tokens') {
      const user = await http('/auth/v1/user', { token: ret.access_token }); // prüft den Token beim Server
      const session = { access_token: ret.access_token, refresh_token: ret.refresh_token, expires_at: nowSec() + ret.expires_in, user };
      adopt(session, ret.type === 'recovery' ? 'recovery' : 'in', { returnType: ret.type });
      return true;
    }
    if (ret.kind === 'code') {
      const flow = readJson(FLOW_KEY);
      try { storage.remove(FLOW_KEY); } catch { /* ignorieren */ }
      if (!flow || !flow.verifier || now() - (flow.ts || 0) > 15 * 60 * 1000) throw new AuthError('flow_missing');
      const body = await http('/auth/v1/token', { method: 'POST', query: { grant_type: 'pkce' }, body: { auth_code: ret.code, code_verifier: flow.verifier } });
      const session = toSession(body);
      // Verknüpfen darf nie das Konto wechseln: Die Rückkehr muss zum selben internen Konto gehören wie beim Start.
      if (flow.intent === 'link' && (!session.user || session.user.id !== flow.uid)) throw new AuthError('link_mismatch');
      adopt(session, 'in', { returnType: flow.intent === 'link' ? 'link' : 'oauth' });
      return true;
    }
    return false;
  }

  async function init() {
    if (!ok) { setState({ status: 'out' }); return state; }
    const ret = parseReturn(loc);
    let handled = false;
    if (ret) {
      try { handled = await handleReturn(ret); } catch (e) { setState({ returnError: e instanceof AuthError ? e : new AuthError('unknown') }); }
    }
    if (!handled) {
      const s = readSession();
      if (!s) setState({ status: 'out' });
      else if (!expiresSoon(s, 30)) { setState({ status: s.recovery ? 'recovery' : 'in', session: s }); scheduleRefresh(); }
      else {
        try { await refreshSession(); }
        catch (e) {
          // Netzwerk-, Server- oder Limit-Fehler: Sitzung behalten und später erneut versuchen. Sonst ist sie ungültig.
          if (e.code === 'network' || e.code === 'server' || e.code === 'rate_limited') { setState({ status: s.recovery ? 'recovery' : 'in', session: s }); scheduleRefresh(); }
          else setState({ status: 'out' });
        }
      }
    }
    if (typeof addEventListener === 'function' && o.listenGlobal !== false) {
      addEventListener('storage', (e) => { if (e.key === SESSION_KEY) syncFromStorage(); });
      addEventListener('online', () => { const s = readSession(); if (s && expiresSoon(s, 60)) refreshSession().catch(() => {}); });
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden) { const s = readSession(); if (s && expiresSoon(s, 60)) refreshSession().catch(() => {}); } });
    }
    return state;
  }

  function syncFromStorage() { // anderer Tab hat sich an- oder abgemeldet
    const s = readSession();
    if (!s && state.session) { clearTimeout(refreshTimer); setState({ status: 'out', session: null, profile: null, profileStatus: 'idle', isAdmin: null }); }
    else if (s && (!state.session || state.session.access_token !== s.access_token)) { setState({ status: s.recovery ? 'recovery' : 'in', session: s }); scheduleRefresh(); }
  }

  // ---------- Aktionen ----------
  async function signUp({ email, password, username }) {
    const data = username ? { username } : undefined;
    const body = await http('/auth/v1/signup', { method: 'POST', query: { redirect_to: redirectUrl() }, body: { email, password, data } });
    if (body && body.access_token) {
      adopt(toSession(body), 'in', { returnType: '' }); // direkte Registrierung ohne E-Mail-Bestätigung ist keine "Rückkehr"
      return { status: 'signed_in', requestedUsername: username || '' };
    }
    return { status: 'confirm_email' };
  }

  async function signIn({ email, password }) {
    const body = await http('/auth/v1/token', { method: 'POST', query: { grant_type: 'password' }, body: { email, password } });
    adopt(toSession(body), 'in');
    return state;
  }

  async function startDiscordFlow(intent) {
    const s = await settings();
    if (!s) throw new AuthError('network'); // Projekt nicht erreichbar: nicht auf eine tote Adresse weiterleiten
    if (!s.discord) throw new AuthError('provider_disabled');
    const { verifier, challenge } = await makePkce(o.crypto || (typeof crypto !== 'undefined' ? crypto : null));
    let url;
    if (intent === 'link') {
      const token = await freshToken();
      const cur = readSession();
      writeJson(FLOW_KEY, { verifier, ts: now(), intent, uid: cur.user.id });
      try {
        // Supabase liefert die Discord-Adresse nur für den angemeldeten Nutzer (Bearer-Token) und hängt die Identität an genau dieses Konto
        const res = await http('/auth/v1/user/identities/authorize', {
          token, query: { provider: 'discord', skip_http_redirect: 'true', redirect_to: redirectUrl(), code_challenge: challenge, code_challenge_method: 's256' },
        });
        // Nur echte Weiterleitungsziele annehmen: HTTPS (Discord) oder die eigene Supabase-Adresse
        if (!res || typeof res.url !== 'string' || !(/^https:\/\//.test(res.url) || res.url.startsWith(`${base}/`))) throw new AuthError('server');
        url = res.url;
      } catch (e) {
        try { storage.remove(FLOW_KEY); } catch { /* ignorieren */ }
        throw e;
      }
    } else {
      writeJson(FLOW_KEY, { verifier, ts: now(), intent: 'signin' });
      url = `${base}/auth/v1/authorize?provider=discord&redirect_to=${encodeURIComponent(redirectUrl())}&code_challenge=${challenge}&code_challenge_method=s256`;
    }
    if (o.navigate) o.navigate(url); else loc.assign(url);
  }

  /** Anmelden oder Registrieren mit Discord (verlässt die Seite). */
  const signInWithDiscord = () => startDiscordFlow('signin');
  /** Discord mit dem angemeldeten KREVO-Konto verbinden (verlässt die Seite). */
  async function linkDiscord() {
    if (!readSession()) throw new AuthError('not_signed_in');
    return startDiscordFlow('link');
  }

  /** Verknüpfte Anmeldewege des Kontos. Discord wird über die feste Discord-User-ID erkannt, angezeigt wird nur der Name. */
  function identities() {
    const s = readSession();
    const list = (s && s.user && Array.isArray(s.user.identities)) ? s.user.identities : [];
    return list.map((i) => {
      const d = (i && i.identity_data) || {};
      return {
        id: String(i.identity_id || i.id || ''),
        provider: String(i.provider || ''),
        name: i.provider === 'discord' ? String((d.custom_claims && d.custom_claims.global_name) || d.full_name || d.name || '') : '',
      };
    });
  }

  async function refreshUser() {
    const token = await freshToken();
    const user = await http('/auth/v1/user', { token });
    const s = readSession();
    if (s && user && user.id === s.user.id) adopt({ ...s, user }, 'in', { returnType: state.returnType });
    return user;
  }

  /** Discord trennen. Nur möglich, wenn noch ein anderer Anmeldeweg bleibt (prüft auch der Auth-Server). */
  async function unlinkDiscord() {
    const all = identities();
    const d = all.find((i) => i.provider === 'discord');
    if (!d) return;
    if (all.length < 2) throw new AuthError('last_identity');
    const token = await freshToken();
    await http(`/auth/v1/user/identities/${encodeURIComponent(d.id)}`, { method: 'DELETE', token });
    await refreshUser();
  }

  async function signOut() {
    const s = readSession();
    if (s) { try { await http('/auth/v1/logout', { method: 'POST', query: { scope: 'local' }, token: s.access_token }); } catch { /* lokal abmelden genügt */ } }
    dropSession({ returnType: '' });
  }

  async function requestPasswordReset(email) {
    await http('/auth/v1/recover', { method: 'POST', query: { redirect_to: redirectUrl() }, body: { email } });
  }

  async function updatePassword(password) {
    const token = await freshToken();
    const user = await http('/auth/v1/user', { method: 'PUT', token, body: { password } });
    const s = readSession();
    if (s) adopt({ ...s, user: user && user.id ? user : s.user }, 'in', { returnType: '' });
  }

  // ---------- Profil ----------
  async function loadProfile() {
    const s = readSession();
    if (!s) { setState({ profile: null, profileStatus: 'idle' }); return null; }
    setState({ profileStatus: 'loading' });
    try {
      const select = () => rest('/profiles', { query: { select: 'id,username,created_at', id: `eq.${s.user.id}` } });
      let rows = await select();
      if (!Array.isArray(rows) || rows.length === 0) {
        await rest('/rpc/ensure_profile', { method: 'POST', body: {} });
        rows = await select();
      }
      const profile = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (!profile) throw new AuthError('profile_missing');
      setState({ profile, profileStatus: 'ready' });
      return profile;
    } catch (e) {
      setState({ profile: null, profileStatus: 'error', profileError: e instanceof AuthError ? e.code : 'unknown' });
      throw e;
    }
  }

  /** Vorabprüfung für das Formular. Endgültig entscheidet die Datenbank beim Speichern. */
  async function checkUsername(name) {
    const v = validateUsername(name);
    if (!v.ok) return v.code === 'reserved' ? 'reserved' : 'invalid';
    const body = { candidate: v.value };
    // Mit Sitzung über rest(): erneuert abgelaufene Token selbst. Ohne Sitzung (Registrierung) mit dem öffentlichen Schlüssel.
    const res = readSession()
      ? await rest('/rpc/username_available', { method: 'POST', body })
      : await http('/rest/v1/rpc/username_available', { method: 'POST', body });
    return ['available', 'taken', 'invalid', 'reserved'].includes(res) ? res : 'invalid';
  }

  async function updateUsername(name) {
    const v = validateUsername(name);
    if (!v.ok) throw new AuthError(v.code === 'reserved' ? 'username_reserved' : 'username_invalid');
    const s = readSession();
    if (!s) throw new AuthError('not_signed_in');
    const rows = await rest('/profiles', { method: 'PATCH', query: { id: `eq.${s.user.id}` }, body: { username: v.value }, prefer: 'return=representation' });
    if (!Array.isArray(rows) || rows.length === 0) throw new AuthError('profile_missing');
    setState({ profile: { ...state.profile, ...rows[0] }, profileStatus: 'ready' });
    return rows[0];
  }

  // ---------- Administrator ----------
  /**
   * Fragt die Datenbank, ob dieses Konto Administrator ist. Das Ergebnis dient nur dazu, den Zugang anzuzeigen oder zu verbergen:
   * Die eigentliche Prüfung passiert bei jeder Änderung noch einmal in der Datenbank (is_admin() in den Zugriffsregeln).
   */
  async function checkAdmin() {
    const s = readSession();
    if (!s) { setState({ isAdmin: false }); return false; }
    const uid = s.user.id;
    try {
      const res = await rest('/rpc/is_admin', { method: 'POST', body: {} });
      const yes = res === true;
      if (readSession() && readSession().user.id === uid) setState({ isAdmin: yes });
      return yes;
    } catch {
      if (readSession() && readSession().user.id === uid) setState({ isAdmin: false }); // bei Fehlern: kein Zugang anzeigen
      return false;
    }
  }

  const BUCKET_RE = /^[a-z0-9-]+$/;
  const OBJECT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
  /** Öffentliche Adresse einer Bilddatei (nur gültige Namen, sonst null). */
  function publicFileUrl(bucket, name) {
    if (!ok || !BUCKET_RE.test(bucket) || !OBJECT_RE.test(name)) return null;
    return `${base}/storage/v1/object/public/${bucket}/${name}`;
  }
  /**
   * Lädt eine Datei in den Speicher (wie supabase-js: multipart/form-data). Die Zugriffsregeln der Datenbank lassen das nur
   * für Administratoren zu; Größe und Dateityp prüft der Speicherdienst noch einmal. Vorhandene Dateien werden nie überschrieben.
   */
  async function uploadFile(bucket, name, blob, contentType) {
    if (!BUCKET_RE.test(bucket) || !OBJECT_RE.test(name)) throw new AuthError('invalid_input');
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', blob.type === contentType ? blob : new Blob([blob], { type: contentType }));
    return authed(`/storage/v1/object/${bucket}/${name}`, { method: 'POST', rawBody: form, extraHeaders: { 'x-upsert': 'false' }, timeout: 60000 });
  }
  async function deleteFile(bucket, name) {
    if (!BUCKET_RE.test(bucket) || !OBJECT_RE.test(name)) throw new AuthError('invalid_input');
    return authed(`/storage/v1/object/${bucket}/${name}`, { method: 'DELETE' });
  }

  return {
    get configured() { return ok; },
    get state() { return state; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    init, settings, signUp, signIn, signInWithDiscord, linkDiscord, unlinkDiscord, identities, refreshUser, signOut, requestPasswordReset, updatePassword,
    loadProfile, checkUsername, updateUsername, refreshSession,
    checkAdmin, rest, publicFileUrl, uploadFile, deleteFile,
    clearReturn() { setState({ returnError: null, returnType: '' }); },
  };
}

/** Sicherer Speicher-Adapter: localStorage, bei Fehlern (privater Modus) nur im Arbeitsspeicher. */
export function makeStorage() {
  const mem = new Map();
  let ls = null;
  try { ls = globalThis.localStorage; ls.setItem('fnc.probe', '1'); ls.removeItem('fnc.probe'); } catch { ls = null; }
  return {
    get(k) { try { return ls ? ls.getItem(k) : (mem.get(k) ?? null); } catch { return mem.get(k) ?? null; } },
    set(k, v) { try { if (ls) { ls.setItem(k, v); return; } } catch { /* Rückfall */ } mem.set(k, v); },
    remove(k) { try { if (ls) ls.removeItem(k); } catch { /* ignorieren */ } mem.delete(k); },
  };
}
