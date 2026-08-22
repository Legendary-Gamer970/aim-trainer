import { chromium } from 'playwright';
import fs from 'node:fs';
import { PNG } from 'pngjs';

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#btn-start-range');
await page.waitForTimeout(1200);
await page.evaluate(() => {
  window.__debug.player.yaw = 0;
  window.__debug.player.pitch = 0;
  window.__debug.player.updateCameraTransform();
});
await page.waitForTimeout(400);

// Burst of screenshots over ~3 seconds
const N = 12;
for (let i = 0; i < N; i++) {
  await page.screenshot({ timeout: 15000, path: `/tmp/opencode/burst-${String(i).padStart(2, '0')}.png` });
  await page.waitForTimeout(200);
}
await browser.close();

const frames = [];
for (let i = 0; i < N; i++) {
  frames.push(PNG.sync.read(fs.readFileSync(`/tmp/opencode/burst-${String(i).padStart(2, '0')}.png`)));
}
const { width: w, height: h } = frames[0];
// Per-pixel: how many frames differ from the median color -> flicker map
const fl = new Array(h).fill(0);
const cells = new Map();
for (let y = 0; y < h; y += 1) {
  for (let x = 0; x < w; x += 2) {
    const i = (y * w + x) * 4;
    let medR = [], medG = [], medB = [];
    for (const f of frames) {
      medR.push(f.data[i]); medG.push(f.data[i + 1]); medB.push(f.data[i + 2]);
    }
    medR.sort((a, b) => a - b); medG.sort((a, b) => a - b); medB.sort((a, b) => a - b);
    const mR = medR[N >> 1], mG = medG[N >> 1], mB = medB[N >> 1];
    let maxDev = 0;
    for (let k = 0; k < N; k++) {
      maxDev = Math.max(maxDev, Math.abs(medR[k] - mR) + Math.abs(medG[k] - mG) + Math.abs(medB[k] - mB));
    }
    if (maxDev > 80) {
      fl[y]++;
      const key = `${Math.floor(x / 80) * 80},${Math.floor(y / 45) * 45}`;
      cells.set(key, (cells.get(key) || 0) + 1);
    }
  }
}
const bands = [];
let start = -1;
fl.forEach((c, y) => {
  if (c > 0 && start < 0) start = y;
  if (c === 0 && start >= 0) { bands.push([start, y - 1, fl.slice(start, y).reduce((t, r) => t + r, 0)]); start = -1; }
});
if (start >= 0) bands.push([start, h - 1, fl.slice(start).reduce((t, r) => t + r, 0)]);
console.log('flicker bands [y0,y1,pixelCount]:', JSON.stringify(bands.filter(([, , c]) => c > 10)));
console.log('flicker cells (x,y:count) top 15:', [...cells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}:${v}`).join(' '));

// Also: exact colors in the bottom band per frame (what does the flicker look like)
const px = (f, xf, yf) => {
  const x = Math.floor(w * xf), y = Math.floor(h * yf);
  const i = (y * w + x) * 4;
  return `(${f.data[i]},${f.data[i+1]},${f.data[i+2]})`;
};
for (let k = 0; k < N; k++) {
  console.log(`frame ${k}: bottom(50%,97%)=${px(frames[k], 0.5, 0.97)} midlow(50%,85%)=${px(frames[k], 0.5, 0.85)} far(50%,55%)=${px(frames[k], 0.5, 0.55)}`);
}