import { chromium } from 'playwright';
import fs from 'node:fs';
import { PNG } from 'pngjs';

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.click('#btn-start-range');
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const p = window.__debug.player;
  p.position.set(0, 10.8, -22.5);
  p.yaw = 0;
  p.pitch = 0;
  p.updateCameraTransform();
  window.__debug.camera.updateMatrixWorld(true);
});
await page.waitForTimeout(600);
await page.screenshot({ timeout: 15000, path: '/tmp/opencode/signclose.png' });
const col = await page.evaluate(() => {
  const p = window.__debug.player;
  return { pos: [p.position.x, p.position.y, p.position.z] };
});
console.log('cam at', JSON.stringify(col.pos));
await browser.close();

const png = PNG.sync.read(fs.readFileSync('/tmp/opencode/signclose.png'));
const { width: w, height: h, data } = png;
for (let fy = 0.30; fy <= 0.72; fy += 0.02) {
  const y = Math.floor(h * fy);
  const i = (y * w + Math.floor(w * 0.5)) * 4;
  console.log(`y=${(fy * 100).toFixed(0)}%: (${data[i]},${data[i + 1]},${data[i + 2]})`);
}
