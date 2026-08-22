import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#btn-start-range');
await page.waitForTimeout(1200);
const hits = await page.evaluate(() => {
  const dbg = window.__debug;
  const scene = dbg.camera.parent;
  dbg.player.yaw = 0; dbg.player.pitch = 0;
  dbg.player.updateCameraTransform();
  const cam = dbg.camera;
  const raycaster = new cam.parent.parent ? new (Object.getPrototypeOf(Object.getPrototypeOf(window.__debug.camera)).constructor)() : null;
  const results = [];
  const width = 1280, height = 720;
  for (const yf of [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55]) {
    const ndc = new Float32Array(2);
    ndc[0] = 0; ndc[1] = -(yf * 2 - 1);
    const r = new (Object.getPrototypeOf(Object.getPrototypeOf(cam)).constructor)();
    const v = new (cam.parent.isScene ? Object.getPrototypeOf(Object.getPrototypeOf(cam)) : Object)().constructor ?? null;
    // build ray via THREE: use the scene's available classes
    const ray = new (cam.parent.userData && cam.parent.userData.Raycaster ? cam.parent.userData.Raycaster : undefined)();
    return null;
  }
  return null;
});
console.log('(skipped complex path)');
await browser.close();
