// Erzeugt eine frei erfundene Insel-Karte (keine Spiel-Assets) als PNG
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1600 } });
  await p.setContent('<canvas id=c width=1600 height=1600></canvas>');
  await p.evaluate(() => {
    const c = document.getElementById('c'), g = c.getContext('2d');
    let s = 11; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    g.fillStyle = '#1d4f7a'; g.fillRect(0, 0, 1600, 1600);
    // water texture
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${r() * .04})`; g.fillRect(r() * 1600, r() * 1600, 2 + r() * 30, 1); }
    const harm = Array.from({ length: 6 }, (_, i) => ({ a: (.05 + r() * .06) / (i * .5 + 1), p: r() * 6.28, f: i + 2 }));
    const shape = (sc, ox = 800, oy = 800) => { g.beginPath(); for (let i = 0; i <= 200; i++) { const a = i / 200 * 6.283; let rad = 1; harm.forEach(h => rad += h.a * Math.sin(a * h.f + h.p)); const x = ox + Math.cos(a) * rad * 600 * sc, y = oy + Math.sin(a) * rad * 560 * sc; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
    shape(1.04); g.fillStyle = '#d9c78f'; g.fill();
    shape(1); const gr = g.createRadialGradient(760, 760, 50, 800, 800, 700); gr.addColorStop(0, '#5f9a4a'); gr.addColorStop(.6, '#4a8a3f'); gr.addColorStop(1, '#3d7a3a'); g.fillStyle = gr; g.fill();
    // biomes
    g.save(); shape(1); g.clip();
    const blob = (x, y, rr, col) => { g.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.283, q = rr * (1 + .18 * Math.sin(a * 3 + x)); i ? g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : g.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.fillStyle = col; g.fill(); };
    blob(1150, 520, 260, '#e9eef2'); blob(1160, 1150, 240, '#c9a86a'); blob(450, 1100, 220, '#2f6b35'); blob(520, 450, 180, '#6b8f4c');
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,40,0,${r() * .25})`; g.beginPath(); g.arc(r() * 1600, r() * 1600, 2 + r() * 7, 0, 6.28); g.fill(); }
    // river
    g.strokeStyle = '#3c7fb0'; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); g.moveTo(300, 700); g.bezierCurveTo(600, 760, 700, 900, 980, 860); g.bezierCurveTo(1200, 830, 1300, 950, 1500, 980); g.stroke();
    g.restore();
    // roads
    g.strokeStyle = 'rgba(240,235,220,.75)'; g.lineWidth = 6; g.setLineDash([]);
    [[[420, 520], [800, 640], [1150, 560]], [[800, 640], [760, 1000], [1120, 1150]], [[760, 1000], [460, 1080]]].forEach(pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); });
    // towns + names (frei erfunden)
    const towns = [[420, 520, 'Nebelhain'], [800, 640, 'Kreuzweg'], [1150, 560, 'Frostgrat'], [760, 1000, 'Altmühle'], [1120, 1150, 'Sandbrück'], [460, 1080, 'Moorlicht']];
    g.font = '700 34px sans-serif'; g.textAlign = 'center';
    towns.forEach(([x, y, n]) => { g.fillStyle = '#8a8f99'; for (let k = 0; k < 7; k++) g.fillRect(x - 40 + r() * 70, y - 30 + r() * 50, 12, 12); g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(n.toUpperCase(), x, y + 60); g.fillStyle = '#fff'; g.fillText(n.toUpperCase(), x, y + 60); });
    // grid
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(i * 160, 0); g.lineTo(i * 160, 1600); g.stroke(); g.beginPath(); g.moveTo(0, i * 160); g.lineTo(1600, i * 160); g.stroke(); }
  });
  await (await p.$('canvas')).screenshot({ path: 'fantasy-map.png' }); await b.close();
})();
