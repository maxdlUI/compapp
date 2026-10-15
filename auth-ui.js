// Oberfläche für Konto, Anmeldung und Profil: Kopfzeilen-Knopf und ein Dialog mit mehreren Ansichten.
// Alle Texte kommen aus i18n.js. Nutzerdaten (Nutzername, E-Mail) werden nur per textContent angezeigt.
// Ein Fehler hier (oder im Profil-Laden) darf die übrigen Werkzeuge nie beeinträchtigen.

import { t, getLang, onLanguageChange } from './i18n.js';
import { validateUsername, avatarInitial } from './username.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;
const CHECK_DELAY = 350;
const VIEWS = ['notconfigured', 'signin', 'signup', 'forgot', 'recovery', 'notice', 'profile'];

/** Fehlercode -> Übersetzungsschlüssel. Nutzernamen-Fehler teilen sich die Texte mit der Vorabprüfung. */
export function errorKey(code) {
  const map = { username_taken: 'auth.u.taken', username_reserved: 'auth.u.reserved', username_invalid: 'auth.u.invalid' };
  if (map[code]) return map[code];
  const key = `auth.err.${code}`;
  return t(key) === key ? 'auth.err.unknown' : key;
}

export function initAccounts({ auth, doc = document }) {
  const $ = (id) => doc.getElementById(id);
  const dlg = $('account-dialog');
  const btn = $('account-btn');
  if (!dlg || !btn) return null;

  const els = {
    title: $('dlg-title'), banner: $('dlg-banner'), close: $('dlg-close'),
    avatar: $('acct-avatar'), label: $('acct-label'),
    notice: $('notice-text'),
    profAvatar: $('prof-avatar'), profName: $('prof-name'), profMail: $('prof-mail'), profEmail: $('prof-email'),
    profSince: $('prof-since'), profSinceRow: $('prof-since-row'),
    profState: $('prof-state'), profStateText: $('prof-state-text'), profRetry: $('prof-retry'),
    profForm: $('prof-form'), profInput: $('prof-username'), profHint: $('prof-username-hint'), profSave: $('prof-save'),
    profError: $('prof-error'), signOut: $('prof-signout'),
    suUser: $('su-username'), suHint: $('su-username-hint'),
  };
  const section = (name) => dlg.querySelector(`[data-view="${name}"]`);
  const live = doc.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  doc.body.append(live);
  const announce = (text) => { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 60); };

  let view = null;
  let busy = false;
  let googleEnabled = null;
  let wantedName = '';
  let profileFor = null;
  let banner = null; // { key, params, kind }
  let profCheck = { status: 'idle', value: '' }; // Ergebnis der Namensprüfung im Profil
  const hints = new Map(); // Hinweiszeile -> { key, params, kind }

  // ---------------------------------------------------------------- Hilfen
  const stateName = (s) => (s.profile && s.profile.username) || (s.session && s.session.user && s.session.user.user_metadata && s.session.user.user_metadata.username) || '';
  const stateAvatarUrl = (s) => {
    const m = (s.session && s.session.user && s.session.user.user_metadata) || {};
    const url = m.avatar_url || m.picture || '';
    return /^https:\/\//i.test(url) ? url : '';
  };

  function iconUser() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'i');
    const use = doc.createElementNS(ns, 'use');
    use.setAttribute('href', '#i-user');
    svg.append(use);
    return svg;
  }

  function renderAvatar(container, { url, name }) {
    const fallback = () => {
      container.replaceChildren();
      if (name) {
        const span = doc.createElement('span');
        span.className = 'avatar-initial';
        span.textContent = avatarInitial(name);
        container.append(span);
      } else container.append(iconUser());
    };
    container.replaceChildren();
    if (url) {
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.onerror = fallback; // Bild nicht ladbar: Standard-Avatar
      img.src = url;
      container.append(img);
    } else fallback();
  }

  function setHint(el, kind, key, params) {
    hints.set(el, { kind, key, params });
    el.dataset.kind = kind || '';
    el.textContent = t(key, params);
  }
  function setErr(el, key, params) { // Formularfehler (role=alert)
    if (!key) { el.hidden = true; el.textContent = ''; delete el.dataset.key; return; }
    el.dataset.key = key;
    el._params = params;
    el.hidden = false;
    el.textContent = t(key, params);
  }
  const formErr = (form) => form.querySelector('.form-error');
  function showError(form, err) {
    const el = form === 'profile' ? els.profError : formErr(form);
    setErr(el, errorKey(err && err.code ? err.code : 'unknown'));
  }

  function showBanner(key, kind = 'info', params) {
    banner = key ? { key, kind, params } : null;
    renderBanner();
  }
  function renderBanner() {
    if (!banner) { els.banner.hidden = true; els.banner.textContent = ''; return; }
    els.banner.hidden = false;
    els.banner.dataset.kind = banner.kind;
    els.banner.textContent = t(banner.key, banner.params);
  }

  function setBusy(form, flag) {
    busy = flag;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = flag;
      submit.textContent = flag ? t('auth.busy') : t(submit.dataset.i18n);
    }
    form.querySelectorAll('[data-google]').forEach((b) => { b.disabled = flag || googleEnabled === false; });
    form.setAttribute('aria-busy', String(flag));
  }

  // ---------------------------------------------------------------- Kopfzeile
  function renderButton(s = auth.state) {
    const loading = s.status === 'loading';
    const signedIn = s.status === 'in' || s.status === 'recovery';
    btn.dataset.state = loading ? 'loading' : signedIn ? 'in' : 'out';
    const name = signedIn ? stateName(s) : '';
    renderAvatar(els.avatar, { url: signedIn ? stateAvatarUrl(s) : '', name });
    els.label.removeAttribute('data-i18n');
    els.label.textContent = signedIn ? name : t('auth.btn.signIn');
    els.label.hidden = loading || (signedIn && !name);
    btn.setAttribute('aria-label', loading ? t('auth.btn.loading') : signedIn ? `${t('auth.btn.openProfile')}${name ? `: ${name}` : ''}` : t('auth.btn.openSignIn'));
    btn.setAttribute('aria-busy', String(loading));
  }

  // ---------------------------------------------------------------- Dialog
  function defaultView() {
    if (!auth.configured) return 'notconfigured';
    const s = auth.state;
    if (s.status === 'recovery') return 'recovery';
    if (s.status === 'in') return 'profile';
    return 'signin';
  }

  function ensureGoogleState() {
    if (googleEnabled !== null || !auth.configured) return renderGoogle();
    auth.settings().then((s) => { if (s) googleEnabled = !!s.google; renderGoogle(); }).catch(() => {});
    return undefined;
  }
  function renderGoogle() {
    dlg.querySelectorAll('[data-google]').forEach((b) => {
      const off = googleEnabled === false;
      b.disabled = busy || off;
      b.setAttribute('aria-disabled', String(off));
    });
    dlg.querySelectorAll('.google-off').forEach((p) => { p.hidden = googleEnabled !== false; });
  }

  function setView(name) {
    view = name;
    VIEWS.forEach((v) => { const sec = section(v); if (sec) sec.hidden = v !== name; });
    els.title.textContent = t(`auth.title.${name}`);
    dlg.querySelectorAll('.form-error').forEach((e) => setErr(e, null));
    setErr(els.profError, null);
    if (name === 'signin' || name === 'signup') ensureGoogleState();
    if (name === 'profile') renderProfile();
    if (name === 'signup') updateSignupHint();
    const sec = section(name);
    const first = sec && sec.querySelector('input:not([disabled])');
    setTimeout(() => { (first && name !== 'profile' ? first : els.title).focus({ preventScroll: true }); }, 0);
  }

  function openDialog(name) {
    if (!dlg.open) {
      try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
    }
    btn.setAttribute('aria-expanded', 'true');
    setView(name || defaultView());
  }
  function closeDialog() {
    if (dlg.open) { try { dlg.close(); } catch { dlg.removeAttribute('open'); } }
    afterClose();
  }
  function afterClose() {
    btn.setAttribute('aria-expanded', 'false');
    dlg.querySelectorAll('input[type="password"]').forEach((i) => { i.value = ''; i.type = 'password'; });
    dlg.querySelectorAll('[data-pw-toggle]').forEach(renderPwToggle);
    banner = null;
    renderBanner();
    busy = false;
  }

  btn.addEventListener('click', () => openDialog());
  els.close.addEventListener('click', closeDialog);
  dlg.addEventListener('close', () => { if (!dlg.open) afterClose(); }); // Esc; nicht, wenn der Dialog schon wieder offen ist
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(); }); // Klick auf den abgedunkelten Hintergrund
  dlg.querySelectorAll('[data-action="close"]').forEach((b) => b.addEventListener('click', closeDialog));
  dlg.querySelectorAll('[data-view-go]').forEach((b) => b.addEventListener('click', () => { showBanner(null); setView(b.dataset.viewGo); }));

  // Passwort anzeigen/verbergen
  function renderPwToggle(b) {
    const input = $(b.dataset.pwToggle);
    const shown = input && input.type === 'text';
    b.setAttribute('aria-pressed', String(!!shown));
    b.setAttribute('aria-label', t(shown ? 'auth.pw.hideLabel' : 'auth.pw.showLabel'));
    b.firstElementChild.textContent = t(shown ? 'auth.pw.hide' : 'auth.pw.show');
  }
  dlg.querySelectorAll('[data-pw-toggle]').forEach((b) => {
    b.addEventListener('click', () => {
      const input = $(b.dataset.pwToggle);
      input.type = input.type === 'password' ? 'text' : 'password';
      renderPwToggle(b);
      input.focus();
    });
  });

  // ---------------------------------------------------------------- Formulare
  function fail(form, input, key, params) {
    setErr(formErr(form), key, params);
    if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
    return false;
  }
  const clearInvalid = (form) => form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
  dlg.addEventListener('input', (e) => { if (e.target.matches && e.target.matches('.auth-input')) e.target.removeAttribute('aria-invalid'); });

  function checkEmail(form, input) {
    const v = input.value.trim();
    if (!v) return fail(form, input, 'auth.v.emailEmpty');
    if (!EMAIL_RE.test(v)) return fail(form, input, 'auth.v.emailInvalid');
    return true;
  }
  function checkPassword(form, input, { strict = false } = {}) {
    if (!input.value) return fail(form, input, 'auth.v.passwordEmpty');
    if (strict && input.value.length < MIN_PASSWORD) return fail(form, input, 'auth.v.passwordShort');
    return true;
  }

  // Anmelden
  const formIn = section('signin');
  formIn.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    clearInvalid(formIn);
    setErr(formErr(formIn), null);
    if (!checkEmail(formIn, formIn.email) || !checkPassword(formIn, formIn.password)) return;
    setBusy(formIn, true);
    try {
      await auth.signIn({ email: formIn.email.value.trim(), password: formIn.password.value });
      setBusy(formIn, false);
      formIn.password.value = '';
      closeDialog();
      announce(t('auth.announce.signedIn', { name: stateName(auth.state) || formIn.email.value.trim() }));
    } catch (err) {
      setBusy(formIn, false);
      showError(formIn, err);
    }
  });

  // Registrieren
  const formUp = section('signup');
  formUp.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    clearInvalid(formUp);
    setErr(formErr(formUp), null);
    const u = validateUsername(formUp.username.value);
    if (!u.ok) { fail(formUp, formUp.username, `auth.u.${u.code}`); return; }
    if (!checkEmail(formUp, formUp.email) || !checkPassword(formUp, formUp.password, { strict: true })) return;
    setBusy(formUp, true);
    try {
      // Vor dem Anlegen noch einmal prüfen, damit kein anderer Name still zugewiesen wird.
      // Bei Netzproblemen geht es trotzdem weiter: die Datenbank entscheidet endgültig.
      try {
        const avail = await auth.checkUsername(u.value);
        if (avail !== 'available') {
          setBusy(formUp, false);
          fail(formUp, formUp.username, avail === 'taken' ? 'auth.u.taken' : avail === 'reserved' ? 'auth.u.reserved' : 'auth.u.invalid');
          return;
        }
      } catch { /* weiter */ }
      wantedName = u.value; // Wunschname merken: weicht der vergebene Name ab, wird das nach dem Anlegen angezeigt
      const res = await auth.signUp({ email: formUp.email.value.trim(), password: formUp.password.value, username: u.value });
      setBusy(formUp, false);
      formUp.password.value = '';
      if (res.status === 'signed_in') {
        closeDialog();
        announce(t('auth.announce.signedIn', { name: u.value }));
      } else {
        wantedName = '';
        showNotice('auth.notice.confirm');
      }
    } catch (err) {
      wantedName = '';
      setBusy(formUp, false);
      showError(formUp, err);
    }
  });

  // Passwort vergessen
  const formForgot = section('forgot');
  formForgot.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    clearInvalid(formForgot);
    setErr(formErr(formForgot), null);
    if (!checkEmail(formForgot, formForgot.email)) return;
    setBusy(formForgot, true);
    try {
      await auth.requestPasswordReset(formForgot.email.value.trim());
      setBusy(formForgot, false);
      showNotice('auth.notice.reset');
    } catch (err) {
      setBusy(formForgot, false);
      showError(formForgot, err);
    }
  });

  // Neues Passwort (nach Klick auf den Link in der E-Mail)
  const formRec = section('recovery');
  formRec.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    clearInvalid(formRec);
    setErr(formErr(formRec), null);
    if (!checkPassword(formRec, formRec.password, { strict: true })) return;
    if (formRec.password.value !== formRec.repeat.value) { fail(formRec, formRec.repeat, 'auth.v.passwordMismatch'); return; }
    setBusy(formRec, true);
    try {
      await auth.updatePassword(formRec.password.value);
      setBusy(formRec, false);
      formRec.password.value = '';
      formRec.repeat.value = '';
      setView('profile');
      showBanner('auth.notice.passwordSaved', 'ok');
    } catch (err) {
      setBusy(formRec, false);
      showError(formRec, err);
    }
  });

  // Google
  dlg.querySelectorAll('[data-google]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (busy || b.disabled) return;
      const form = b.closest('form');
      setErr(formErr(form), null);
      busy = true;
      b.disabled = true;
      const textEl = b.querySelector('span');
      const original = textEl.textContent;
      textEl.textContent = t('auth.redirecting');
      try {
        await auth.signInWithGoogle(); // verlässt die Seite
      } catch (err) {
        busy = false;
        b.disabled = googleEnabled === false;
        textEl.textContent = original;
        if (err && err.code === 'provider_disabled') { googleEnabled = false; renderGoogle(); }
        showError(form, err);
      }
    });
  });

  function showNotice(key) {
    els.notice.dataset.key = key;
    els.notice.textContent = t(key);
    setView('notice');
  }

  // ---------------------------------------------------------------- Nutzername prüfen (Formular und Profil)
  function bindUsernameCheck(input, hintEl, { onResult, defaultKey = 'auth.hint.username', current = () => '' }) {
    let timer = null;
    let seq = 0;
    const apply = (kind, key, params, status, value) => {
      setHint(hintEl, kind, key, params);
      if (kind === 'error') input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      onResult({ status, value });
    };
    const run = async () => {
      const raw = input.value;
      const v = validateUsername(raw);
      const my = ++seq;
      clearTimeout(timer);
      if (raw.trim() === '') return apply('', defaultKey, undefined, 'empty', '');
      if (!v.ok) return apply('error', `auth.u.${v.code}`, undefined, 'invalid', v.value);
      if (v.value === current()) return apply('', 'auth.u.same', undefined, 'same', v.value);
      apply('busy', 'auth.u.checking', undefined, 'checking', v.value);
      timer = setTimeout(async () => {
        try {
          const r = await auth.checkUsername(v.value);
          if (my !== seq) return;
          if (r === 'available') apply('ok', 'auth.u.available', undefined, 'available', v.value);
          else apply('error', r === 'taken' ? 'auth.u.taken' : r === 'reserved' ? 'auth.u.reserved' : 'auth.u.invalid', undefined, r, v.value);
        } catch {
          if (my !== seq) return;
          apply('warn', 'auth.u.unchecked', undefined, 'unchecked', v.value); // beim Speichern entscheidet die Datenbank
        }
      }, CHECK_DELAY);
      return undefined;
    };
    input.addEventListener('input', run);
    return { run, reset() { seq++; clearTimeout(timer); } };
  }

  const signupCheck = bindUsernameCheck(els.suUser, els.suHint, { onResult() {} });
  function updateSignupHint() { if (els.suUser.value.trim()) signupCheck.run(); else setHint(els.suHint, '', 'auth.hint.username'); }

  const profileCheck = bindUsernameCheck(els.profInput, els.profHint, {
    current: () => (auth.state.profile ? auth.state.profile.username : ''),
    onResult(r) { profCheck = r; updateSave(); },
  });
  function updateSave() {
    const ready = auth.state.profileStatus === 'ready';
    const okStatus = ['available', 'unchecked'].includes(profCheck.status);
    els.profSave.disabled = !(ready && okStatus) || busy;
  }

  // Profil speichern
  els.profForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy || els.profSave.disabled) return;
    const v = validateUsername(els.profInput.value);
    if (!v.ok) { setHint(els.profHint, 'error', `auth.u.${v.code}`); els.profInput.setAttribute('aria-invalid', 'true'); return; }
    busy = true;
    updateSave();
    els.profSave.textContent = t('auth.busy');
    try {
      await auth.updateUsername(v.value);
      busy = false;
      els.profInput.removeAttribute('aria-invalid');
      profCheck = { status: 'same', value: v.value };
      setHint(els.profHint, 'ok', 'auth.u.saved');
      renderProfile();
      renderButton();
      announce(t('auth.u.saved'));
    } catch (err) {
      busy = false;
      const key = errorKey(err.code);
      setHint(els.profHint, 'error', key);
      els.profInput.setAttribute('aria-invalid', 'true');
      if (err.code === 'session_expired') { closeDialog(); openDialog('signin'); showBanner(key, 'error'); }
    } finally {
      els.profSave.textContent = t('prof.save');
      updateSave();
    }
  });

  // ---------------------------------------------------------------- Profilansicht
  function renderProfile(s = auth.state) {
    const signedIn = s.status === 'in' || s.status === 'recovery';
    if (!signedIn) return;
    const user = (s.session && s.session.user) || {};
    const name = stateName(s);
    renderAvatar(els.profAvatar, { url: stateAvatarUrl(s), name });
    els.profName.textContent = name || '…';
    els.profMail.textContent = user.email || '';
    els.profEmail.textContent = user.email || '–';

    const created = s.profile && s.profile.created_at ? new Date(s.profile.created_at) : null;
    els.profSinceRow.hidden = !created || Number.isNaN(created.getTime());
    if (!els.profSinceRow.hidden) els.profSince.textContent = new Intl.DateTimeFormat(getLang() === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'long' }).format(created);

    const st = s.profileStatus;
    els.profState.hidden = st === 'ready';
    els.profRetry.hidden = st !== 'error';
    if (st === 'loading' || st === 'idle') { els.profStateText.dataset.kind = ''; els.profStateText.textContent = t('prof.loading'); }
    if (st === 'error') {
      els.profStateText.dataset.kind = 'error';
      const code = s.profileError;
      els.profStateText.textContent = code && code !== 'unknown' && t(`auth.err.${code}`) !== `auth.err.${code}` ? t(`auth.err.${code}`) : t('prof.error');
    }
    els.profInput.disabled = st !== 'ready';
    if (st === 'ready' && document.activeElement !== els.profInput && els.profInput.dataset.dirty !== '1') {
      els.profInput.value = s.profile.username;
      profCheck = { status: 'same', value: s.profile.username };
      setHint(els.profHint, '', 'auth.hint.username');
    }
    updateSave();
  }
  els.profInput.addEventListener('input', () => { els.profInput.dataset.dirty = '1'; });
  els.profInput.addEventListener('blur', () => { if (els.profInput.value === (auth.state.profile && auth.state.profile.username)) delete els.profInput.dataset.dirty; });

  els.signOut.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    els.signOut.disabled = true;
    els.signOut.textContent = t('prof.signingOut');
    try { await auth.signOut(); } catch { /* lokal ist man trotzdem abgemeldet */ }
    busy = false;
    els.signOut.disabled = false;
    els.signOut.textContent = t('prof.signOut');
    delete els.profInput.dataset.dirty;
    closeDialog();
    announce(t('auth.announce.signedOut'));
  });
  els.profRetry.addEventListener('click', () => { profileFor = null; loadProfileOnce(auth.state); });

  // ---------------------------------------------------------------- Zustand -> Oberfläche
  function loadProfileOnce(s) {
    const signedIn = (s.status === 'in' || s.status === 'recovery') && s.session;
    if (!signedIn) { profileFor = null; return; }
    if (profileFor === s.session.user.id) return;
    profileFor = s.session.user.id;
    auth.loadProfile().then((profile) => {
      const wanted = wantedName;
      wantedName = '';
      if (wanted && profile && profile.username.toLowerCase() !== wanted.toLowerCase()) {
        openDialog('profile');
        showBanner('auth.u.changed', 'warn', { wanted, got: profile.username });
      }
    }).catch(() => {
      wantedName = ''; // Profilfehler zeigt die Profilansicht; die App läuft weiter
      if (dlg.open && view === 'profile') renderProfile();
    });
  }

  function onState(s) {
    try {
      renderButton(s);
      loadProfileOnce(s);
      if (s.returnError) {
        const err = s.returnError;
        auth.clearReturn();
        openDialog('signin');
        showBanner(errorKey(err.code), 'error');
        return;
      }
      if (s.returnType === 'recovery' && s.status === 'recovery') { auth.clearReturn(); openDialog('recovery'); return; }
      if (['signup', 'invite', 'magiclink', 'email_change'].includes(s.returnType) && s.status === 'in') {
        auth.clearReturn(); // Rückkehr über den Bestätigungslink aus der E-Mail
        openDialog('profile');
        showBanner('auth.notice.emailConfirmed', 'ok');
        return;
      }
      if (s.returnType === 'oauth') auth.clearReturn(); // Google-Anmeldung abgeschlossen: der Kopfzeilen-Knopf zeigt das Konto
      if (dlg.open) {
        if (s.status === 'out' && ['profile', 'recovery'].includes(view)) { // z. B. in einem anderen Tab abgemeldet
          if (!busy) { setView('signin'); showBanner('auth.err.session_expired', 'info'); }
        } else if (view === 'profile') renderProfile(s);
        else if (!busy && ['signin', 'signup', 'forgot', 'notice'].includes(view) && s.status === 'in') setView('profile');
        else if (!busy && view === 'recovery' && s.status === 'in') setView('profile');
      }
    } catch { /* Anzeigefehler dürfen die App nicht stoppen */ }
  }
  auth.onChange(onState);

  // Sprachwechsel: alle dynamisch gesetzten Texte neu übersetzen. Nutzerdaten bleiben unverändert.
  onLanguageChange(() => {
    renderButton();
    if (view) els.title.textContent = t(`auth.title.${view}`);
    renderBanner();
    hints.forEach((h, el) => { el.textContent = t(h.key, h.params); });
    dlg.querySelectorAll('.form-error[data-key]').forEach((el) => { el.textContent = t(el.dataset.key, el._params); });
    if (els.profError.dataset.key) els.profError.textContent = t(els.profError.dataset.key);
    if (els.notice.dataset.key) els.notice.textContent = t(els.notice.dataset.key);
    dlg.querySelectorAll('[data-pw-toggle]').forEach(renderPwToggle);
    dlg.querySelectorAll('button[type="submit"]').forEach((b) => { b.textContent = busy ? t('auth.busy') : t(b.dataset.i18n); });
    if (dlg.open && view === 'profile') renderProfile();
  });

  renderButton();
  return { open: openDialog, close: closeDialog, get view() { return view; } };
}
