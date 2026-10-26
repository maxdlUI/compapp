// Team-Modus für Net Damage: Oberfläche (Dialog, Teamübersicht) und Anbindung an den bestehenden Tracker.
//
// Der Solo-Tracker bleibt unverändert. Im Team-Modus benutzt derselbe Tracker (Felder, Buttons, Rückgängig, Reset) die eigenen
// Team-Werte; die Solo-Werte bleiben im Speicher des Geräts unangetastet und kommen nach dem Verlassen des Teams zurück.
//
// Wichtig: Diese Datei zeigt nur an und schickt Anfragen mit dem Token des angemeldeten Nutzers. Wer in welchem Team ist und wer
// welche Werte ändern darf, entscheidet bei JEDER Anfrage die Datenbank (supabase/003_krevo_team_net_damage.sql).

import { t, getLocale, onLanguageChange } from './i18n.js';
import { errorKey } from './auth-ui.js';
import { computeNet } from './logic.js';
import {
  createTeamApi, parseInvite, inviteLink, inviteFromSearch, searchWithoutInvite, summarize, rosterRows, withOwn, ownRow,
  describeSurge, teamErrorKey, TEAM_SIZES,
} from './team.js';
import { createTeamSync } from './team-sync.js';

export const INVITE_KEY = 'fnc.v1.teamInvite';   // Einladung, die auf die Anmeldung wartet (höchstens 24 Stunden)
const INVITE_MAX_AGE_MS = 24 * 3600 * 1000;

/**
 * @param {object} o
 * @param {object} o.auth      Auth-Client
 * @param {object} o.net       Anbindung an den Tracker (app.js): enterTeam, leaveTeam, setValues, values, onChange
 * @param {Function} o.openAccount  öffnet den Konto-Dialog (Anmeldung)
 */
