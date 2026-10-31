#!/usr/bin/env node
/*
 * Rendert den Clip frame-genau (mit Motion Blur) zu MP4.
 *   node motion/whatsapp-30s/render.cjs                 -> whatsapp-30s.mp4 (1080p30, mit Ton)
 *   node motion/whatsapp-30s/render.cjs --stills 1,5.5  -> PNG-Standbilder in ./stills
 * Voraussetzungen: Node, Playwright (Chromium), ffmpeg.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FPS = 30, DUR = 30;
const SAMPLES = parseInt(opt('--samples', '6'), 10);
const OUT = path.resolve(opt('--out', path.join(HERE, 'whatsapp-30s.mp4')));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.css': 'text/css', '.png': 'image/png' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/motion/whatsapp-30s/index.html?render=1`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('PAGE ERROR', e); process.exitCode = 1; });
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true);

  const stills = opt('--stills');
  if (stills) {
    const dir = path.resolve(opt('--dir', path.join(HERE, 'stills')));
    fs.mkdirSync(dir, { recursive: true });
    for (const s of stills.split(',')) {
      const t = parseFloat(s);
      const b64 = await page.evaluate(([f, n]) => window.renderFrameData(f, n, .92), [Math.round(t * FPS), SAMPLES > 1 ? 3 : 1]);
      fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.jpg`), Buffer.from(b64, 'base64'));
    }
    console.log('Standbilder in', dir);
  } else {
    const wav = path.join(HERE, 'soundtrack.wav');
    execFileSync(process.execPath, [path.join(HERE, 'soundtrack.cjs'), wav], { stdio: 'inherit' });
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', wav,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = FPS * DUR, t0 = Date.now();
    for (let f = 0; f < total; f++) {
      const b64 = await page.evaluate(([f, n]) => window.renderFrameData(f, n, .96), [f, SAMPLES]);
      if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 30 === 0) process.stdout.write(`\rFrame ${f}/${total}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    fs.unlinkSync(wav);
    console.log('\nFertig:', OUT);
  }
  await browser.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
