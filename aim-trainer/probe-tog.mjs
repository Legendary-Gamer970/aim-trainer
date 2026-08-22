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
  window.__debug.player.pitch = -0.25;
  window.__debug.player.updateCameraTransform();
});
await page.waitForTimeout(500);

// Identify scene children & which is the sky, pad, ground
const info = await page.evaluate(() => {
  const scene = window.__debug.camera.parent;
  const out = [];
  const walk = (obj, depth, path) => {
    for (const c of obj.children) {
      const g = c.geometry;
      let desc = c.type;
      if (g) {
        const p = g.parameters || {};
        desc = `${g.type}(w=${p.width},h=${p.height},r=${p.radius})`;
      }
      const mat = c.material;
      const mdesc = mat ? (mat.color ? `#${mat.color.getHexString()}` : mat.type) : '-';
      out.push({ path: `${path}/${c.name || desc}`, type: c.type, geo: desc, mat: mdesc, renderOrder: c.renderOrder ?? 0, pos: [c.position.x, c.position.y, c.position.z].map(v=>+v.toFixed(1)) });
      if (depth < 3) walk(c, depth + 1, `${path}/${c.name || desc}`);
    }
  };
  walk(scene, 0, 'scene');
  return out;
});
const skyIdx = info.findIndex((i) => i.geo.startsWith('SphereGeometry'));
const padIdx = info.findIndex((i) => i.geo.includes('18') && i.geo.includes('33'));
const groundIdx = info.findIndex((i) => i.geo.includes('400') && i.geo.includes('400'));
console.log('sky:', skyIdx >= 0 ? JSON.stringify(info[skyIdx]) : 'NOT FOUND');
console.log('pad:', padIdx >= 0 ? JSON.stringify(info[padIdx]) : 'NOT FOUND');
console.log('ground:', groundIdx >= 0 ? JSON.stringify(info[groundIdx]) : 'NOT FOUND');

const sample = async (label) => {
  await page.screenshot({ timeout: 15000, path: `/tmp/opencode/tog-${label}.png` });
  const img = PNG.sync.read(fs.readFileSync(`/tmp/opencode/tog-${label}.png`));
  const { width: w, height: h, data } = img;
  const px = (x, y) => { const i = (y * w + x) * 4; return `(${data[i]},${data[i+1]},${data[i+2]})`; };
  const row = [];
  for (const xf of [0.1, 0.3, 0.5, 0.7, 0.9]) row.push(`${(xf*100).toFixed(0)}%:${px(Math.floor(w*xf), Math.floor(h*0.63))}`);
  console.log(`${label} y=63%:`, row.join(' '));
};
await sample('baseline');

// Toggle sky visibility off
const skyHidden = await page.evaluate((idx) => {
  const scene = window.__debug.camera.parent;
  let count = 0;
  const walk = (obj) => { for (const c of obj.children) { if (c.geometry && c.geometry.type === 'SphereGeometry') { c.visible = false; count++; } walk(c); } };
  walk(scene);
  return count;
}, skyIdx);
console.log('sky spheres hidden:', skyHidden);
await sample('nosky');
await browser.close();