export function initTeam({ auth, net, openAccount = () => {}, doc = document, win = window }) {
  const $ = (id) => doc.getElementById(id);
  const dlg = $('team-dialog');
  const chip = $('team-open');
  const panel = $('team-panel');
  if (!dlg || !chip || !panel || !auth.configured) return null;

  const els = {
    chip, panel, me: $('team-me'), surge: $('team-surge'), surgeValue: $('team-surge-value'), surgeMeta: $('team-surge-meta'),
    conn: $('team-conn'), roster: $('team-roster'), copy: $('team-copy'), leave: $('team-leave'), end: $('team-end'),
    link: $('team-link'), note: $('team-note'),
    title: $('tm-title'), close: $('tm-close'),
    vAccount: $('tm-view-account'), vStart: $('tm-view-start'), vInvite: $('tm-view-invite'),
    signin: $('tm-signin'), size: $('tm-size'), create: $('tm-create'), linkInput: $('tm-link-input'), join: $('tm-join'),
    inviteInfo: $('tm-invite-info'), inviteLead: $('tm-invite-lead'), inviteJoin: $('tm-invite-join'), inviteCancel: $('tm-invite-cancel'),
    status: $('tm-status'), error: $('tm-error'),
  };
  const api = createTeamApi(auth.rest);

  let userId = null;          // Konto, für das gerade Zustand gehalten wird
  let sync = null;            // laufender Abgleich (nur im Team)
  let code = null;            // Kennung der laufenden Session
  let selectedSize = 2;
  let busy = false;
  let invite = null;          // { code, preview } – Einladung aus einem Link, wartet auf Bestätigung
  let confirming = null;      // 'leave' | 'end'
  let confirmTimer = null;
  let noteTimer = null;
  let note = null;            // { key, params, kind }
  let online = true;
  let rosterSig = '';
  let dlgError = null;        // { key, params }
  let dlgStatus = null;       // { key }
  let keepOnClose = false;    // Einladung beim Schließen des Dialogs behalten (Weg zur Anmeldung)
  let inviteOffered = false;  // die Einladung aus der Adresse wird pro Seitenaufruf nur einmal angeboten

  const store = {
    get() { try { return win.localStorage.getItem(INVITE_KEY); } catch { return null; } },
    set(v) { try { win.localStorage.setItem(INVITE_KEY, v); } catch { /* Speicher gesperrt: Einladung gilt nur für diese Seite */ } },
    del() { try { win.localStorage.removeItem(INVITE_KEY); } catch { /* egal */ } },
  };
  const savedInvite = () => {
    try {
      const v = JSON.parse(store.get() || 'null');
      return v && typeof v.code === 'string' && Date.now() - Number(v.at) < INVITE_MAX_AGE_MS ? parseInvite(v.code) : null;
    } catch { return null; }
  };
  const rememberInvite = (c) => store.set(JSON.stringify({ code: c, at: Date.now() }));

  const authState = () => auth.state;
  const signedIn = () => authState().status === 'in';
  const ownName = () => {
    const s = authState();
    return (s.profile && s.profile.username) || (s.session && s.session.user && s.session.user.user_metadata && s.session.user.user_metadata.username) || '';
  };

  // ---------------------------------------------------------------- Anzeige: Teamübersicht
  const view = () => {
    if (!sync) return null;
    const v = sync.view();
    if (!v.state) return null;
    return v.pending ? withOwn(v.state, v.pending.dealt, v.pending.taken) : v.state;
  };

  function setNote(next, ms = 0) {
    note = next;
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = null;
    if (next && ms) noteTimer = setTimeout(() => { note = null; renderNote(); }, ms);
    renderNote();
  }
  function renderNote() {
    if (!note) { els.note.hidden = true; els.note.textContent = ''; return; }
    els.note.hidden = false;
    els.note.dataset.kind = note.kind || '';
    const text = note.text || t(note.key, note.params);
    if (els.note.textContent !== text) els.note.textContent = text;
  }

  function render() {
    const st = view();
    const active = !!sync && !!st;
    els.panel.hidden = !active;
    els.chip.hidden = active;
    els.me.hidden = !active;
    if (!active) { rosterSig = ''; renderNote(); return; }
    const locale = getLocale();
    const sum = summarize(st);
    const surge = describeSurge(sum.surge, locale);
    els.surge.dataset.kind = surge.kind;
    els.surge.dataset.complete = String(sum.complete);
    setText(els.surgeValue, surge.text);
    setText(els.surgeMeta, t('team.surgeMeta', { counted: sum.counted, size: sum.size }));
    setText(els.me, t('team.yours', { name: (ownRow(st) && ownRow(st).name) || ownName() }));
    els.conn.hidden = online;
    if (!online) setText(els.conn, t('team.offline'));

    const rows = rosterRows(st, locale);
    const me = ownRow(st);
    const sig = JSON.stringify([rows, locale]);
    if (sig !== rosterSig) {
      rosterSig = sig;
      els.roster.replaceChildren(...rows.map((r) => {
        const li = doc.createElement('li');
        li.dataset.kind = r.kind;
        if (r.kind === 'free') {
          li.dataset.me = 'false';
          const name = doc.createElement('span');
          name.className = 'team-name';
          name.textContent = t('team.free');
          const val = doc.createElement('span');
          val.className = 'team-val';
          val.textContent = '·';
          val.setAttribute('aria-hidden', 'true');
          li.append(name, val);
          return li;
        }
        li.dataset.me = String(r.me);
        li.dataset.tone = r.tone;
        const left = doc.createElement('span');
        left.className = 'team-who';
        const name = doc.createElement('span');
        name.className = 'team-name';
        name.textContent = r.name;
        left.append(name);
        if (r.me) { const tag = doc.createElement('span'); tag.className = 'team-tag team-tag-me'; tag.textContent = t('team.you'); left.append(tag); }
        if (r.leader) { const tag = doc.createElement('span'); tag.className = 'team-tag'; tag.textContent = t('team.lead'); left.append(tag); }
        const sub = doc.createElement('span');
        sub.className = 'team-sub';
        sub.textContent = r.initialized ? r.detail : t('team.noValues');
        const val = doc.createElement('span');
        val.className = 'team-val';
        val.textContent = r.text;
        const info = doc.createElement('span');
        info.className = 'team-info';
        info.append(left, sub);
        li.append(info, val);
        return li;
      }));
    }
    const isLeader = !!(me && me.leader);
    els.end.hidden = !isLeader;
    setText(els.leave.querySelector('span'), confirming === 'leave' ? t('team.confirmLeave') : t('team.leave'));
    setText(els.end.querySelector('span'), confirming === 'end' ? t('team.confirmEnd') : t('team.end'));
    els.leave.dataset.confirm = String(confirming === 'leave');
    els.end.dataset.confirm = String(confirming === 'end');
  }
  function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }

  // ---------------------------------------------------------------- Sitzung betreten und verlassen
  function enterSession(state) {
    if (sync) { sync.stop(); sync = null; }
    code = state.code;
    net.enterTeam();
    online = true;
    confirming = null;
    els.link.hidden = true;
    setNote(null);   // Hinweise der vorigen Session (beendet, abgelaufen …) gehören nicht in die neue
    sync = createTeamSync({
      api, code: state.code, isVisible: () => !doc.hidden,
      onState: () => render(),
      onOwn: (own) => net.setValues(own.initialized && own.dealt ? String(own.dealt) : '', own.initialized && own.taken ? String(own.taken) : ''),
      onStatus: (s) => { online = s === 'online'; render(); },
      onNote: (kind) => setNote({ key: kind === 'conflict' ? 'team.note.conflict' : 'team.note.rejected', kind: 'warn' }, 8000),
      onEnded: (reason, last) => exitSession(reason, { last }),
    });
    sync.start(state);
    render();
  }

  function exitSession(reason, { last = null } = {}) {
    const wasCode = code;
    if (sync) { sync.stop(); sync = null; }
    code = null;
    confirming = null;
    if (confirmTimer) clearTimeout(confirmTimer);
    net.leaveTeam();
    online = true;
    render();
    if (reason === 'ended' || reason === 'expired') {
      setNote({ key: reason === 'expired' ? 'team.note.expired' : 'team.note.ended', kind: 'warn' }, 10000);
      if (wasCode) api.leave(wasCode).catch(() => {}); // beendete Sessions aufräumen (Fehler sind egal)
    } else if (reason === 'left') {
      setNote({ key: 'team.note.left', kind: 'warn' }, 10000);
    } else {
      setNote(null);
    }
    void last;
  }

  // ---------------------------------------------------------------- Dialog
  function showView(name) {
    els.vAccount.hidden = name !== 'account';
    els.vStart.hidden = name !== 'start';
    els.vInvite.hidden = name !== 'invite';
  }
  function renderDialog() {
    els.error.hidden = !dlgError;
    if (dlgError) setText(els.error, dlgError.text || t(dlgError.key, dlgError.params));
    els.status.hidden = !dlgStatus;
    if (dlgStatus) setText(els.status, t(dlgStatus.key));
    els.size.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.size) === selectedSize)));
    els.create.disabled = busy;
    els.join.disabled = busy;
    els.inviteJoin.disabled = busy || !invite || !invite.preview || invite.full;
    if (invite && invite.preview) {
      const p = invite.preview;
      setText(els.inviteInfo, t('team.invite.info', { kind: t(p.size === TEAM_SIZES.trio ? 'team.trio' : 'team.duo'), filled: p.filled, size: p.size }));
      els.inviteLead.hidden = !p.leader;
      if (p.leader) setText(els.inviteLead, t('team.invite.lead', { name: p.leader }));
    } else {
      setText(els.inviteInfo, invite ? t('team.loading') : '');
      els.inviteLead.hidden = true;
    }
  }
  function setError(keyOrErr) {
    dlgError = keyOrErr ? { key: keyOrErr.key, params: keyOrErr.params } : null;
    renderDialog();
  }
  /** Fehlerobjekt (Datenbank-Code oder Netzwerkfehler) → Anzeige im Dialog */
  function errorFrom(e) {
    const c = e && e.code;
    return { key: teamErrorKey(c) || errorKey(c) };
  }

  function openDialog() {
    if (!dlg.open) { try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); } }
    setTimeout(() => els.title.focus({ preventScroll: true }), 0);
  }
  function closeDialog() {
    if (dlg.open) { try { dlg.close(); } catch { dlg.removeAttribute('open'); } }
  }
  function afterClose() {
    invite = null;
    dlgError = null;
    dlgStatus = null;
    busy = false;
    if (!keepOnClose) store.del();   // eine geschlossene Einladung wird nicht beim nächsten Start wieder angeboten
    keepOnClose = false;
    renderDialog();
  }

  async function openStart() {
    setError(null);
    dlgStatus = null;
    if (!signedIn()) { showView('account'); renderDialog(); openDialog(); return; }
    showView('start');
    renderDialog();
    openDialog();
  }

  async function showInvite(c) {
    invite = { code: c, preview: null, full: false };
    dlgError = null;
    showView(signedIn() ? 'invite' : 'account');
    renderDialog();
    openDialog();
    if (!signedIn()) { rememberInvite(c); return; }
    busy = true;
    renderDialog();
    try {
      const res = await api.preview(c);
      if (!invite || invite.code !== c) return;
      if (!res.ok) { invite.preview = null; busy = false; setError({ key: teamErrorKey(res.error) || 'team.err.server' }); showView('start'); return; }
      const p = res.preview;
      if (p.joined) { busy = false; closeDialog(); store.del(); const r = await api.join(c); if (r.ok) enterSession(r.state); return; }
      if (p.status !== 'open') { busy = false; setError({ key: p.status === 'expired' ? 'team.err.team_expired' : 'team.err.team_ended' }); invite = null; showView('start'); return; }
      invite.preview = p;
      invite.full = p.filled >= p.size;
      busy = false;
      if (invite.full) setError({ key: 'team.err.team_full' });
      renderDialog();
    } catch (e) {
      busy = false;
      invite = null;
      showView('start');
      setError(errorFrom(e));
    }
  }

  async function doCreate() {
    if (busy) return;
    busy = true;
    dlgStatus = { key: 'team.creating' };
    setError(null);
    try {
      const res = await api.create(selectedSize);
      if (res.ok) { busy = false; dlgStatus = null; closeDialog(); enterSession(res.state); return; }
      if (res.error === 'already_in_team') { await restoreExisting(); return; }
      setError({ key: teamErrorKey(res.error) || 'team.err.server' });
    } catch (e) { setError(errorFrom(e)); }
    busy = false;
    dlgStatus = null;
    renderDialog();
  }

  async function doJoin(c) {
    if (busy) return;
    busy = true;
    dlgStatus = { key: 'team.joining' };
    setError(null);
    try {
      const res = await api.join(c);
      if (res.ok) { busy = false; dlgStatus = null; store.del(); closeDialog(); enterSession(res.state); return; }
      if (res.error === 'already_in_team') { await restoreExisting(); return; }
      setError({ key: teamErrorKey(res.error) || 'team.err.server' });
    } catch (e) { setError(errorFrom(e)); }
    busy = false;
    dlgStatus = null;
    renderDialog();
  }

  /** Das Konto ist schon in einer Session (z. B. in einem anderen Tab gestartet): dorthin wechseln. */
  async function restoreExisting() {
    try {
      const res = await api.mine();
      busy = false;
      dlgStatus = null;
      if (res.ok && res.state) { store.del(); closeDialog(); enterSession(res.state); setNote({ key: 'team.err.already_in_team', kind: 'warn' }, 8000); return; }
      setError({ key: 'team.err.already_in_team' });
    } catch (e) { busy = false; dlgStatus = null; setError(errorFrom(e)); }
    renderDialog();
  }

  // ---------------------------------------------------------------- Konto
  async function onAuth(s) {
    if (s.status === 'in' && s.session && s.session.user) {
      const id = s.session.user.id;
      if (id === userId) return;
      userId = id;
      if (sync) { sync.stop(); sync = null; net.leaveTeam(); code = null; render(); } // anderes Konto: nichts übernehmen
      try {
        const res = await api.mine();
        if (userId !== id) return;
        if (res.ok && res.state) {
          const waiting = savedInvite();
          store.del();
          enterSession(res.state);
          if (waiting && waiting !== res.state.code) setNote({ key: 'team.err.already_in_team', kind: 'warn' }, 8000);
          return;
        }
      } catch { /* offline: Team-Modus wird über den Knopf erneut versucht */ }
      const waiting = invite ? invite.code : savedInvite();
      if (waiting && !dlg.open) { inviteOffered = true; showInvite(waiting); }
    } else if (s.status === 'out' || s.status === 'recovery') {
      if (userId !== null || sync) {
        userId = null;
        if (sync) { sync.stop(); sync = null; code = null; net.leaveTeam(); render(); }
        setNote(null);
      }
      const waiting = savedInvite();
      if (waiting && !inviteOffered && !dlg.open) { inviteOffered = true; showInvite(waiting); }   // Besucher ohne Konto: „Anmelden, um beizutreten“
    }
  }

  // ---------------------------------------------------------------- Aktionen
  function startConfirm(kind) {
    confirming = kind;
    if (confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => { confirming = null; if (note && note.key === 'team.leaveLeadNote') setNote(null); render(); }, 4500);
    const me = ownRow(view());
    if (kind === 'leave' && me && me.leader && view().members.length > 1) setNote({ key: 'team.leaveLeadNote', kind: '' });
    render();
  }

  async function doLeave() {
    if (!sync || !code) return;
    const c = code;
    try {
      const res = await api.leave(c);
      if (res.ok) { exitSession('none'); return; }
      setNote({ key: teamErrorKey(res.error) || 'team.err.server', kind: 'error' }, 8000);
    } catch (e) { setNote({ key: errorFrom(e).key, kind: 'error' }, 8000); }
    confirming = null;
    render();
  }
  async function doEnd() {
    if (!sync || !code) return;
    const c = code;
    try {
      const res = await api.end(c);
      if (res.ok) { exitSession('ended'); return; }
      setNote({ key: teamErrorKey(res.error) || 'team.err.server', kind: 'error' }, 8000);
    } catch (e) { setNote({ key: errorFrom(e).key, kind: 'error' }, 8000); }
    confirming = null;
    render();
  }

  async function copyLink() {
    if (!code) return;
    const link = inviteLink(win.location.href, code);
    let done = false;
    try {
      if (win.navigator.clipboard && win.navigator.clipboard.writeText) { await win.navigator.clipboard.writeText(link); done = true; }
    } catch { done = false; }
    if (!done) {
      els.link.hidden = false;
      els.link.value = link;
      try {
        els.link.focus();
        els.link.select();
        els.link.setSelectionRange(0, link.length);
        done = !!doc.execCommand && doc.execCommand('copy');
      } catch { done = false; }
    }
    if (done) {
      els.link.hidden = true;
      setNote({ key: 'team.copied', kind: 'ok' }, 3000);
    } else {
      setNote({ key: 'team.copyManual', kind: 'warn' }, 12000);
    }
  }

  // ---------------------------------------------------------------- Ereignisse
  els.chip.addEventListener('click', openStart);
  els.close.addEventListener('click', closeDialog);
  dlg.addEventListener('close', afterClose);
  els.signin.addEventListener('click', () => { closeDialogKeepInvite(); openAccount(); });
  function closeDialogKeepInvite() {
    if (invite) { rememberInvite(invite.code); keepOnClose = true; }   // nach der Anmeldung wird die Einladung wieder angeboten
    closeDialog();
  }
  els.size.addEventListener('click', (e) => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    selectedSize = Number(b.dataset.size);
    renderDialog();
  });
  els.create.addEventListener('click', doCreate);
  els.join.addEventListener('click', () => {
    const c = parseInvite(els.linkInput.value);
    if (!c) { setError({ key: 'team.err.input' }); return; }
    doJoin(c);
  });
  els.linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); els.join.click(); } });
  els.linkInput.addEventListener('input', () => { if (dlgError) setError(null); });
  els.inviteJoin.addEventListener('click', () => { if (invite) doJoin(invite.code); });
  els.inviteCancel.addEventListener('click', () => { closeDialog(); });
  els.copy.addEventListener('click', copyLink);
  els.leave.addEventListener('click', () => { if (confirming === 'leave') doLeave(); else startConfirm('leave'); });
  els.end.addEventListener('click', () => { if (confirming === 'end') doEnd(); else startConfirm('end'); });

  // Eingaben im Tracker → eigene Team-Werte (nur gültige Zahlen; ungültige Eingaben zeigt der Tracker selbst an und sendet nichts)
  net.onChange(() => {
    if (!sync) return;
    const v = net.values();
    const r = computeNet(v.dealt, v.taken, getLocale());
    if (!r.ok) return;
    sync.push(r.dealt, r.taken);
    render();
  });

  doc.addEventListener('visibilitychange', () => { if (!doc.hidden && sync) sync.wake(); });
  win.addEventListener('online', () => { if (sync) sync.wake(); });
  onLanguageChange(() => { rosterSig = ''; render(); renderNote(); renderDialog(); });
  auth.onChange((s) => { onAuth(s); });

  // Einladungslink in der Adresse: merken, aus der Adresszeile entfernen, nach der Anmeldung bzw. sofort anbieten
  const fromUrl = inviteFromSearch(win.location.search);
  if (fromUrl) {
    rememberInvite(fromUrl);
    try { win.history.replaceState(null, '', win.location.pathname + searchWithoutInvite(win.location.search) + (win.location.hash || '')); } catch { /* nur Kosmetik */ }
  }
  els.chip.hidden = false;
  showView('start');
  renderDialog();
  onAuth(authState());

  return {
    open: openStart,
    get active() { return !!sync; },
    get code() { return code; },
  };
}
