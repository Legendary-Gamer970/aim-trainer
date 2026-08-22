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
});
await page.waitForTimeout(300);

// Identify geometry by position/params
const sceneInfo = await page.evaluate(() => {
  const scene = window.__debug.camera.parent;
  const out = [];
  const walk = (obj, depth) => {
    for (const c of obj.children) {
      const g = c.geometry;
      if (g && (g.type === 'PlaneGeometry' || (g.type === 'MeshBasicMaterial'))) {
        const p = g.parameters || {};
        out.push({ geo: `${g.type}(w=${p.width},h=${p.height})`, mat: c.material.color ? `#${c.material.color.getHexString()}` : '', pos: [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(3)) });
      }
      if (depth < 5) walk(c, depth + 1);
    }
  };
  walk(scene, 0);
  return out;
});
console.log('planes:', JSON.stringify(sceneInfo.filter(i => i.geo.startsWith('Plane')), null, 0));
console.log('basic mats:', JSON.stringify(sceneInfo.filter(i => !i.geo.startsWith('Plane')).slice(0, 30), null, 0));

const burst = async (label, pre, post) => {
  if (pre) await page.evaluate(pre);
  await page.waitForTimeout(300);
  const N = 8;
  const frames = [];
  for (let i = 0; i < N; i++) {
    await page.screenshot({ timeout: 15000, path: `/tmp/opencode/x-${label}-${i}.png` });
    await page.waitForTimeout(150);
    frames.push(PNG.sync.read(fs.readFileSync(`/tmp/opencode/x-${label}-${i}.png`)));
  }
  const { width: w, height: h } = frames[0];
  let fl = 0;
  const cells = new Map();
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      let maxDev = 0;
      for (let k = 1; k < N; k++) {
        maxDev = Math.max(maxDev,
          Math.abs(frames[k].data[i] - frames[0].data[i]) +
          Math.abs(frames[k].data[i + 1] - frames[0].data[i + 1]) +
          Math.abs(frames[k].data[i + 2] - frames[0].data[i + 2]));
      }
      if (maxDev > 80) {
        fl++;
        const key = `${Math.floor(x / 100) * 100},${Math.floor(y / 50) * 50}`;
        cells.set(key, (cells.get(key) || 0) + 1);
      }
    }
  }
  const top = [...cells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`${label}: flickerPx=${fl} topCells=${top}`);
  if (post) await page.evaluate(post);
};

// baseline
await burst('base', null, null);

// 1. Raise ALL painted strips/lines high above pad
await burst('raise-strips', () => {
  const scene = window.__debug.camera.parent;
  const walk = (obj) => {
    for (const c of obj.children) {
      const g = c.geometry;
      if (g && g.type === 'PlaneGeometry' && c.material.color) {
        const hex = c.material.color.getHexString();
        const isLine = ['ffffff', 'f59e0b', '3d7fd1', 'd94a3d'].includes(hex) && Math.abs(c.position.y - 0.0) < 0.05;
        if (isLine) c.position.y += 0.1;
      }
      walk(c);
    }
  };
  walk(scene);
}, null);

// 2. Hide boards + sign (planes with canvas textures)
await burst('hide-boards', () => {
  const scene = window.__debug.camera.parent;
  const walk = (obj) => {
    for (const c of obj.children) {
      if (c.geometry && c.geometry.type === 'PlaneGeometry' && c.material.map) c.visible = false;
      walk(c);
    }
  };
  walk(scene);
}, null);

// 3. Hide dummies
await burst('hide-dummies', () => {
  window.__debug.dummyManager.hideRangeDummies();
}, null);

// 4. Hide firing line + chevrons + shelf (bottom band test): raise platform-top-adjacent decals
await burst('raise-bottom', () => {
  const scene = window.__debug.camera.parent;
  const walk = (obj) => {
    for (const c of obj.children) {
      const g = c.geometry;
      if (g && (c.position.y < 0.5) && (c.position.z > -3) && c.position.z < 2.5) {
        if (g.type === 'BoxGeometry' || g.type === 'PlaneGeometry') {
          const hex = c.material.color ? c.material.color.getHexString() : '';
          if (hex === 'f59e0b' || hex === 'd94a3d' || hex === 'ffffff') c.position.y += 0.3;
        }
      }
      walk(c);
    }
  };
  walk(scene);
}, null);

await browser.close();