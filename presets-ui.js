// Oberfläche für Rotation-Presets: Auswahl (Radiogruppe) und Editor.
// Der Editor arbeitet auf einem Entwurf. Erst "Speichern" prüft alles und übernimmt es; "Abbrechen" verwirft den Entwurf.
// Der Zustand (Presets, Countdown) gehört app.js. Hier gibt es nur Callbacks, keine eigene Speicherung.
import { t } from './i18n.js';
import * as P from './presets.js';
import { formatPreset, rotationCanSwitch } from './logic.js';

const $ = (id) => document.getElementById(id);

/**
 * getPresets(): aktuelle Liste. getRotation(): aktueller Countdown-Zustand.
 * onSelect(preset): Nutzer wählt ein Preset. onSave(items): neue Liste übernehmen, liefert { persisted }.
 */
export function initPresetUI({ getPresets, getRotation, onSelect, onSave }) {
  const ui = {
    picker: $('presets'),
    locked: $('preset-locked'),
    editBtn: $('preset-edit'),
    editor: $('preset-editor'),
    title: $('pe-title'),
    list: $('pe-list'),
    error: $('pe-error'),
    add: $('pe-add'),
    defaults: $('pe-defaults'),
    cancel: $('pe-cancel'),
    save: $('pe-save'),
    status: $('pe-status'),
  };

  let draft = null; // null = Editor geschlossen, sonst [{ id, name, min, sec }]
  let errors = []; // Fehler der letzten Prüfung: { index, field, code }
  let listError = null; // { key } Übersetzungsschlüssel für Fehler, die die ganze Liste betreffen
  let status = null; // { keys: [...], kind }
  let statusTimer = null;

  const say = (keys, kind = 'ok') => {
    status = keys ? { keys, kind } : null;
    clearTimeout(statusTimer);
    if (status && kind === 'ok') statusTimer = setTimeout(() => { status = null; renderStatus(); }, 7000);
    renderStatus();
  };

  // ---------- Auswahl ----------
  function renderPicker() {
    const presets = getPresets();
    const rot = getRotation();
    const canSwitch = rotationCanSwitch(rot);
    const hasSelection = presets.some((p) => p.id === rot.presetId);
    ui.picker.replaceChildren(
      ...presets.map((p, i) => {
        const label = P.presetLabel(p);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'preset';
        b.setAttribute('role', 'radio');
        b.dataset.id = p.id;
        const checked = p.id === rot.presetId;
        b.setAttribute('aria-checked', String(checked));
        b.setAttribute('aria-disabled', String(!canSwitch));
        b.tabIndex = checked || (!hasSelection && i === 0) ? 0 : -1;
        const time = document.createElement('span');
        time.className = 'preset-time';
        time.textContent = label.time;
        if (label.title) {
          const name = document.createElement('span');
          name.className = 'preset-name';
          name.textContent = label.title; // Nutzername, wird nie übersetzt
          b.append(name, time);
        } else {
          b.append(time);
        }
        const { minutes, seconds } = P.splitDuration(p.seconds);
        b.setAttribute('aria-label', `${label.title ? `${label.title}, ` : ''}${t('rot.duration', { m: minutes, s: seconds })}`);
        return b;
      })
    );
    ui.picker.dataset.count = String(presets.length);
    ui.locked.hidden = canSwitch;
  }

  ui.picker.addEventListener('click', (e) => {
    const b = e.target.closest('.preset');
    if (!b) return;
    const preset = getPresets().find((p) => p.id === b.dataset.id);
    if (preset) onSelect(preset);
  });
  ui.picker.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const presets = getPresets();
    if (!rotationCanSwitch(getRotation()) || presets.length < 2) return;
    const idx = Math.max(0, presets.findIndex((p) => p.id === getRotation().presetId));
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = presets[(idx + dir + presets.length) % presets.length];
    e.preventDefault();
    onSelect(next);
    const btn = ui.picker.querySelector(`[data-id="${CSS.escape(next.id)}"]`);
    if (btn) btn.focus();
  });

  // ---------- Editor ----------
  const errorText = (err) => t(`pe.err.${err.code}`, { max: err.code === 'long' ? P.PRESET_NAME_MAX : P.PRESET_MAX_COUNT });

  function rowFromPreset(p) {
    const { minutes, seconds } = P.splitDuration(p.seconds);
    return { id: p.id, name: p.name, min: String(minutes), sec: String(seconds) };
  }

  function makeField(labelKey, attrs) {
    const wrap = document.createElement('label');
    wrap.className = 'pe-field';
    const cap = document.createElement('span');
    cap.className = 'pe-lab';
    cap.textContent = t(labelKey);
    const input = document.createElement('input');
    input.type = 'text';
    Object.entries(attrs).forEach(([k, v]) => input.setAttribute(k, v));
    wrap.append(cap, input);
    return { wrap, input };
  }

  function makeIconButton(action, icon, labelKey, n, disabled) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn btn-icon pe-btn pe-${action}`;
    b.dataset.action = action;
    b.setAttribute('aria-label', t(labelKey, { n }));
    b.setAttribute('title', t(`pe.${action}`));
    if (disabled) b.setAttribute('aria-disabled', 'true');
    b.innerHTML = `<svg class="i" aria-hidden="true"><use href="#i-${icon}"/></svg>`;
    return b;
  }

  function renderEditor() {
    if (!draft) return;
    ui.list.replaceChildren(
      ...draft.map((row, index) => {
        const n = index + 1;
        const li = document.createElement('li');
        li.className = 'pe-row';
        li.dataset.id = row.id;

        const name = makeField('pe.name', { 'data-f': 'name', maxlength: String(P.PRESET_NAME_MAX), autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: t('pe.namePlaceholder'), 'aria-label': `${t('pe.rowLabel', { n })}: ${t('pe.name')}` });
        name.wrap.classList.add('pe-name');
        name.input.value = row.name;
        const min = makeField('pe.min', { 'data-f': 'min', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '2', autocomplete: 'off', 'aria-label': `${t('pe.rowLabel', { n })}: ${t('pe.min')}` });
        min.input.value = row.min;
        const sec = makeField('pe.sec', { 'data-f': 'sec', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '2', autocomplete: 'off', 'aria-label': `${t('pe.rowLabel', { n })}: ${t('pe.sec')}` });
        sec.input.value = row.sec;
        const colon = document.createElement('span');
        colon.className = 'pe-colon';
        colon.setAttribute('aria-hidden', 'true');
        colon.textContent = ':';
        const time = document.createElement('div');
        time.className = 'pe-time';
        time.append(min.wrap, colon, sec.wrap);

        const btns = document.createElement('div');
        btns.className = 'pe-btns';
        btns.append(
          makeIconButton('up', 'up', 'pe.upLabel', n, index === 0),
          makeIconButton('down', 'down', 'pe.downLabel', n, index === draft.length - 1),
          makeIconButton('delete', 'trash', 'pe.deleteLabel', n, draft.length <= 1)
        );

        const err = document.createElement('p');
        err.className = 'field-error row-error';
        err.hidden = true;

        li.append(name.wrap, time, btns, err);
        const rowErrors = errors.filter((e) => e.index === index);
        if (rowErrors.length) {
          err.hidden = false;
          err.textContent = rowErrors.map(errorText).join(' ');
          rowErrors.forEach((e) => {
            const target = li.querySelector(`[data-f="${e.field}"]`);
            if (target) target.setAttribute('aria-invalid', 'true');
          });
        }
        return li;
      })
    );
    ui.add.setAttribute('aria-disabled', String(draft.length >= P.PRESET_MAX_COUNT));
    ui.error.hidden = !listError;
    if (listError) ui.error.textContent = t(listError.key, { max: P.PRESET_MAX_COUNT });
  }

  function renderStatus() {
    const text = status ? status.keys.map((k) => t(k)).join(' ') : '';
    if (ui.status.textContent !== text) ui.status.textContent = text;
    ui.status.dataset.kind = status ? status.kind : '';
  }

  function focusRow(id, selector) {
    const el = ui.list.querySelector(`[data-id="${CSS.escape(id)}"] ${selector}`);
    if (el) el.focus();
  }

  function openEditor() {
    draft = getPresets().map(rowFromPreset);
    errors = [];
    listError = null;
    ui.editor.hidden = false;
    ui.editBtn.setAttribute('aria-expanded', 'true');
    status = null;
    renderStatus();
    renderEditor();
    ui.title.focus();
    ui.editor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function closeEditor() {
    draft = null;
    errors = [];
    listError = null;
    ui.editor.hidden = true;
    ui.list.replaceChildren(); // keine veralteten, beschrifteten Zeilen im versteckten Bereich zurücklassen
    ui.editBtn.setAttribute('aria-expanded', 'false');
    ui.editBtn.focus();
  }

  ui.editBtn.addEventListener('click', () => (draft ? closeEditor() : openEditor()));
  ui.cancel.addEventListener('click', () => {
    closeEditor();
    say(null);
  });

  ui.add.addEventListener('click', () => {
    if (!draft) return;
    if (draft.length >= P.PRESET_MAX_COUNT) {
      listError = { key: 'pe.err.count' };
      renderEditor();
      return;
    }
    listError = null;
    const row = { id: P.newPresetId(draft), name: '', min: '2', sec: '0' };
    draft = [...draft, row];
    renderEditor();
    focusRow(row.id, '[data-f="name"]');
  });

  ui.defaults.addEventListener('click', () => {
    if (!draft) return;
    draft = P.defaultPresets().map(rowFromPreset);
    errors = [];
    listError = null;
    renderEditor();
  });

  // Eingaben nur im Entwurf festhalten, ohne die Liste neu zu zeichnen (Fokus und Tastatur bleiben erhalten)
  ui.list.addEventListener('input', (e) => {
    const field = e.target.dataset && e.target.dataset.f;
    const li = e.target.closest('.pe-row');
    if (!field || !li || !draft) return;
    const row = draft.find((r) => r.id === li.dataset.id);
    if (!row) return;
    row[field] = e.target.value;
    // Fehler dieser Zeile verschwinden, sobald der Nutzer tippt
    const index = draft.indexOf(row);
    if (errors.some((x) => x.index === index)) {
      errors = errors.filter((x) => x.index !== index);
      li.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      const err = li.querySelector('.row-error');
      err.hidden = true;
      err.textContent = '';
    }
  });

  ui.list.addEventListener('click', (e) => {
    const btn = e.target.closest('.pe-btn');
    const li = e.target.closest('.pe-row');
    if (!btn || !li || !draft) return;
    const index = draft.findIndex((r) => r.id === li.dataset.id);
    const action = btn.dataset.action;
    listError = null;
    if (action === 'delete') {
      if (draft.length <= 1) {
        listError = { key: 'pe.err.none' };
        renderEditor();
        return;
      }
      draft = draft.filter((_, i) => i !== index);
      errors = [];
      renderEditor();
      const next = draft[Math.min(index, draft.length - 1)];
      focusRow(next.id, '[data-f="name"]');
      return;
    }
    const dir = action === 'up' ? -1 : 1;
    const moved = P.moveItem(draft, index, dir);
    if (moved === draft) return; // am Rand
    draft = moved;
    errors = [];
    renderEditor();
    focusRow(li.dataset.id, `[data-action="${action}"]`);
  });

  ui.save.addEventListener('click', () => {
    if (!draft) return;
    const result = P.validateDraft(draft);
    if (!result.ok) {
      errors = result.errors.filter((x) => x.index >= 0);
      const general = result.errors.find((x) => x.index < 0);
      listError = general ? { key: `pe.err.${general.code}` } : errors.length ? { key: 'pe.fixErrors' } : null;
      renderEditor();
      const first = errors[0];
      if (first) focusRow(draft[first.index].id, `[data-f="${first.field === 'minutes' ? 'min' : first.field === 'seconds' ? 'sec' : 'name'}"]`);
      return;
    }
    const wasActive = !rotationCanSwitch(getRotation());
    const { persisted } = onSave(result.items);
    closeEditor();
    const keys = [persisted ? 'pe.saved' : 'pe.saveFailed'];
    if (wasActive) keys.push('pe.activeNote');
    say(keys, persisted ? 'ok' : 'warn');
  });

  function render() {
    renderPicker();
    if (draft) renderEditor();
    renderStatus();
  }

  return { render, renderPicker, isEditing: () => draft !== null };
}
