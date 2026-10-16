// Verwaltung von "Estimated Qual" (nur für Administratoren).
//
// Wichtig: Diese Oberfläche ist reine Bequemlichkeit. Sie zeigt nur an und schickt Anfragen mit dem Token des angemeldeten Nutzers.
// Ob eine Änderung erlaubt ist, entscheidet bei JEDER Anfrage die Datenbank (Zeilenregeln, Spaltenrechte, Speicherregeln,
// siehe supabase/002_krevo_admin_estimated_qual.sql). Wer diese Datei im Browser manipuliert, bekommt trotzdem nur Fehlermeldungen.
//
// Ablauf: Entwurf bearbeiten (Punkte, Bild) -> "Entwurf speichern" -> "Veröffentlichen". Der Entwurf ist für Besucher unsichtbar;
// erst "Veröffentlichen" übernimmt ihn in den öffentlichen Stand. Der Schalter blendet den Banner für alle ein oder aus
// und lässt den veröffentlichten Stand unverändert gespeichert.

import { t, getLocale, onLanguageChange } from './i18n.js';
import { errorKey } from './auth-ui.js';
import { parsePoints, checkImageFile, newImageName, draftStatus, hasValidPublished, formatPoints, publicImageUrl, BUCKET } from './qual.js';
import { createBannerElement } from './qual-public.js';

const err = (code) => Object.assign(new Error(code), { code });

/**
 * @param {object} o
 * @param {object} o.auth            Auth-Client (authclient.js)
 * @param {string} o.baseUrl         Projekt-URL (für öffentliche Bildadressen)
 * @param {Document} [o.doc]
 * @param {Function} [o.onPublicChange]  wird nach Schalter und Veröffentlichung aufgerufen (öffentlichen Banner neu laden)
 */
