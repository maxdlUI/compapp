// Abgleich einer Team-Session mit der Datenbank (ohne Oberfläche, mit nachgebauten Timern und Schnittstelle testbar).
//
// Aufgaben:
//   * regelmäßig den Zustand abfragen (nur bei sichtbarem Tab), mit längeren Pausen nach Fehlern
//   * eigene Änderungen gebündelt und nacheinander senden (immer nur eine Anfrage gleichzeitig)
//   * veraltete Antworten verwerfen (Reihenfolge über rev) und veraltete Schreibzugriffe nie durchsetzen:
//     Wurde die eigene Zeile inzwischen woanders geändert (zweiter Tab, anderes Gerät), antwortet die Datenbank mit
//     "conflict". Dann gilt der Wert der Datenbank, die lokale Änderung wird verworfen und die Oberfläche bekommt einen Hinweis.
//   * Verbindungsstatus melden (offline nach zwei Fehlern in Folge, wieder online beim ersten Erfolg)
//
// Es gibt bewusst kein WebSocket: eine Abfrage alle drei Sekunden ist für zwei bis drei Spieler einfach, robust und
// ohne eigenes Echtzeit-System. Nach eigenen Änderungen und beim Zurückkehren zum Tab wird sofort abgefragt.

import { ownRow } from './team.js';

