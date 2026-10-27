// Ansichten (Startseite und Werkzeuge) und Seitenmenü.
// Die Startseite kommt beim Öffnen der App immer zuerst. Ausnahmen, die direkt zu den Werkzeugen führen:
// ein Sprung zu einem Werkzeug (#storm, #damage, #rotation, #map, #tools), ein Team-Einladungslink (?team=) und ein
// Neuladen innerhalb derselben Sitzung, wenn man vorher in den Werkzeugen war (z. B. Rückkehr von der Discord-Anmeldung).
// Die Werkzeuge laufen in beiden Ansichten weiter; versteckt wird nur die Anzeige.
import { t, onLanguageChange } from './i18n.js';

export const VIEW_KEY = 'fnc.v1.view'; // sessionStorage: gilt nur bis die App geschlossen wird
const TOOL_SECTIONS = ['storm', 'damage', 'rotation', 'map'];

/** Welche Ansicht beim Laden gilt. Reine Funktion, damit sie ohne Browser testbar ist. */
export function initialView({ hash = '', search = '', saved = null } = {}) {
  const h = String(hash).replace(/^#/, '');
  if (new URLSearchParams(search).has('team')) return 'tools';
  if (h === 'start' || h === 'faq') return 'start';
  if (h === 'tools' || TOOL_SECTIONS.includes(h)) return 'tools';
  return saved === 'tools' ? 'tools' : 'start';
}

export function initNav({ doc = document, win = window } = {}) {
  const $ = (id) => doc.getElementById(id);
  const root = doc.documentElement;
  const menu = $('menu');
  const store = {
    get: () => { try { return win.sessionStorage.getItem(VIEW_KEY); } catch { return null; } },
    set: (v) => { try { win.sessionStorage.setItem(VIEW_KEY, v); } catch { /* nur für diese Seite */ } },
  };

  function setView(view) {
    root.dataset.view = view;
    store.set(view);
    doc.querySelectorAll('.hnav-link[data-go]').forEach((a) => {
      const on = (a.dataset.go === 'start' && view === 'start') || (a.dataset.go === 'tools' && view === 'tools');
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  const closeMenu = () => { if (menu && menu.open) menu.close(); };
  const scrollToId = (id) => {
    const el = $(id);
    if (!el) return;
    // erst nach dem Umschalten der Ansicht messen
    win.requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  };
  const setHash = (h) => { try { win.history.replaceState(null, '', h ? `#${h}` : win.location.pathname + win.location.search); } catch { /* nur Kosmetik */ } };

  function go(target) {
    closeMenu();
    if (target === 'start') { setView('start'); setHash(''); win.scrollTo(0, 0); return; }
    if (target === 'faq') { setView('start'); setHash('faq'); scrollToId('faq'); return; }
    if (target === 'tools') { setView('tools'); setHash('tools'); win.scrollTo(0, 0); return; }
    if (target === 'account') { $('account-btn')?.click(); return; }
    if (target === 'team') {
      setView('tools');
      setHash('damage');
      const btn = $('team-open');
      if (btn && !btn.hidden) btn.click(); else scrollToId('damage');
      return;
    }
    if (TOOL_SECTIONS.includes(target)) { setView('tools'); setHash(target); scrollToId(target); }
  }

  doc.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target.closest('[data-go]') : null;
    if (!el || el.closest('[aria-disabled="true"]')) return;
    e.preventDefault();
    go(el.dataset.go);
  });
  // Navigation innerhalb der Werkzeuge (Tabs) und Sprünge von außen (z. B. #storm in der Adresszeile)
  win.addEventListener('hashchange', () => {
    const v = initialView({ hash: win.location.hash, saved: root.dataset.view });
    if (v !== root.dataset.view) setView(v);
  });

  // ---------- Seitenmenü ----------
  $('menu-btn')?.addEventListener('click', () => { if (menu && !menu.open) { syncAccount(); menu.showModal(); } });
  $('menu-close')?.addEventListener('click', closeMenu);
  menu?.addEventListener('click', (e) => { if (e.target === menu) closeMenu(); }); // Tipp neben das Menü
  menu?.addEventListener('close', () => $('menu-btn')?.focus());

  // Sprache im Menü: dieselben Knöpfe wie in der Kopfzeile
  doc.querySelectorAll('[data-menu-lang]').forEach((b) => {
    b.addEventListener('click', () => doc.querySelector(`.lang-btn[data-lang="${b.dataset.menuLang}"]`)?.click());
  });
  const syncLang = () => doc.querySelectorAll('[data-menu-lang]').forEach((b) => b.setAttribute('aria-pressed', String(root.lang === b.dataset.menuLang)));

  // Konto im Menü und auf der Startseite spiegeln den Konto-Knopf der Kopfzeile (dort liegt die eigentliche Logik)
  function setI18n(el, key) { if (!el) return; el.dataset.i18n = key; el.textContent = t(key); }
  function syncAccount() {
    const btn = $('account-btn');
    if (!btn) return;
    const signedIn = btn.dataset.state === 'in';
    const name = $('acct-label')?.textContent.trim() || '';
    const nameEl = $('menu-acct-name');
    if (signedIn && name) { delete nameEl.dataset.i18n; nameEl.textContent = name; } else setI18n(nameEl, 'auth.btn.signIn');
    setI18n($('menu-acct-sub'), signedIn ? 'menu.acctIn' : 'menu.acctOut');
    const av = $('menu-avatar'); const src = $('acct-avatar');
    if (av && src) av.replaceChildren(...[...src.childNodes].map((n) => n.cloneNode(true)));
    setI18n($('start-account-label'), signedIn ? 'start.accountIn' : 'start.discord');
    $('start-account')?.classList.toggle('is-in', signedIn);
  }
  const acct = $('account-btn');
  if (acct && typeof MutationObserver === 'function') {
    new MutationObserver(syncAccount).observe(acct, { attributes: true, attributeFilter: ['data-state'], subtree: true, childList: true, characterData: true });
  }
  onLanguageChange(() => { syncLang(); syncAccount(); });

  setView(initialView({ hash: win.location.hash, search: win.location.search, saved: store.get() }));
  syncLang();
  syncAccount();
  return { go, setView, get view() { return root.dataset.view; } };
}