export function initAdmin({ auth, baseUrl, doc = document, onPublicChange = () => {} }) {
  const $ = (id) => doc.getElementById(id);
  const dlg = $('admin-dialog');
  if (!dlg) return null;
  const els = {
    title: $('adm-title'), close: $('adm-close'),
    state: $('adm-state'), stateText: $('adm-state-text'), retry: $('adm-retry'),
    main: $('adm-main'),
    sw: $('adm-switch'), swText: $('adm-switch-text'), live: $('adm-live'),
    points: $('adm-points'), pointsHint: $('adm-points-hint'),
    thumb: $('adm-thumb'), imageStatus: $('adm-image-status'), choose: $('adm-choose'), remove: $('adm-remove'), file: $('adm-file'),
    preview: $('adm-preview'), previewEmpty: $('adm-preview-empty'),
    draftState: $('adm-draft-state'), save: $('adm-save'), publish: $('adm-publish'), published: $('adm-published'), error: $('adm-error'),
  };

  let loadState = 'idle'; // idle | loading | ready | error
  let loadErr = '';
  let server = null; // Zeile aus der Datenbank (nur für Administratoren lesbar)
  let busy = false;
  let local = freshLocal();
  let note = null; // { key, params, kind } Rückmeldung zur letzten Aktion
  let imageErr = '';
  let previewKey = '';

  function freshLocal() { return { pointsText: '', file: null, fileInfo: null, blobUrl: '', removeImage: false }; }
  function revokeBlob() { if (local.blobUrl) { try { URL.revokeObjectURL(local.blobUrl); } catch { /* egal */ } } }
  function resetLocal() {
    revokeBlob();
    local = freshLocal();
    local.pointsText = server && server.draft_points != null ? String(server.draft_points) : '';
  }

  // ---------------------------------------------------------------- abgeleitete Zustände
  const serverPointsText = () => (server && server.draft_points != null ? String(server.draft_points) : '');
  const pointsDirty = () => local.pointsText.trim() !== serverPointsText();
  const imageDirty = () => !!local.file || local.removeImage;
  const dirty = () => pointsDirty() || imageDirty();
  const effectiveImage = () => {
    if (local.file) return { url: local.blobUrl, local: true };
    if (local.removeImage || !server || !server.draft_image) return null;
    const url = publicImageUrl(baseUrl, server.draft_image);
    return url ? { url, local: false } : null;
  };

  // ---------------------------------------------------------------- Anzeige
  function setStatus(el, kind, key, params) {
    el.dataset.kind = kind || '';
    el.textContent = key ? t(key, params) : '';
  }

  function showError(e) {
    const key = errorKey(e && e.code ? e.code : 'unknown');
    els.error.dataset.key = key;
    els.error.textContent = t(key);
    els.error.hidden = false;
  }
  function clearError() { els.error.hidden = true; els.error.textContent = ''; delete els.error.dataset.key; }

  function render() {
    const loading = loadState === 'loading' || loadState === 'idle';
    els.state.hidden = loadState === 'ready';
    els.main.hidden = loadState !== 'ready';
    els.retry.hidden = loadState !== 'error';
    if (loading) setStatus(els.stateText, '', 'admin.loading');
    if (loadState === 'error') setStatus(els.stateText, 'error', loadErr);
    if (loadState !== 'ready' || !server) return;

    // Schalter und Sichtbarkeit
    const on = !!server.enabled;
    els.sw.setAttribute('aria-checked', String(on));
    els.sw.dataset.on = on ? '1' : '0';
    els.swText.textContent = t(on ? 'admin.switch.on' : 'admin.switch.off');
    els.sw.disabled = busy;
    const valid = hasValidPublished(server);
    if (on && valid) setStatus(els.live, 'ok', 'admin.live.visible');
    else if (on) setStatus(els.live, 'warn', 'admin.live.hiddenNoContent');
    else setStatus(els.live, '', 'admin.live.hiddenOff');

    // Punkte
    if (doc.activeElement !== els.points && els.points.value !== local.pointsText) els.points.value = local.pointsText;
    const pts = parsePoints(local.pointsText);
    els.points.disabled = busy;
    if (pts.ok) { els.points.removeAttribute('aria-invalid'); setStatus(els.pointsHint, '', 'admin.points.hint'); }
    else if (pts.code === 'empty') { els.points.removeAttribute('aria-invalid'); setStatus(els.pointsHint, 'warn', 'admin.points.empty'); }
    else { els.points.setAttribute('aria-invalid', 'true'); setStatus(els.pointsHint, 'error', `admin.points.err.${pts.code}`); }

    // Bild
    const img = effectiveImage();
    els.thumb.replaceChildren();
    els.thumb.dataset.has = img ? '1' : '0';
    if (img) {
      const el = doc.createElement('img');
      el.alt = '';
      el.decoding = 'async';
      el.referrerPolicy = 'no-referrer';
      el.addEventListener('error', () => { el.remove(); els.thumb.dataset.has = '0'; });
      el.src = img.url;
      els.thumb.append(el);
    }
    if (imageErr) setStatus(els.imageStatus, 'error', imageErr);
    else if (local.file) setStatus(els.imageStatus, 'warn', 'admin.image.pending');
    else if (local.removeImage) setStatus(els.imageStatus, 'warn', 'admin.image.removePending');
    else if (img) setStatus(els.imageStatus, 'ok', 'admin.image.saved');
    else setStatus(els.imageStatus, '', 'admin.image.none');
    els.choose.textContent = t(img ? 'admin.image.replace' : 'admin.image.choose');
    els.choose.disabled = busy;
    els.remove.hidden = !img;
    els.remove.disabled = busy;

    // Vorschau (zeigt den aktuellen Entwurf inklusive noch nicht gespeicherter Eingaben)
    const key = pts.ok ? `${pts.value}|${img ? img.url : ''}|${getLocale()}` : '';
    if (key !== previewKey) {
      previewKey = key;
      els.preview.replaceChildren();
      if (pts.ok) els.preview.append(createBannerElement(doc, { points: pts.value, imageUrl: img ? img.url : null }, { preview: true }));
    }
    els.previewEmpty.hidden = pts.ok;
    els.preview.hidden = !pts.ok;

    // Entwurf, Veröffentlichung, Knöpfe
    const ds = draftStatus(server);
    const isDirty = dirty();
    if (isDirty) setStatus(els.draftState, 'warn', 'admin.draft.unsaved');
    else if (note) setStatus(els.draftState, note.kind, note.key, note.params);
    else setStatus(els.draftState, '', null);

    if (valid) {
      const date = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long', timeStyle: 'short' }).format(new Date(server.published_at));
      const base = t('admin.published.current', { value: formatPoints(server.published_points, getLocale()), date });
      const rel = isDirty ? '' : ds === 'in_sync' ? ` ${t('admin.published.sync')}` : ds === 'changed' ? ` ${t('admin.published.differs')}` : '';
      els.published.dataset.kind = '';
      els.published.textContent = base + rel;
    } else setStatus(els.published, '', 'admin.published.none');

    const canSave = !busy && isDirty && (pts.ok || pts.code === 'empty');
    els.save.disabled = !canSave;
    els.save.textContent = t(busy === 'save' ? 'admin.draft.saving' : 'admin.draft.save');
    els.publish.disabled = busy || isDirty || !(ds === 'unpublished' || ds === 'changed');
    els.publish.textContent = t(busy === 'publish' ? 'admin.publishing' : 'admin.publish');
  }

  // ---------------------------------------------------------------- Daten laden und schreiben
  async function fetchRow() {
    const rows = await auth.rest('/estimated_qual', { query: { select: '*', id: 'eq.1' } });
    if (!Array.isArray(rows) || rows.length === 0) throw err('forbidden'); // ohne Admin-Recht liefert die Datenbank keine Zeile
    return rows[0];
  }

  async function load() {
    loadState = 'loading';
    render();
    try {
      server = await fetchRow();
      loadState = 'ready';
      resetLocal();
      note = null;
      imageErr = '';
      previewKey = '\u0000';
    } catch (e) {
      loadState = 'error';
      const k = errorKey(e && e.code ? e.code : 'unknown');
      loadErr = e && e.code === 'forbidden' ? 'admin.notAdmin' : k === 'auth.err.unknown' ? 'admin.loadError' : k;
    }
    render();
  }

  const bestEffortDelete = (name) => { if (name) auth.deleteFile(BUCKET, name).catch(() => { /* verwaiste Datei ist harmlos */ }); };

  async function run(kind, fn) {
    if (busy) return;
    busy = kind;
    clearError();
    render();
    try { await fn(); } catch (e) {
      showError(e);
      if (e && e.code === 'session_expired') { /* Anmeldedialog übernimmt die Rückkehr */ }
    } finally {
      busy = false;
      render();
    }
  }

  async function toggle() {
    await run('toggle', async () => {
      const next = !server.enabled;
      const rows = await auth.rest('/estimated_qual', { method: 'PATCH', query: { id: 'eq.1' }, body: { enabled: next }, prefer: 'return=representation' });
      if (!Array.isArray(rows) || !rows[0]) throw err('forbidden');
      server = rows[0];
      note = { key: next ? 'admin.switch.savedOn' : 'admin.switch.savedOff', kind: 'ok' };
      onPublicChange();
    });
  }

  async function saveDraft() {
    await run('save', async () => {
      const pts = parsePoints(local.pointsText);
      if (!pts.ok && pts.code !== 'empty') throw err('qual_invalid');
      const patch = { draft_points: pts.ok ? pts.value : null };
      let uploaded = null;
      const oldDraft = server.draft_image;
      try {
        if (local.file) {
          uploaded = newImageName(local.fileInfo.ext);
          await auth.uploadFile(BUCKET, uploaded, local.file, local.fileInfo.type);
          patch.draft_image = uploaded;
        } else if (local.removeImage) patch.draft_image = null;
        const rows = await auth.rest('/estimated_qual', { method: 'PATCH', query: { id: 'eq.1' }, body: patch, prefer: 'return=representation' });
        if (!Array.isArray(rows) || !rows[0]) throw err('forbidden');
        server = rows[0];
      } catch (e) {
        bestEffortDelete(uploaded); // Datenbank hat den Entwurf nicht übernommen: hochgeladene Datei wieder entfernen
        throw e;
      }
      if (oldDraft && oldDraft !== server.draft_image && oldDraft !== server.published_image) bestEffortDelete(oldDraft); // nicht mehr gebrauchtes Entwurfsbild
      resetLocal();
      imageErr = '';
      note = { key: 'admin.draft.saved', kind: 'ok' };
    });
  }

  async function publish() {
    await run('publish', async () => {
      const oldPublished = server.published_image;
      await auth.rest('/rpc/estimated_qual_publish', { method: 'POST', body: {} });
      server = await fetchRow();
      if (oldPublished && oldPublished !== server.published_image && oldPublished !== server.draft_image) bestEffortDelete(oldPublished);
      note = { key: 'admin.published.done', kind: 'ok' };
      onPublicChange();
    });
  }

  // ---------------------------------------------------------------- Eingaben
  els.points.addEventListener('input', () => {
    local.pointsText = els.points.value;
    note = null;
    render();
  });

  els.choose.addEventListener('click', () => { if (!busy) els.file.click(); });
  els.file.addEventListener('change', async () => {
    const f = els.file.files && els.file.files[0];
    els.file.value = '';
    if (!f) return;
    clearError();
    let head;
    try { head = new Uint8Array(await f.slice(0, 16).arrayBuffer()); } catch { imageErr = 'admin.image.err.read'; render(); return; }
    const chk = checkImageFile(f, head);
    if (!chk.ok) { imageErr = `admin.image.err.${chk.code}`; render(); return; } // abgelehnte Datei ändert nichts am Entwurf
    imageErr = '';
    note = null;
    revokeBlob();
    local.file = f;
    local.fileInfo = chk;
    local.removeImage = false;
    local.blobUrl = URL.createObjectURL(f); // nur für die lokale Vorschau; gespeichert wird später der Dateiname im Speicher
    render();
  });
  els.remove.addEventListener('click', () => {
    if (busy) return;
    revokeBlob();
    local.file = null;
    local.fileInfo = null;
    local.blobUrl = '';
    local.removeImage = !!(server && server.draft_image);
    imageErr = '';
    note = null;
    render();
  });

  els.sw.addEventListener('click', toggle);
  els.save.addEventListener('click', saveDraft);
  els.publish.addEventListener('click', publish);
  els.retry.addEventListener('click', load);

  // ---------------------------------------------------------------- Dialog
  function open() {
    if (!dlg.open) { try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); } }
    clearError();
    load();
    setTimeout(() => els.title.focus({ preventScroll: true }), 0);
  }
  function close() {
    if (dlg.open) { try { dlg.close(); } catch { dlg.removeAttribute('open'); } }
    afterClose();
  }
  function afterClose() {
    revokeBlob();
    local = freshLocal();
    server = null;
    loadState = 'idle';
    previewKey = '';
    els.preview.replaceChildren();
    clearError();
  }
  els.close.addEventListener('click', close);
  dlg.addEventListener('close', () => { if (!dlg.open) afterClose(); });
  // Anders als beim Konto-Dialog schließt ein Klick daneben NICHT: ungespeicherte Eingaben sollen nicht versehentlich verloren gehen.

  auth.onChange((s) => { if (dlg.open && s.status !== 'in') close(); }); // abgemeldet oder Sitzung abgelaufen
  onLanguageChange(() => {
    previewKey = '\u0000';
    if (els.error.dataset.key) els.error.textContent = t(els.error.dataset.key);
    if (dlg.open) render();
  });

  return { open, close, get isOpen() { return dlg.open; } };
}
