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

const cam = async (yaw, pitch, name) => {
  await page.evaluate(([y, p]) => {
    window.__debug.player.yaw = y;
    window.__debug.player.pitch = p;
    window.__debug.player.updateCameraTransform();
  }, [yaw, pitch]);
  await page.waitForTimeout(600);
  await page.screenshot({ timeout: 15000, path: `/tmp/opencode/${name}.png` });
};

await cam(0, -0.02, 'v3-front');
await cam(0, 0, 'v3-front0');
await cam(Math.PI, 0, 'v3-back');
await cam(Math.PI, -0.06, 'v3-backdown');
await cam(-0.9, 0, 'v3-left');
await browser.close();

const sample = (name, fx, fy) => {
  const png = PNG.sync.read(fs.readFileSync(`/tmp/opencode/${name}.png`));
  const x = Math.floor(png.width * fx), y = Math.floor(png.height * fy);
  const i = (y * png.width + x) * 4;
  return `${name} ${(fx * 100).toFixed(0)}%x${(fy * 100).toFixed(0)}%: (${png.data[i]},${png.data[i + 1]},${png.data[i + 2]})`;
};

// Sign on berm top: center column, above the berm silhouette (y ~26-34%)
for (const fy of [0.26, 0.28, 0.30, 0.32, 0.34]) console.log(sample('v3-front', 0.5, fy));
// Boards at x=0 (center), x=±6 (yaw +-0.06 rad)
console.log(sample('v3-front', 0.5, 0.40));
await cam(-0.065, -0.02, 'v3-right6');
console.log(sample('v3-right6', 0.5, 0.40));
await cam(0.065, -0.02, 'v3-left6');
console.log(sample('v3-left6', 0.5, 0.40));
