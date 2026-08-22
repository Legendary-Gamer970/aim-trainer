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
try { await shot(page, 0, -0.02, 'v3-front'); } catch (e) { console.log('front failed'); }
try { await shot(page, -0.065, -0.02, 'v3-boardL'); } catch (e) { console.log('boardL failed'); }
try { await shot(page, -0.9, 0, 'v3-left'); } catch (e) { console.log('left failed'); }
try { await shot(page, Math.PI, -0.15, 'v3-backdown'); } catch (e) { console.log('backdown failed'); }
await browser.close();

const col = (name, fx, y0, y1, step) => {
  if (!fs.existsSync(`/tmp/opencode/${name}.png`)) return console.log(`${name}: MISSING`);
  const png = PNG.sync.read(fs.readFileSync(`/tmp/opencode/${name}.png`));
  const x = Math.floor(png.width * fx);
  let out = [];
  for (let fy = y0; fy <= y1 + 0.001; fy += step) {
    const y = Math.floor(png.height * fy);
    const i = (y * png.width + x) * 4;
    out.push(`y${(fy * 100).toFixed(0)}:(${png.data[i]},${png.data[i + 1]},${png.data[i + 2]})`);
  }
  console.log(`${name} x=${(fx * 100).toFixed(0)}%  ${out.join(' ')}`);
};
const row = (name, fy, x0, x1, step) => {
  if (!fs.existsSync(`/tmp/opencode/${name}.png`)) return console.log(`${name}: MISSING`);
  const png = PNG.sync.read(fs.readFileSync(`/tmp/opencode/${name}.png`));
  const y = Math.floor(png.height * fy);
  let out = [];
  for (let fx = x0; fx <= x1 + 0.001; fx += step) {
    const x = Math.floor(png.width * fx);
    const i = (y * png.width + x) * 4;
    out.push(`x${(fx * 100).toFixed(0)}:(${png.data[i]},${png.data[i + 1]},${png.data[i + 2]})`);
  }
  console.log(`${name} y=${(fy * 100).toFixed(0)}%  ${out.join(' ')}`);
};

console.log('SIGN band (center column):');
col('v3-front', 0.5, 0.20, 0.40, 0.02);
console.log('BOARD x=0 (center column, board at y 45.5..51.4%):');
col('v3-front', 0.5, 0.42, 0.56, 0.02);
console.log('BOARD x=-6 row (y=48%):');
row('v3-boardL', 0.48, 0.40, 0.72, 0.02);
console.log('OFFICE row (y=44.5%):');
row('v3-left', 0.445, 0.35, 0.70, 0.025);
console.log('BACK-down column (seam check, ground behind):');
col('v3-backdown', 0.5, 0.45, 0.75, 0.03);
