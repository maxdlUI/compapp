const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process');
const REPO = require('path').resolve(__dirname, '../..');
const mode = process.argv[2] || 'stills';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('PAGEERR', e.message));
  await p.goto('file://' + path.join(__dirname, 'ad.html'));
  const fonts = [['Unbounded', 500], ['Unbounded', 600], ['Unbounded', 700], ['Manrope', 500], ['Manrope', 600], ['Manrope', 700], ['Manrope', 800]]
    .map(([f, w]) => [f, w, fs.readFileSync(`${REPO}/${f.toLowerCase()}-${w}.woff2`).toString('base64')]);
  await p.evaluate(async fonts => {
    for (const [f, w, b64] of fonts) {
      const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const ff = new FontFace(f, buf, { weight: String(w) }); await ff.load(); document.fonts.add(ff);
    }
  }, fonts);
  const canvas = await p.$('canvas');
  if (mode === 'stills') {
    const ts = process.argv.slice(3).map(Number);
    for (const t of ts) { await p.evaluate(f => render(f), Math.round(t * 60)); await canvas.screenshot({ path: `still_${t}.png` }); }
  } else {
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', 'video_noaudio.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < 900; f++) {
      const data = await p.evaluate(f => { render(f); return document.getElementById('c').toDataURL('image/jpeg', 0.97).split(',')[1]; }, f);
      if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 100 === 0) console.log('frame', f);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await b.close();
})();
