import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#btn-start-range');
await page.waitForTimeout(1500);
const shot = (name, yaw = null, pitch = null) => page.evaluate(([y, p]) => {
  if (y !== null) window.__debug.player.yaw = y;
  if (p !== null) window.__debug.player.pitch = p;
  window.__debug.player.updateCameraTransform();
}, [yaw, pitch]).then(() => page.waitForTimeout(400)).then(() =>
  page.screenshot({ timeout: 15000, path: `/tmp/opencode/env-${name}.png` }));
await shot('front');
await shot('sky', null, 0.85);
await shot('left', -1.9);
await shot('right', 1.9);
await shot('back', Math.PI);
await shot('ground', null, -0.55);
await shot('far', null, -0.08);
console.log('page errors:', errors.length ? errors.join('; ') : 'none');
await browser.close();
