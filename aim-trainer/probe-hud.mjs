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
  window.__debug.dummyManager.hideRangeDummies();
});
await page.waitForTimeout(300);

const burst = async (label, hideHud) => {
  if (hideHud) await page.evaluate(() => { const l = document.getElementById('ui-layer'); if (l) l.style.display = 'none'; });
  await page.waitForTimeout(300);
  const N = 8;
  const frames = [];
  for (let i = 0; i < N; i++) {
    await page.screenshot({ timeout: 15000, path: `/tmp/opencode/z-${label}-${i}.png` });
    await page.waitForTimeout(150);
    frames.push(PNG.sync.read(fs.readFileSync(`/tmp/opencode/z-${label}-${i}.png`)));
  }
  const { width: w, height: h } = frames[0];
  let fl = 0;
  const cells = new Map();
  const samples = new Map();
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      let maxDev = 0, best = [0, 0, 0];
      for (let k = 1; k < N; k++) {
        const dev = Math.abs(frames[k].data[i] - frames[0].data[i]) + Math.abs(frames[k].data[i + 1] - frames[0].data[i + 1]) + Math.abs(frames[k].data[i + 2] - frames[0].data[i + 2]);
        if (dev > maxDev) { maxDev = dev; best = [frames[k].data[i], frames[k].data[i + 1], frames[k].data[i + 2]]; }
      }
      if (maxDev > 80) {
        fl++;
        const key = `${Math.floor(x / 100) * 100},${Math.floor(y / 50) * 50}`;
        cells.set(key, (cells.get(key) || 0) + 1);
        if (!samples.has(key)) samples.set(key, `${best[0]},${best[1]},${best[2]} vs ${frames[0].data[i]},${frames[0].data[i + 1]},${frames[0].data[i + 2]}`);
      }
    }
  }
  const top = [...cells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`${label}: flickerPx=${fl} topCells=${top}`);
  const sampleCells = [...cells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => `${k}: ${samples.get(k)}`).join(' | ');
  console.log(`  colors: ${sampleCells}`);
};

await burst('withHud', false);
await burst('noHud', true);
await browser.close();