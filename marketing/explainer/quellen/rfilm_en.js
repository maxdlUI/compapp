const { chromium } = require('playwright');
const { spawn } = require('child_process');
const mode = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto('http://localhost:8766/film_en.html'); await p.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  if (mode === 'stills') {
    for (const t of process.argv.slice(3).map(Number)) {
      const t0 = Date.now(); await p.evaluate(f => render(f), Math.round(t * 60));
      await p.screenshot({ path: `still_en/${t}.jpg`, type: 'jpeg', quality: 90 }); console.log(t, Date.now() - t0, 'ms');
    }
  } else {
    const [from, to, out] = [+process.argv[3], +process.argv[4], process.argv[5]];
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = from; f < to; f++) {
      await p.evaluate(f => render(f), f);
      const buf = await p.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 120 === 0) console.log('frame', f);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('done', out);
  }
  await b.close();
})();