export function createTeamSync({
  api, code, pollMs = 3000, debounceMs = 250, maxBackoffMs = 15000,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (h) => clearTimeout(h), isVisible = () => true,
  onState = () => {}, onOwn = () => {}, onStatus = () => {}, onNote = () => {}, onEnded = () => {}, autoInit = true,
}) {
  let state = null;          // letzter angenommener Zustand des Servers
  let rev = -1;
  let own = null;            // eigene Zeile laut Server: {initialized, dealt, taken, version}
  let pending = null;        // lokale Änderung, die noch nicht bestätigt ist
  let inflight = false;
  let stopped = true;
  let online = true;
  let fails = 0;
  let flushTimer = null;
  let pollTimer = null;
  let seq = 0;               // Nummer der letzten gestarteten Abfrage
  let applied = 0;           // Nummer der letzten angenommenen Abfrage

  const backoff = () => (fails > 0 ? Math.min(pollMs * 2 ** (fails - 1), maxBackoffMs) : pollMs);

  function success() {
    fails = 0;
    if (!online) { online = true; onStatus('online'); }
  }
  function failure() {
    fails += 1;
    if (fails >= 2 && online) { online = false; onStatus('offline'); }
  }

  function finish(reason) {
    if (stopped) return;
    stopped = true;
    if (flushTimer) clearTimer(flushTimer);
    if (pollTimer) clearTimer(pollTimer);
    flushTimer = pollTimer = null;
    pending = null;
    onEnded(reason, state);
  }

  /** Übernimmt einen Zustand, sofern er nicht älter ist als der bekannte. Gibt true zurück, wenn er angenommen wurde. */
  function adopt(next, { forceOwn = false } = {}) {
    if (!next || typeof next !== 'object' || stopped) return false;
    if (typeof next.rev === 'number' && next.rev < rev) return false;   // verspätete, ältere Antwort
    const me = ownRow(next);
    if (!me) { finish('left'); return false; }
    rev = typeof next.rev === 'number' ? next.rev : rev;
    state = next;
    const prev = own;
    own = { initialized: !!me.initialized, dealt: me.dealt, taken: me.taken, version: me.version };
    onState(state);
    if (next.status !== 'open') { finish(next.status === 'expired' ? 'expired' : 'ended'); return true; }
    const changed = !prev || prev.version !== own.version || prev.initialized !== own.initialized;
    if ((changed && !pending && !inflight) || forceOwn) onOwn({ ...own });
    return true;
  }

  async function poll() {
    pollTimer = null;
    if (stopped) return;
    if (!isVisible()) { schedulePoll(pollMs); return; }
    const mine = ++seq;
    try {
      const res = await api.get(code);
      if (stopped) return;
      success();
      if (res.ok) {
        if (mine >= applied) { applied = mine; adopt(res.state); }
      } else if (res.error === 'not_member') finish('left');
      else if (res.error === 'not_authenticated') finish('auth');
    } catch {
      if (!stopped) failure();
    }
    if (!stopped) schedulePoll(backoff());
  }
  function schedulePoll(ms) {
    if (stopped) return;
    if (pollTimer) clearTimer(pollTimer);
    pollTimer = setTimer(poll, ms);
  }

  function scheduleFlush(ms) {
    if (stopped) return;
    if (flushTimer) clearTimer(flushTimer);
    flushTimer = setTimer(flush, ms);
  }

  async function flush() {
    flushTimer = null;
    if (stopped || inflight || !pending || !own) return;
    const sending = pending;
    inflight = true;
    try {
      const res = await api.set(code, sending.dealt, sending.taken, own.version);
      if (stopped) return;
      success();
      if (res.ok) {
        if (pending === sending) pending = null;
        adopt(res.state);
      } else if (res.error === 'conflict') {
        // Jemand hat die eigene Zeile inzwischen geändert (anderer Tab/Gerät). Der Wert der Datenbank gilt.
        const srv = ownRow(res.state);
        const same = !!srv && srv.initialized && srv.dealt === sending.dealt && srv.taken === sending.taken;
        if (same) {
          if (pending === sending) pending = null; // dieselben Werte: eine wiederholte Anfrage, nichts geht verloren
          adopt(res.state);
        } else {
          pending = null;
          adopt(res.state, { forceOwn: true });
          onNote('conflict');
        }
      } else if (res.error === 'team_ended' || res.error === 'team_expired') {
        finish(res.error === 'team_expired' ? 'expired' : 'ended');
      } else if (res.error === 'not_member') {
        finish('left');
      } else if (res.error === 'not_authenticated') {
        finish('auth');
      } else {
        pending = null;                           // z. B. bad_value: nie erneut senden
        onNote('rejected');
      }
    } catch {
      if (!stopped) failure();
    } finally {
      inflight = false;
    }
    // Die Antwort auf das Schreiben enthält den ganzen Zustand des Teams (auch die Werte der anderen)
    if (pending && !stopped) scheduleFlush(fails > 0 ? backoff() : 0);
  }

  return {
    /** Startet mit dem Zustand aus create/join/mine. Ist die eigene Zeile noch nicht initialisiert, werden 0/0 gesendet. */
    start(initial) {
      stopped = false;
      rev = -1; applied = 0; own = null; pending = null; fails = 0; online = true;
      adopt(initial, { forceOwn: true });
      if (stopped) return;
      if (autoInit && own && !own.initialized) { pending = { dealt: 0, taken: 0 }; scheduleFlush(0); }
      schedulePoll(pollMs);
    },
    /** Eigene Werte ändern (gültige ganze Zahlen). Wird gebündelt gesendet. */
    push(dealt, taken) {
      if (stopped) return;
      pending = { dealt, taken };
      scheduleFlush(debounceMs);
    },
    /** Sofort abfragen (z. B. beim Zurückkehren zum Tab oder nach erneuter Verbindung). */
    wake() {
      if (stopped) return;
      if (pollTimer) clearTimer(pollTimer);
      pollTimer = null;
      if (pending && !inflight) scheduleFlush(0);
      poll();
    },
    /** Wartet nicht auf Timer: sendet eine offene Änderung jetzt (vor dem Verlassen). */
    async flushNow() {
      if (flushTimer) clearTimer(flushTimer);
      flushTimer = null;
      await flush();
    },
    stop() {
      stopped = true;
      if (flushTimer) clearTimer(flushTimer);
      if (pollTimer) clearTimer(pollTimer);
      flushTimer = pollTimer = null;
    },
    /** Was die Oberfläche anzeigt: Serverzustand plus eigene, noch unbestätigte Werte. */
    view() {
      return { state, pending, online, stopped };
    },
  };
}
