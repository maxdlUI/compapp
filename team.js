// Team-Modus für Net Damage: reine Logik ohne Oberfläche (gut testbar).
//
// Begriffe: "Net Damage" ist der persönliche Wert eines Spielers (Dealt − Taken), "Team Net Surge" die Summe der
// Net-Damage-Werte aller Teammitglieder, die schon Werte gesendet haben. Beides sind Werte, die das Team selbst einträgt.
// Es ist keine Erkennung eines Ingame-Storm-Surge-Schwellenwerts.

import { describeNet, formatNumber } from './logic.js';

export const INVITE_PARAM = 'team';
export const TEAM_SIZES = { duo: 2, trio: 3 };
export const CODE_RE = /^[A-Za-z0-9_-]{22}$/;
export const SURGE_NAME = 'Team Net Surge';

export const isValidCode = (c) => typeof c === 'string' && CODE_RE.test(c);

/** Nimmt einen Einladungslink oder eine nackte Kennung entgegen und liefert die Kennung (oder null). */
export function parseInvite(text) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  if (isValidCode(s)) return s;
  const m = s.match(/[?&#]team=([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])/);
  return m ? m[1] : null;
}

/** Baut den Einladungslink zur aktuellen Seite: nur der Parameter team, sonst nichts (kein Hash, keine fremden Parameter). */
export function inviteLink(baseHref, code) {
  const u = new URL(baseHref);
  u.search = '';
  u.hash = '';
  u.searchParams.set(INVITE_PARAM, code);
  return u.toString();
}

/** Liest die Kennung aus dem Suchteil der Adresse (z. B. "?team=…&x=1"). */
export function inviteFromSearch(search) {
  try {
    const v = new URLSearchParams(search || '').get(INVITE_PARAM);
    return isValidCode(v) ? v : null;
  } catch {
    return null;
  }
}

/** Suchteil ohne den Einladungsparameter (andere Parameter, etwa von der Anmeldung, bleiben). */
export function searchWithoutInvite(search) {
  try {
    const p = new URLSearchParams(search || '');
    p.delete(INVITE_PARAM);
    const s = p.toString();
    return s ? `?${s}` : '';
  } catch {
    return '';
  }
}

// ---------- Zustand ----------

export const ownRow = (state) => (state && Array.isArray(state.members) ? state.members.find((m) => m.me) || null : null);
export const isOpen = (state) => !!state && state.status === 'open';

/** Nur Mitglieder mit gesendeten Werten zählen. Wer noch nicht initialisiert ist, trägt nichts bei und wird eigens ausgewiesen. */
export function summarize(state) {
  const members = state && Array.isArray(state.members) ? state.members : [];
  const counted = members.filter((m) => m.initialized && Number.isInteger(m.dealt) && Number.isInteger(m.taken));
  const surge = counted.reduce((sum, m) => sum + (m.dealt - m.taken), 0);
  const size = state ? state.size : 0;
  return {
    surge,
    counted: counted.length,
    joined: members.length,
    size,
    waiting: members.length - counted.length, // beigetreten, aber noch ohne Werte
    free: Math.max(0, size - members.length),
    complete: size > 0 && counted.length === size,
  };
}

/** Anzeige der Summe: Vorzeichen immer dabei (Farbe ist nie die einzige Information). */
export const describeSurge = (n, locale = 'de-DE') => describeNet(n, locale);

/** Zeilen für die Teamübersicht: erst die Mitglieder in Platzreihenfolge, dann die freien Plätze (immer so viele Zeilen wie Plätze). */
export function rosterRows(state, locale = 'de-DE') {
  const size = state ? state.size : 0;
  const members = (state ? state.members : []).filter((m) => m.slot >= 1 && m.slot <= size).sort((a, b) => a.slot - b.slot);
  const rows = members.map((m) => {
    const net = m.initialized ? m.dealt - m.taken : null;
    const d = net === null ? { text: '–', kind: 'wait' } : describeNet(net, locale);   // kind: positive | negative | even | wait
    return {
      kind: 'member', slot: m.slot, name: m.name, me: !!m.me, leader: !!m.leader, initialized: !!m.initialized,
      net, text: d.text, tone: d.kind,
      dealt: m.dealt, taken: m.taken,
      detail: net === null ? '' : `${formatNumber(m.dealt, locale)} − ${formatNumber(m.taken, locale)}`,
    };
  });
  const used = new Set(members.map((m) => m.slot));
  for (let slot = 1; slot <= size; slot += 1) if (!used.has(slot)) rows.push({ kind: 'free', slot });
  return rows;
}

/** Zeigt die eigenen, noch nicht bestätigten Werte sofort an (die Summe rechnet mit), ohne den Zustand des Servers zu ändern. */
export function withOwn(state, dealt, taken) {
  if (!state || !Array.isArray(state.members) || dealt == null || taken == null) return state;
  return {
    ...state,
    members: state.members.map((m) => (m.me ? { ...m, initialized: true, dealt, taken, net: dealt - taken } : m)),
  };
}

// ---------- Fehlermeldungen ----------

const TEAM_CODES = new Set(['not_authenticated', 'bad_size', 'already_in_team', 'team_not_found', 'team_ended', 'team_expired',
  'team_full', 'not_member', 'not_leader', 'bad_value', 'conflict', 'server']);

/** Wandelt eine Fehlerkennung aus der Datenbank in einen Übersetzungsschlüssel um (unbekannte Codes → allgemeine Meldung). */
export const teamErrorKey = (code) => (TEAM_CODES.has(code) ? `team.err.${code}` : null);

// ---------- Schnittstelle zur Datenbank ----------

export class TeamError extends Error {
  constructor(code, extra = {}) {
    super(code);
    this.name = 'TeamError';
    this.code = code;
    Object.assign(this, extra);
  }
}

/**
 * Dünne Hülle um die Datenbank-Funktionen. `rest` ist authed-Rest des Auth-Clients (Token wird dort erneuert).
 * Jede Funktion liefert das rohe Ergebnis {ok, ...}. Netzwerk- und Serverfehler werfen (AuthError des Clients).
 */
export function createTeamApi(rest) {
  const call = async (fn, body) => {
    const res = await rest(`/rpc/${fn}`, { method: 'POST', body });
    if (!res || typeof res !== 'object' || typeof res.ok !== 'boolean') throw new TeamError('server');
    return res;
  };
  return {
    create: (size) => call('team_create', { p_size: size }),
    preview: (code) => call('team_preview', { p_code: code }),
    join: (code) => call('team_join', { p_code: code }),
    get: (code) => call('team_get', { p_code: code }),
    mine: () => call('team_mine', {}),
    set: (code, dealt, taken, version) => call('team_set', { p_code: code, p_dealt: dealt, p_taken: taken, p_version: version }),
    leave: (code) => call('team_leave', { p_code: code }),
    end: (code) => call('team_end', { p_code: code }),
  };
}
