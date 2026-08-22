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
  window.__debug.dummyManager.hideRangeDummies();
});
await page.waitForTimeout(300);

const burst = async (label, pre) => {
  if (pre) await page.evaluate(pre);
  await page.waitForTimeout(300);
  const N = 8;
  const frames = [];
  for (let i = 0; i < N; i++) {
    await page.screenshot({ timeout: 15000, path: `/tmp/opencode/y-${label}-${i}.png` });
    await page.waitForTimeout(150);
    frames.push(PNG.sync.read(fs.readFileSync(`/tmp/opencode/y-${label}-${i}.png`)));
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
};

await burst('base', null);
await burst('no-shelf', () => {
  // hide the white shelf + blue cap at z=-1.74
  const scene = window.__debug.camera.parent;
  const walk = (obj) => {
    for (const c of obj.children) {
      if (c.geometry && Math.abs(c.position.z + 1.74) < 0.15 && Math.abs(c.position.x) < 4.2 && c.position.y < 1.0) c.visible = false;
      walk(c);
    }
  };
  walk(scene);
}, null);
await burst('no-firingline', () => {
  const scene = window.__debug.camera.parent;
  const walk = (obj) => {
    for (const c of obj.children) {
      if (c.geometry && c.geometry.type === 'PlaneGeometry' && Math.abs(c.position.z + 1.3) < 0.1) c.visible = false;
      walk(c);
    }
  };
  walk(scene);
}, null);
await burst('no-platform', () => {
  const scene = window.__debug.camera.parent;
  const walk = (obj) => {
    for (const c of obj.children) {
      if (c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y < 0.2 && c.position.z < 2 && c.position.z > -2 && Math.abs(c.position.x) < 4) c.visible = false;
      walk(c);
    }
  };
  walk(scene);
}, null);
await burst('no-pad', () => {
  const scene = window.__debug.camera.parent;
  const walk = (obj) => {
    for (const c of obj.children) {
      if (c.geometry && c.geometry.type === 'PlaneGeometry' && c.material.color && c.material.color.getHexString() === 'd9dee5') c.visible = false;
      walk(c);
    }
  };
  walk(scene);
}, null);
await burst('no-rail', () => {
  const scene = window.__debug.camera.parent;
  const walk = (obj) => {
    for (const c of obj.children) {
      if (c.geometry && c.material.color && c.material.color.getHexString() === '2f6fbf') c.visible = false;
      walk(c);
    }
  };
  walk(scene);
}, null);
await browser.close();