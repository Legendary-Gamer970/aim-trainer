import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#btn-start-range');
await page.waitForTimeout(1200);
const shot = async (name, yaw, pitch) => {
  await page.evaluate(([y, p]) => {
    window.__debug.player.yaw = y;
    window.__debug.player.pitch = p;
    window.__debug.player.updateCameraTransform();
  }, [yaw, pitch]);
  await page.waitForTimeout(400);
  await page.screenshot({ timeout: 15000, path: `/tmp/opencode/v2-${name}.png` });
};
await shot('front', 0, 0);
await shot('back', Math.PI, 0);
await shot('left', -1.9, 0);
await shot('right', 1.9, 0);
await shot('backdown', Math.PI, -0.5);
await shot('far', 0, -0.05);
console.log('page errors:', errors.length ? errors.join('; ') : 'none');
await browser.close();
