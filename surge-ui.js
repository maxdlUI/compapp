// Oberfläche der Storm-Surge-Auswertung. Lädt die versionierte Datendatei, prüft sie (surge.js) und zeigt
// Statistik pro Zone. Fehlen Daten oder schlägt das Laden fehl, bleibt der Rest der App unberührt.
// Es wird nie ein Live-Schwellenwert oder ein Status wie "über/unter Surge" ausgegeben.
import { t, getLang, getLocale } from './i18n.js';
import * as S from './surge.js';
import { formatNumber } from './logic.js';

const $ = (id) => document.getElementById(id);
const DATA_URL = 'surge-data.json';

/** getUserValues(): { dealt: Zahl|null, net: Zahl|null, hasInput: boolean } aus den aktuellen Net-Damage-Eingaben. */
export function initSurge({ getUserValues, fetchImpl = (...a) => fetch(...a), now = () => Date.now() }) {
  const ui = {
    badge: $('surge-badge'),
    error: $('surge-error'),
    retry: $('surge-retry'),
    fixture: $('surge-fixture'),
    dropped: $('surge-dropped'),
    empty: $('surge-empty'),
    data: $('surge-data'),
    group: $('surge-group'),
    zones: $('surge-zones'),
    detail: $('surge-detail'),
    sourcesBody: $('surge-sources-body'),
    meta: $('surge-meta'),
  };

  let status = 'loading'; // loading | error | invalid | ready
  let dataset = null;
  let dropped = 0;
  let groupId = null;
  let zone = null;
  let seq = 0;

  // Ganze Zahl in der Schreibweise der Sprache, negative Werte mit echtem Minuszeichen
  const num = (n) => {
    const r = Math.round(n);
    return `${r < 0 ? '−' : ''}${formatNumber(Math.abs(r), getLocale())}`;
  };

  function dateText(iso) {
    if (!iso) return t('common.unknown');
    const d = new Date(`${iso}T00:00:00`);
    return new Intl.DateTimeFormat(getLocale(), { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }

  // ---------- Laden ----------
  async function load() {
    const token = ++seq;
    status = 'loading';
    render();
    try {
      const res = await fetchImpl(DATA_URL, { cache: 'no-cache' });
      if (!res || !res.ok) throw new Error('http');
      const raw = await res.json();
      if (token !== seq) return;
      const result = S.validateDataset(raw);
      if (!result.ok) {
        status = 'invalid';
        dataset = null;
      } else {
        status = 'ready';
        dataset = result.dataset;
        dropped = result.droppedGroups;
        const groups = S.sortGroups(dataset.groups);
        groupId = groups.length ? groups[0].id : null;
        zone = null;
      }
    } catch {
      if (token !== seq) return;
      status = 'error';
      dataset = null;
    }
    render();
  }

  // ---------- Anzeige ----------
  const BADGE = { loading: 'surge.badge.loading', error: 'surge.badge.error', invalid: 'surge.badge.error' };

  function currentGroup() {
    return dataset ? dataset.groups.find((g) => g.id === groupId) || null : null;
  }

  function groupLabel(g) {
    const unknown = t('common.unknown');
    return `${g.tournament} · ${g.format || unknown} · ${g.gameVersion || unknown}`;
  }

  function row(dl, labelKey, value) {
    const dt = document.createElement('dt');
    dt.textContent = t(labelKey);
    const dd = document.createElement('dd');
    if (value instanceof Node) dd.append(value);
    else dd.textContent = value;
    dl.append(dt, dd);
  }

  function metricText(g) {
    const key = `surge.metric.${g.metric}`;
    const text = t(key);
    return text === key ? g.metric : text;
  }

  function renderDetail() {
    const g = currentGroup();
    ui.detail.replaceChildren();
    if (!g) return;
    const summaries = S.summarizeGroup(g);
    if (!summaries.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = t('surge.noZones');
      ui.detail.append(p);
      return;
    }
    const sel = summaries.find((z) => z.zone === zone) || summaries[0];

    // Kennzahlen
    const grid = document.createElement('div');
    grid.className = 'sgrid';
    const tile = (labelKey, value, extra) => {
      const d = document.createElement('div');
      d.className = 'stat';
      d.innerHTML = '<div class="stat-label"></div><div class="stat-value"></div>';
      d.firstChild.textContent = t(labelKey);
      d.lastChild.textContent = value;
      if (extra) d.classList.add(extra);
      grid.append(d);
    };
    // Median und Stichprobe nebeneinander, der Bereich bekommt eine eigene volle Zeile (lange Zahlen brechen sonst um)
    if (sel.stats) tile('surge.median', num(sel.stats.median));
    tile('surge.sample', t('surge.nValue', { n: formatNumber(sel.n, getLocale()) }));
    if (sel.stats) tile('surge.range', `${num(sel.stats.p10)} – ${num(sel.stats.p90)}`, 'stat-wide');
    ui.detail.append(grid);

    const q = document.createElement('p');
    q.className = 'q-badge';
    q.dataset.quality = sel.quality;
    q.textContent = t(`surge.q.${sel.quality}`, { min: sel.quality === 'insufficient' ? S.MIN_N_STATS : S.MIN_N_COMPARE });
    ui.detail.append(q);

    if (sel.stats) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = t('surge.rangeNote');
      ui.detail.append(note);
    }

    // Vergleich mit den eigenen Eingaben
    const cmp = document.createElement('div');
    cmp.className = 'cmp';
    const title = document.createElement('div');
    title.className = 'cmp-title';
    title.textContent = t('surge.cmp.title');
    cmp.append(title);
    const user = getUserValues();
    const result = !user.hasInput && S.COMPARABLE[g.metric] ? { status: 'unavailable', reason: 'empty' } : S.compareToZone(g, sel, user);
    const line = document.createElement('p');
    line.className = 'cmp-line';
    if (result.status === 'ok') {
      line.dataset.position = result.position;
      const who = t(result.field === 'dealt' ? 'surge.cmp.dealt' : 'surge.cmp.net', { v: num(result.value) });
      line.textContent = `${who} → ${t(`surge.cmp.${result.position}`)}`;
      cmp.append(line);
      const basis = document.createElement('p');
      basis.className = 'hint';
      basis.textContent = t('surge.cmp.basis', { n: formatNumber(sel.n, getLocale()), group: groupLabel(g), zone: sel.zone, a: num(sel.stats.p25), b: num(sel.stats.p75) });
      cmp.append(basis);
      const caveat = document.createElement('p');
      caveat.className = 'hint';
      caveat.textContent = t('surge.cmp.caveat');
      cmp.append(caveat);
    } else {
      line.textContent = t(`surge.cmp.no.${result.reason}`, { min: S.MIN_N_COMPARE });
      cmp.append(line);
    }
    ui.detail.append(cmp);

    // Warnungen zur Vergleichbarkeit
    const warnings = S.groupWarnings(g, now());
    if (warnings.length) {
      const ul = document.createElement('ul');
      ul.className = 'warn-list';
      warnings.forEach((w) => {
        const li = document.createElement('li');
        li.textContent = t(`surge.w.${w}`, { days: S.STALE_DAYS });
        ul.append(li);
      });
      ui.detail.append(ul);
    }

    // Herkunft
    const src = dataset.sources.find((s) => s.id === g.sourceId);
    const dl = document.createElement('dl');
    dl.className = 'meta';
    row(dl, 'surge.meta.tournament', g.tournament);
    row(dl, 'surge.meta.version', g.gameVersion || t('common.unknown'));
    row(dl, 'surge.meta.format', g.format || t('common.unknown'));
    if (g.region) row(dl, 'surge.meta.region', g.region);
    row(dl, 'surge.meta.metric', metricText(g));
    row(dl, 'surge.meta.definition', g.metricDefinition);
    if (g.observationUnit) row(dl, 'surge.meta.unit', g.observationUnit);
    if (src) {
      const a = document.createElement('a');
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = src.title;
      row(dl, 'surge.meta.source', a);
    }
    row(dl, 'surge.meta.asOf', dateText(g.asOf));
    row(dl, 'surge.meta.method', g.method);
    if (sel.stats) {
      row(dl, 'surge.midHalf', `${num(sel.stats.p25)} – ${num(sel.stats.p75)}`);
      row(dl, 'surge.minMax', `${num(sel.stats.min)} – ${num(sel.stats.max)}`);
    }
    ui.detail.append(dl);
  }

  function renderPickers() {
    const groups = S.sortGroups(dataset.groups);
    ui.group.replaceChildren(
      ...groups.map((g) => {
        const o = document.createElement('option');
        o.value = g.id;
        o.textContent = groupLabel(g);
        return o;
      })
    );
    ui.group.value = groupId;
    ui.group.hidden = groups.length < 2; // eine einzelne Gruppe braucht keine Auswahl, sie steht in den Details
    const g = currentGroup();
    const summaries = g ? S.summarizeGroup(g) : [];
    if (zone === null || !summaries.some((z) => z.zone === zone)) zone = summaries.length ? summaries[0].zone : null;
    ui.zones.replaceChildren(
      ...summaries.map((z) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'zone-chip';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(z.zone === zone));
        b.dataset.zone = String(z.zone);
        b.tabIndex = z.zone === zone ? 0 : -1;
        b.textContent = t('surge.zoneLabel', { n: z.zone });
        b.dataset.quality = z.quality;
        return b;
      })
    );
  }

  function renderSources() {
    ui.sourcesBody.replaceChildren();
    if (!dataset) return;
    const lang = getLang();
    if (dataset.reviewedSources.length) {
      const intro = document.createElement('p');
      intro.className = 'hint';
      const latest = dataset.reviewedSources.map((r) => r.accessed).filter(Boolean).sort().pop() || null;
      intro.textContent = t('surge.sourcesIntro', { date: dateText(latest) });
      const ul = document.createElement('ul');
      ul.className = 'src-list';
      dataset.reviewedSources.forEach((r) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = r.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = r.title;
        const span = document.createElement('span');
        span.textContent = r.finding[lang];
        li.append(a, span);
        ul.append(li);
      });
      ui.sourcesBody.append(intro, ul);
    }
    const method = document.createElement('p');
    method.className = 'hint';
    method.textContent = t('surge.sourcesMethod');
    ui.sourcesBody.append(method);
  }

  function render() {
    const ready = status === 'ready' && dataset;
    const state = ready ? S.datasetState(dataset) : status;
    ui.badge.dataset.state = state;
    ui.badge.textContent = ready ? t(`surge.badge.${state}`) : t(BADGE[status] || 'surge.badge.error');

    const failed = status === 'error' || status === 'invalid';
    ui.error.hidden = !failed;
    ui.error.textContent = failed ? t(status === 'error' ? 'surge.error' : 'surge.invalid') : '';
    ui.retry.hidden = !failed;

    ui.fixture.hidden = !(ready && dataset.kind === 'test-fixture');
    if (!ui.fixture.hidden) ui.fixture.textContent = t('surge.fixture');
    ui.dropped.hidden = !(ready && dropped > 0);
    if (!ui.dropped.hidden) ui.dropped.textContent = t('surge.dropped', { n: dropped });

    ui.empty.hidden = !(ready && dataset.groups.length === 0);
    ui.data.hidden = !(ready && dataset.groups.length > 0);
    if (!ui.data.hidden) {
      renderPickers();
      renderDetail();
    }
    renderSources();

    if (ready) {
      const stale = S.isStale(dataset.updated, now());
      const key = dataset.updated ? 'surge.dataset' : 'surge.datasetNoDate';
      ui.meta.textContent = `${t(key, { v: dataset.datasetVersion, date: dateText(dataset.updated), n: dataset.groups.length })}${stale ? ` · ${t('surge.w.stale', { days: S.STALE_DAYS })}` : ''}`;
    } else {
      ui.meta.textContent = '';
    }
  }

  // ---------- Bedienung ----------
  ui.retry.addEventListener('click', load);
  ui.group.addEventListener('change', () => {
    groupId = ui.group.value;
    zone = null;
    render();
  });
  ui.zones.addEventListener('click', (e) => {
    const b = e.target.closest('.zone-chip');
    if (!b) return;
    zone = Number(b.dataset.zone);
    render();
    const again = ui.zones.querySelector(`[data-zone="${zone}"]`);
    if (again) again.focus();
  });
  ui.zones.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const chips = [...ui.zones.querySelectorAll('.zone-chip')];
    const idx = chips.findIndex((c) => c.getAttribute('aria-checked') === 'true');
    const next = chips[(idx + (e.key === 'ArrowRight' ? 1 : -1) + chips.length) % chips.length];
    if (!next) return;
    e.preventDefault();
    zone = Number(next.dataset.zone);
    render();
    ui.zones.querySelector(`[data-zone="${zone}"]`).focus();
  });

  load();
  return { render, reload: load };
}
