// Willkommens-Intro: kurze CSS-Animation mit dem KREVO-Zeichen. Reine Anzeige, ohne Abhängigkeiten.
//
// Wann es erscheint (decideIntro):
//   * erster Besuch auf diesem Gerät          -> 'full'   (ca. 1,9 s)
//   * wiederkehrend, neue Browser-Sitzung       -> 'short'  (ca. 0,9 s)
//   * Bewegung reduziert (prefers-reduced-motion) -> 'static' (ca. 0,8 s, ohne Bewegung, nur Einblenden/Ausblenden)
//   * gleiche Sitzung (Neuladen, Navigation)    -> gar nicht
//   * Rückkehr von Google/E-Mail-Link, Tab im Hintergrund -> gar nicht
// Das Intro blockiert nichts: Die App ist darunter längst bereit, Eingaben und Tastendrücke beenden es sofort
// (der Tipp geht trotzdem an die App darunter), und es beendet sich per CSS selbst, auch wenn dieses Skript fehlschlägt.

export const INTRO_SEEN_KEY = 'fnc.v1.introSeen';
export const INTRO_SESSION_KEY = 'fnc.v1.introSession';
export const INTRO_MS = { full: 1900, short: 900, static: 800 };

/** @returns {'none'|'full'|'short'|'static'} */
export function decideIntro({ reducedMotion = false, seenBefore = false, seenThisSession = false, skip = false } = {}) {
  if (skip || seenThisSession) return 'none';
  if (reducedMotion) return 'static';
  return seenBefore ? 'short' : 'full';
}

/** Erkennt Rückkehr von Google-Login oder E-Mail-Link: dann soll nichts den Blick auf das Ergebnis verzögern. */
export function isAuthReturn(loc) {
  const search = new URLSearchParams(loc.search || '');
  const hash = String(loc.hash || '').replace(/^#/, '');
  return search.has('code') || search.has('error') || /(^|&)(access_token|error|error_code)=/.test(hash);
}

const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

export function initIntro({ el = globalThis.document && globalThis.document.getElementById('intro'), win = globalThis.window, doc = globalThis.document } = {}) {
  if (!el || !win || !doc) return 'none';
  const seenBefore = safe(() => win.localStorage.getItem(INTRO_SEEN_KEY) !== null, false);
  const seenThisSession = safe(() => win.sessionStorage.getItem(INTRO_SESSION_KEY) !== null, false);
  const reducedMotion = safe(() => win.matchMedia('(prefers-reduced-motion: reduce)').matches, false);
  const mode = decideIntro({ reducedMotion, seenBefore, seenThisSession, skip: isAuthReturn(win.location) || doc.hidden });
  if (mode === 'none') { el.remove(); return mode; }

  safe(() => win.localStorage.setItem(INTRO_SEEN_KEY, String(Date.now())));
  safe(() => win.sessionStorage.setItem(INTRO_SESSION_KEY, '1'));

  let done = false;
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  const finish = (fast) => {
    if (done) return;
    if (fast && !el.classList.contains('is-leaving')) {
      el.classList.add('is-leaving');
      win.setTimeout(() => finish(false), 200);
      return;
    }
    done = true;
    events.forEach((ev) => doc.removeEventListener(ev, onInput, true));
    el.remove();
  };
  const onInput = () => finish(true); // Ereignis läuft normal weiter, der Tipp erreicht die App
  events.forEach((ev) => doc.addEventListener(ev, onInput, { capture: true, passive: true }));

  el.dataset.mode = mode;
  el.hidden = false;
  win.setTimeout(() => finish(false), INTRO_MS[mode] + 400); // Sicherheitsnetz, falls animationend ausbleibt
  el.addEventListener('animationend', (e) => { if (e.target === el) finish(false); });
  return mode;
}
