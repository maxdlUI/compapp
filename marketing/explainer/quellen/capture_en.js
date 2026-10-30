const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://localhost:8765/';
const meta = {};
const rel = (r, c) => ({ x: r.x - c.x, y: r.y - c.y, w: r.width, h: r.height });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'en-US', reducedMotion: 'reduce' });
  await ctx.route(/supabase\.co/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('fnc.v1.lang', '"en"'); localStorage.setItem('fnc.v1.introSeen', '1'); sessionStorage.setItem('fnc.v1.introSession', '1'); } catch (e) {} });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.clock.install({ time: new Date('2026-10-30T18:00:00') });
  await p.goto(URL); await p.clock.pauseAt(new Date('2026-10-30T18:00:05')); await p.clock.runFor(3000); await p.waitForTimeout(800);
  await p.addStyleTag({ content: '.qual{display:none!important} .intro, #intro{display:none!important}' });
  await p.screenshot({ path: 'cap_en/home.png', fullPage: true });
  meta.home = await p.evaluate(() => { const o = {}; const q = (k, s) => { const e = document.querySelector(s); if (e) { const r = e.getBoundingClientRect(); o[k] = { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; } };
    q('hero', '.s-hero'); q('title', '#s-title'); q('tools', '.s-section'); q('faq', '#faq'); q('discord', '.s-discord'); q('header', 'header'); return { ...o, H: document.documentElement.scrollHeight }; });

  await p.goto(URL + '#tools'); await p.clock.runFor(2000); await p.waitForTimeout(800);
  await p.addStyleTag({ content: '.qual{display:none!important}' });
  await p.selectOption('#storm-rate', '10'); await p.clock.runFor(300);
  await p.screenshot({ path: 'cap_en/tools.png', fullPage: true });
  meta.tools = await p.evaluate(() => { const o = {}; for (const id of ['storm', 'damage', 'rotation', 'map']) { const r = document.getElementById(id).getBoundingClientRect(); o[id] = { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; } o.H = document.documentElement.scrollHeight; return o; });

  // STORM
  const storm = await p.$('#storm'); const sb = await storm.boundingBox();
  meta.storm = { start: rel(await (await p.$('#storm-toggle')).boundingBox(), sb), rate: rel(await (await p.$('#storm-rate')).boundingBox(), sb), alert: rel(await (await p.$('#storm-alert')).boundingBox(), sb), time: rel(await (await p.$('#storm-time')).boundingBox(), sb), w: sb.width, h: sb.height, step: .25 };
  await storm.screenshot({ path: 'cap_en/storm/ready.png' });
  await p.click('#storm-toggle');
  let n = 0;
  for (let g = 0; g <= 64; g += .25) { await storm.screenshot({ path: `cap_en/storm/${n++}.png` }); await p.clock.runFor(250); }
  meta.storm.n = n;
  await p.click('#storm-toggle'); await p.click('#storm-reset'); await p.clock.runFor(300);

  // NET DAMAGE
  const net = await p.$('#damage'); const nb = await net.boundingBox();
  const seq = [['dealt', 10], ['dealt', 10], ['dealt', 5], ['taken', 5], ['dealt', 10], ['dealt', 10], ['taken', 10], ['dealt', 10], ['dealt', 1], ['dealt', 10], ['taken', 5], ['dealt', 10]];
  meta.net = { w: nb.width, h: nb.height, clicks: [] };
  await net.screenshot({ path: 'cap_en/net/0.png' });
  for (let i = 0; i < seq.length; i++) {
    const [t, d] = seq[i]; const sel = `[data-target="${t}"][data-delta="${d}"]`;
    meta.net.clicks.push(rel(await (await p.$(sel)).boundingBox(), nb));
    await p.click(sel); await p.clock.runFor(200); await p.waitForTimeout(50);
    await net.screenshot({ path: `cap_en/net/${i + 1}.png` });
  }
  meta.net.n = seq.length + 1;

  // ROTATION
  const rot = await p.$('#rotation'); const rb = await rot.boundingBox();
  meta.rot = { w: rb.width, h: rb.height, start: rel(await (await p.$('#rot-toggle')).boundingBox(), rb), presets: rel(await (await p.$('#presets')).boundingBox(), rb), step: .25 };
  await rot.screenshot({ path: 'cap_en/rot/ready.png' });
  await p.click('#rot-toggle'); n = 0;
  for (let g = 0; g <= 24; g += .25) { await rot.screenshot({ path: `cap_en/rot/${n++}.png` }); await p.clock.runFor(250); }
  meta.rot.n = n;

  // MAP
  const mp = await p.$('#map'); const mb = await mp.boundingBox();
  await mp.screenshot({ path: 'cap_en/map_empty.png' });
  await p.setInputFiles('#map-input', 'usermap/map.png'); await p.clock.runFor(800); await p.waitForTimeout(800);
  const mb2 = await mp.boundingBox();
  await mp.screenshot({ path: 'cap_en/map_loaded.png' });
  meta.map = { w: mb2.width, h: mb2.height, full: rel(await (await p.$('#map-fullscreen')).boundingBox(), mb2) };
  await p.click('#map-fullscreen'); await p.clock.runFor(800); await p.waitForTimeout(600);
  await p.screenshot({ path: 'cap_en/map_viewer.png' });
  fs.writeFileSync('cap_en/meta.json', JSON.stringify(meta, null, 1));
  await b.close();
})();
