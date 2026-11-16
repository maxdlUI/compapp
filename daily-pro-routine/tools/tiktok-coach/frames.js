const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } }); const e = []; p.on('pageerror', (x) => e.push(x.message));
  await p.goto('file://' + __dirname + '/overlay.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null; fs.mkdirSync(__dirname + '/fr', { recursive: true });
  const N = 510; for (let i = 0; i < N; i++) { const t = i / 30; if (only && !only.some((o) => Math.abs(o - t) < 1 / 60)) continue; await p.evaluate((t) => window.render(t), t); await p.screenshot({ path: `${__dirname}/fr/${only ? 'p' : 'f'}${String(i).padStart(4, '0')}.png`, omitBackground: true }); }
  console.log('done', e); await b.close(); })();
