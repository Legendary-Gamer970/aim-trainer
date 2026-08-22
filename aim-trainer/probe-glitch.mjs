import { chromium } from 'playwright';
import fs from 'node:fs';
import { PNG } from 'pngjs';

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#btn-start-range');
await page.waitForTimeout(1500);

const shot = async (name, yaw, pitch) => {
  await page.evaluate(([y, p]) => {
    window.__debug.player.yaw = y;
    window.__debug.player.pitch = p;
    window.__debug.player.updateCameraTransform();
  }, [yaw, pitch]);
  await page.waitForTimeout(500);
  await page.screenshot({ timeout: 15000, path: `/tmp/opencode/probe-${name}.png` });
};

await shot('front', 0, 0);
await shot('frontdown', 0, -0.25);
await shot('frontup', 0, 0.6);
await shot('left', -1.9, 0);
await shot('right', 1.9, 0);
await shot('back', Math.PI, 0);
console.log('page errors:', errors.length ? errors.join('; ') : 'none');
await browser.close();

const viz = (name, label) => {
  const img = PNG.sync.read(fs.readFileSync(`/tmp/opencode/probe-${name}.png`));
  const { width: w, height: h, data } = img;
  console.log(`===== ${label} =====`);
  const cols = 96, rows = 40;
  const cx = w / cols, cy = h / rows;
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      let R = 0, G = 0, B = 0, n = 0;
      for (let y = Math.floor(r * cy); y < Math.floor((r + 1) * cy); y += 2) {
        for (let x = Math.floor(c * cx); x < Math.floor((c + 1) * cx); x += 2) {
          const i = (y * w + x) * 4;
          R += data[i]; G += data[i + 1]; B += data[i + 2]; n++;
        }
      }
      R /= n; G /= n; B /= n;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      let ch;
      if (mx - mn < 25) {
        const l = 0.3 * R + 0.59 * G + 0.11 * B;
        ch = l > 200 ? 'W' : l > 160 ? 'w' : l > 110 ? 'g' : l > 60 ? 'd' : 'k';
      } else if (B > R && B >= G) ch = B > 170 && B - R > 50 ? 'B' : 'b';
      else if (G > R && G >= B) ch = G > 140 ? 'G' : 'V';
      else if (R > G && R >= B) ch = R > 180 && R - B > 40 ? (R - G > 40 ? 'O' : 'r') : 'R';
      else ch = '?';
      line += ch;
    }
    console.log(line);
  }
  // blue-region report: bright blue pixels (b>170, b-r>50)
  let blue = 0;
  const rowsB = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      if (data[i + 2] > 170 && data[i + 2] - data[i] > 50) { blue++; rowsB[y]++; }
    }
  }
  const bands = [];
  let start = -1;
  rowsB.forEach((c, y) => {
    if (c > 0 && start < 0) start = y;
    if (c === 0 && start >= 0) { bands.push([start, y - 1, rowsB.slice(start, y).reduce((t, r) => t + r, 0)]); start = -1; }
  });
  if (start >= 0) bands.push([start, h - 1, rowsB.slice(start).reduce((t, r) => t + r, 0)]);
  console.log(`bright-blue pixels: ${blue}; bands [y0,y1,count]:`, JSON.stringify(bands.filter(([, , c]) => c > 20)));
};

viz('front', 'FRONT pitch=0');
viz('frontdown', 'FRONT pitch=-0.25');