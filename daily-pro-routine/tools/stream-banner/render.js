const { chromium } = require('playwright');
const D = __dirname + '/';
const mode = process.argv[2] || 'test', variant = process.argv[3] || 'launch';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 240 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + D + 'banner.html' + (variant === 'evergreen' ? '?evergreen' : ''));
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const fs = require('fs');
  if (mode === 'test') {
    const ts = [0.5, 1.0, 2.5, 5.6, 7.5, 9.8, 13.9, 17.6];
    for (const t of ts) { await p.evaluate((t) => window.render(t), t); await p.screenshot({ path: D + 'test_' + t + '.png', omitBackground: true }); }
  } else {
    const dir = D + 'frames_' + variant + '/'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    const FPS = 30, LEN = 20;
    for (let i = 0; i < FPS * LEN; i++) { await p.evaluate((t) => window.render(t), i / FPS); await p.screenshot({ path: dir + String(i).padStart(4, '0') + '.png', omitBackground: true }); }
  }
  console.log('errors', errs); await b.close();
})();
