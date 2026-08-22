import { chromium } from 'playwright';
import fs from 'node:fs';
import { PNG } from 'pngjs';

const launch = async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
  await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.click('#btn-start-range');
  await page.waitForTimeout(1000);
  return { browser, page };
};

const shot = async (page, yaw, pitch, name) => {
  await page.evaluate(([y, p]) => {
    window.__debug.player.yaw = y;
    window.__debug.player.pitch = p;
    window.__debug.player.updateCameraTransform();
  }, [yaw, pitch]);
  await page.waitForTimeout(500);
  await page.screenshot({ timeout: 15000, path: `/tmp/opencode/${name}.png` });
};

const { browser, page } = await launch();
try { await shot(page, 0, -0.02, 'v3-front'); } catch (e) { console.log('front failed', e.message); }
try { await shot(page, Math.PI, 0, 'v3-back'); } catch (e) { console.log('back failed', e.message); }
await browser.close();

const { browser: b2, page: p2 } = await launch();
try { await shot(p2, -0.9, 0, 'v3-left'); } catch (e) { console.log('left failed', e.message); }
try { await shot(p2, -0.065, -0.02, 'v3-boardL'); } catch (e) { console.log('boardL failed', e.message); }
await b2.close();

const { browser: b3, page: p3 } = await launch();
try { await shot(p3, 0.065, -0.02, 'v3-boardR'); } catch (e) { console.log('boardR failed', e.message); }
await b3.close();

const sample = (name, fx, fy) => {
  if (!fs.existsSync(`/tmp/opencode/${name}.png`)) return `${name}: MISSING`;
  const png = PNG.sync.read(fs.readFileSync(`/tmp/opencode/${name}.png`));
  const x = Math.floor(png.width * fx), y = Math.floor(png.height * fy);
  const i = (y * png.width + x) * 4;
  return `${name} ${(fx * 100).toFixed(0)}%x${(fy * 100).toFixed(0)}%: (${png.data[i]},${png.data[i + 1]},${png.data[i + 2]})`;
};

console.log('--- sign on berm top (center column, above berm silhouette) ---');
for (const fy of [0.25, 0.27, 0.29, 0.31, 0.33]) console.log(sample('v3-front', 0.5, fy));
console.log('--- boards ---');
console.log(sample('v3-front', 0.5, 0.40));
console.log(sample('v3-boardL', 0.5, 0.40));
console.log(sample('v3-boardR', 0.5, 0.40));
console.log('--- back view: horizon at 50% should be grass-free seam ---');
for (const fy of [0.49, 0.50, 0.51, 0.52, 0.53, 0.55]) console.log(sample('v3-back', 0.5, fy));
console.log('--- left view: office windows (y~44%, x 30/33%) ---');
for (const fx of [0.30, 0.33, 0.31]) console.log(sample('v3-left', fx, 0.445));
