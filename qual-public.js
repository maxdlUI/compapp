// Öffentlicher Banner "Estimated Qual".
//
// Zeigt den vom Admin veröffentlichten Stand an, aber nur, wenn Estimated Qual eingeschaltet ist und ein gültiger Wert
// veröffentlicht wurde. Sonst entsteht KEIN Element (kein Platzhalter, kein leerer Container, kein reservierter Platz).
// Alle Besucher bekommen dieselbe Antwort der Datenbankfunktion estimated_qual_public() (nur lesend, nur öffentlicher Schlüssel).
//
// Es wird bewusst nichts zwischengespeichert: Wer Estimated Qual ausschaltet, blendet den Banner damit überall aus
// (offene Seiten spätestens nach einer Minute oder beim Zurückkehren zum Tab).
// Ein Fehler hier darf die Werkzeuge nie beeinträchtigen: bei Netzwerkproblemen bleibt die Anzeige, wie sie ist.

import { t, getLocale, onLanguageChange } from './i18n.js';
import { parsePublic, publicImageUrl, formatPoints, bannerText } from './qual.js';

const normBase = (u) => String(u || '').replace(/\/+$/, '');
const baseOk = (b) => /^https:\/\/[^/\s]+$/.test(b) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(b);

/**
 * Baut das Banner-Element. Wird auch für die Vorschau im Admin-Panel verwendet, damit beides identisch aussieht.
 * Texte werden nur per textContent gesetzt.
 * @param {Document} doc
 * @param {{points:number, imageUrl?:string|null}} data
 * @param {{preview?:boolean}} [opts]
 */
export function createBannerElement(doc, data, opts = {}) {
  const root = doc.createElement('section');
  root.className = 'qual';
  root.dataset.qual = opts.preview ? 'preview' : 'live';
  root.setAttribute('aria-label', bannerText(data.points, getLocale(), t('qual.name'), t('qual.unit')));

  const bg = doc.createElement('div');
  bg.className = 'qual-bg';
  bg.setAttribute('aria-hidden', 'true');
  root.append(bg);

  if (data.imageUrl) {
    const img = doc.createElement('img');
    img.className = 'qual-img';
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('load', () => { img.dataset.loaded = '1'; });
    img.addEventListener('error', () => { img.remove(); root.dataset.image = 'failed'; }); // Bild nicht ladbar: dezenter Standardhintergrund
    img.src = data.imageUrl;
    bg.append(img);
    root.dataset.image = 'yes';
  } else root.dataset.image = 'none';

  const body = doc.createElement('p');
  body.className = 'qual-body';
  const label = doc.createElement('span');
  label.className = 'qual-label';
  label.textContent = t('qual.name');
  const colon = doc.createElement('span');
  colon.className = 'sr-only';
  colon.textContent = ': ';
  const value = doc.createElement('span');
  value.className = 'qual-value';
  const num = doc.createElement('span');
  num.className = 'qual-num';
  num.textContent = formatPoints(data.points, getLocale());
  const unit = doc.createElement('span');
  unit.className = 'qual-unit';
  unit.textContent = ` ${t('qual.unit')}`;
  value.append(num, unit);
  body.append(label, colon, value);
  root.append(body);
  return root;
}

/** Aktualisiert Zahlenformat und Beschriftung eines vorhandenen Banners nach einem Sprachwechsel. */
export function relabelBanner(el, points) {
  if (!el) return;
  el.setAttribute('aria-label', bannerText(points, getLocale(), t('qual.name'), t('qual.unit')));
  const num = el.querySelector('.qual-num');
  if (num) num.textContent = formatPoints(points, getLocale());
  const label = el.querySelector('.qual-label');
  if (label) label.textContent = t('qual.name');
  const unit = el.querySelector('.qual-unit');
  if (unit) unit.textContent = ` ${t('qual.unit')}`;
}

/**
 * Holt den veröffentlichten Stand (nur öffentlicher Schlüssel, keine Cookies).
 * @returns {Promise<{points:number,image:string|null,publishedAt:string}|null>} null = nichts anzuzeigen
 * @throws bei Netzwerk- oder Serverfehlern (der Aufrufer behält dann die bisherige Anzeige)
 */
export async function fetchPublished({ url, anonKey, fetchFn = (...a) => fetch(...a), timeoutMs = 10000 }) {
  const base = normBase(url);
  if (!baseOk(base) || !anonKey) throw new Error('not_configured');
  const headers = { apikey: anonKey, Accept: 'application/json', 'Content-Type': 'application/json' };
  if (String(anonKey).startsWith('eyJ')) headers.Authorization = `Bearer ${anonKey}`; // alte Schlüssel sind JWTs; sb_publishable_ nicht
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(`${base}/rest/v1/rpc/estimated_qual_public`, { method: 'POST', headers, body: '{}', credentials: 'omit', cache: 'no-store', signal: ctl && ctl.signal });
    if (res.status === 404 || res.status === 400) return null; // Funktion fehlt (Migration 002 nicht eingespielt): kein Banner
    if (!res.ok) throw new Error(`http_${res.status}`);
    const text = await res.text();
    return parsePublic(text ? JSON.parse(text) : null);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Bindet den Banner an die Seite. Er wird als allererstes Element in <main> eingefügt (direkt unter der Navigation).
 * @returns {{refresh:()=>Promise<void>, destroy:()=>void, readonly element:HTMLElement|null}|null}
 */
export function initQualBanner({ config, doc = document, fetchFn, intervalMs = 60000, win = typeof window !== 'undefined' ? window : null } = {}) {
  const base = normBase(config && config.supabaseUrl);
  const key = config && config.supabaseAnonKey;
  if (!baseOk(base) || !key) return null; // Konten/Projekt nicht eingerichtet: es gibt nichts abzurufen

  let el = null;
  let shown = null; // { points, image }
  let seq = 0;
  let timer = null;

  const main = () => doc.querySelector('main.app') || doc.querySelector('main');

  function remove() {
    if (el) { el.remove(); el = null; }
    shown = null;
  }

  function apply(next) {
    if (!next) { remove(); return; }
    if (el && shown && shown.points === next.points && shown.image === next.image && el.isConnected) return; // unverändert: nichts neu aufbauen
    const host = main();
    if (!host) return;
    const fresh = createBannerElement(doc, { points: next.points, imageUrl: publicImageUrl(base, next.image) });
    if (el) el.remove();
    el = fresh;
    shown = { points: next.points, image: next.image };
    host.insertBefore(el, host.firstChild); // erstes Element im Hauptbereich
  }

  async function refresh() {
    const mine = ++seq;
    let next;
    try {
      next = await fetchPublished({ url: base, anonKey: key, fetchFn });
    } catch {
      return; // offline oder Serverfehler: Anzeige unverändert lassen
    }
    if (mine !== seq) return; // eine neuere Abfrage ist schon unterwegs
    apply(next);
  }

  const onVisible = () => { if (!doc.hidden) refresh(); };
  const onOnline = () => { refresh(); };
  doc.addEventListener('visibilitychange', onVisible);
  if (win) win.addEventListener('online', onOnline);
  if (intervalMs > 0 && typeof setInterval === 'function') timer = setInterval(() => { if (!doc.hidden) refresh(); }, intervalMs);
  const offLang = onLanguageChange(() => { if (el && shown) relabelBanner(el, shown.points); });

  refresh();

  return {
    refresh,
    destroy() {
      clearInterval(timer);
      doc.removeEventListener('visibilitychange', onVisible);
      if (win) win.removeEventListener('online', onOnline);
      if (typeof offLang === 'function') offLang();
      remove();
    },
    get element() { return el; },
  };
}
