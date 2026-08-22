import { chromium } from 'playwright';
import fs from 'node:fs';
import { PNG } from 'pngjs';

const W = 1280;
const H = 720;
const OUT = '/tmp/opencode';
const pass = (m) => console.log('PASS:', m);
const fail = (m) => { console.log('FAIL:', m); process.exitCode = 1; };
const bright = (c) => (c[0] + c[1] + c[2]) / 3;
const isDark = (c) => bright(c) < 60;
const isCoral = (c) => c[0] > 120 && c[1] < 80 && c[2] < 90;
const isCyan = (c) => c[0] < 100 && c[1] > 200 && c[2] > 200;

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#btn-start-range');
await page.waitForTimeout(1500);

// Pin the center dummy straight ahead; park the other dummies far away; aim at the chest
await page.evaluate(() => {
  const player = window.__debug.player;
  const dummies = window.__debug.dummyManager.getRangeDummies();
  const dummy = dummies[1];
  for (const d of dummies) d.disablePatrol();
  for (const d of dummies) {
    if (d !== dummy) d.group.position.set(50, 0, 50);
  }
  dummy.group.position.set(0, 0, -10);
  dummy.group.updateMatrixWorld(true);
  const cam = window.__debug.camera;
  const t = dummy.getBodyWorldPosition();
  const dx = t.x - cam.position.x;
  const dy = t.y - cam.position.y;
  const dz = t.z - cam.position.z;
  player.yaw = Math.atan2(-dx, -dz);
  player.pitch = Math.atan2(dy, -dz);
  player.updateCameraTransform();
});
await page.waitForTimeout(600);

// Project the dummy's visor/plate/feet into screen space using the live camera state
const proj = () => page.evaluate(() => {
  const cam = window.__debug.camera;
  const player = window.__debug.player;
  const yaw = player.yaw;
  const pitch = player.pitch;
  const cp = cam.position;
  const fwd = { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
  const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  const up = {
    x: right.y * fwd.z - right.z * fwd.y,
    y: right.z * fwd.x - right.x * fwd.z,
    z: right.x * fwd.y - right.y * fwd.x,
  };
  const tanV = Math.tan((cam.fov * Math.PI) / 180 / 2);
  const tanH = tanV * cam.aspect;
  const pts = { visor: 1.57, plate: 1.07, feet: 0.05 };
  const hits = {};
  for (const [name, wy] of Object.entries(pts)) {
    const d = { x: 0 - cp.x, y: wy - cp.y, z: -10 - cp.z };
    const fd = d.x * fwd.x + d.y * fwd.y + d.z * fwd.z;
    const rd = d.x * right.x + d.y * right.y + d.z * right.z;
    const ud = d.x * up.x + d.y * up.y + d.z * up.z;
    hits[name] = { x: Math.round((1 + rd / fd / tanH) * 640), y: Math.round((1 - ud / fd / tanV) * 360) };
  }
  return { fov: cam.fov, zoom: window.__debug.engine.getZoomAmount(), hits };
});

const shot = async (name) => {
  await page.waitForTimeout(250);
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ timeout: 15000, path: p });
  return PNG.sync.read(fs.readFileSync(p));
};

const px = (img, x, y) => {
  const i = (Math.round(y) * img.width + Math.round(x)) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

const windowHas = (img, cx, cy, r, pred) => {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (pred(px(img, x, y))) return true;
    }
  }
  return false;
};

// Vertical dark-slate span at a column (the dummy's head-to-feet silhouette)
const darkSpan = (img, x, y0, y1) => {
  let minY = 1e9, maxY = -1e9, count = 0;
  for (let y = y0; y <= y1; y++) {
    if (isDark(px(img, x, y))) {
      count++;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minY, maxY, count };
};

const diag = () => page.evaluate(() => ({
  ads: window.__debug.weapon.getADSAmount(),
  scopeScale: window.__debug.weapon.scopeAssembly.scale.x,
  overlay: document.getElementById('scope-overlay').classList.contains('active'),
  adsHeld: window.__debug.getFireGate().adsHeld,
}));

// 1. Normal (hip) view
const normal = await shot('settle-1-normal');
let p = await proj();
const nSpan = darkSpan(normal, p.hits.feet.x - 3, 280, 520);
console.log(`NORMAL: fov=${p.fov} zoom=${p.zoom} hits=${JSON.stringify(p.hits)}`);
console.log(`  plate=${px(normal, p.hits.plate.x - 8, p.hits.plate.y)} visorCoral=${windowHas(normal, p.hits.visor.x, p.hits.visor.y, 6, isCoral)} darkSpan=${JSON.stringify(nSpan)}`);

// 2. Scoped (fully settled: 6s hold)
await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 2 })));
await page.waitForTimeout(6000);
const scoped = await shot('settle-2-scoped');
p = await proj();
const sSpan = darkSpan(scoped, p.hits.feet.x - 3, 280, 520);
const sDiag = await diag();
console.log(`SCOPED: fov=${p.fov} zoom=${p.zoom} hits=${JSON.stringify(p.hits)} state=${JSON.stringify(sDiag)}`);
console.log(`  plateL=${px(scoped, p.hits.plate.x - 10, p.hits.plate.y)} plateR=${px(scoped, p.hits.plate.x + 10, p.hits.plate.y)}`);
console.log(`  visorCoral=${windowHas(scoped, p.hits.visor.x, p.hits.visor.y, 8, isCoral)} dot=${px(scoped, 640, 360)} ringL=${px(scoped, 471, 360)} ringR=${px(scoped, 809, 360)} vign=${px(scoped, 880, 360)} stripe=${px(scoped, 640, 540)}`);
console.log(`  darkSpan=${JSON.stringify(sSpan)}`);

// 3. Turn the camera while scoped: the magnified world must follow
await page.evaluate(() => {
  const player = window.__debug.player;
  player.yaw += 0.15;
  player.updateCameraTransform();
});
await page.waitForTimeout(1500);
const turned = await shot('settle-3-turned');
p = await proj();
const tSpan = darkSpan(turned, p.hits.feet.x - 3, 280, 520);
const oldSpan = darkSpan(turned, 637, 280, 520);
console.log(`TURNED: fov=${p.fov} hits=${JSON.stringify(p.hits)}`);
console.log(`  darkSpan@new=${JSON.stringify(tSpan)} darkSpan@old=${JSON.stringify(oldSpan)} plateBright@new=${windowHas(turned, p.hits.plate.x, p.hits.plate.y, 12, (c) => bright(c) > 160)}`);

// 4. Release -> normal view returns
await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 2 })));
await page.waitForTimeout(1000);
const released = await shot('settle-4-released');
p = await proj();
const rDiag = await diag();
const rSpan = darkSpan(released, p.hits.feet.x - 3, 280, 520);
console.log(`RELEASED: fov=${p.fov} zoom=${p.zoom} state=${JSON.stringify(rDiag)} darkSpan=${JSON.stringify(rSpan)}`);

// --- Assertions ---
const nH = nSpan.maxY - nSpan.minY;
const sH = sSpan.maxY - sSpan.minY;
const tH = tSpan.maxY - tSpan.minY;
const rH = rSpan.maxY - rSpan.minY;

if (sDiag.ads > 0.99 && sDiag.scopeScale < 0.05 && sDiag.overlay && sDiag.adsHeld) {
  pass(`scoped state settled (ads=${sDiag.ads.toFixed(3)}, scopeScale=${sDiag.scopeScale.toExponential(1)}, overlay active)`);
} else {
  fail(`scoped state wrong: ${JSON.stringify(sDiag)}`);
}
if (sH >= nH * 1.9) {
  pass(`dummy ~2x taller while scoped (${nH}px -> ${sH}px)`);
} else {
  fail(`dummy not ~2x: ${nH}px -> ${sH}px`);
}
if (bright(px(scoped, p.hits.plate.x - 10, p.hits.plate.y)) > 160 && bright(px(scoped, p.hits.plate.x + 10, p.hits.plate.y)) > 160) {
  pass(`dummy chest plate visible at projected position (${px(scoped, p.hits.plate.x - 10, p.hits.plate.y)})`);
} else {
  fail(`chest plate not visible at projected position`);
}
if (windowHas(scoped, p.hits.visor.x, p.hits.visor.y, 8, isCoral)) {
  pass('coral visor visible while scoped');
} else {
  fail('coral visor missing while scoped');
}
if (isCyan(px(scoped, 640, 360))) {
  pass(`reticle dot visible (${px(scoped, 640, 360)})`);
} else {
  fail(`reticle dot missing (${px(scoped, 640, 360)})`);
}
if (bright(px(scoped, 471, 360)) < 60 && bright(px(scoped, 809, 360)) < 60) {
  pass('ring border visible');
} else {
  fail('ring border missing');
}
if (bright(px(scoped, 880, 360)) < 130) {
  pass(`periphery darkened (vignette=${px(scoped, 880, 360)})`);
} else {
  fail(`periphery not darkened (${px(scoped, 880, 360)})`);
}
if (isCoral(px(scoped, 640, 540))) {
  pass(`weapon visible at bottom while scoped (${px(scoped, 640, 540)})`);
} else {
  fail(`weapon stripe missing at bottom (${px(scoped, 640, 540)})`);
}
if (tH >= nH * 1.9 && windowHas(turned, p.hits.plate.x, p.hits.plate.y, 12, (c) => bright(c) > 160) && oldSpan.count < 5) {
  pass(`scoped view follows camera turn (dummy at ${p.hits.plate.x}, ${p.hits.plate.y})`);
} else {
  fail(`scoped view broken after turn (tH=${tH}, oldCount=${oldSpan.count})`);
}
if (rDiag.scopeScale > 0.95 && rH <= nH + 15 && rH >= nH - 15) {
  pass(`normal view restored after release (${rH}px vs ${nH}px)`);
} else {
  fail(`normal view not restored (scopeScale=${rDiag.scopeScale}, span=${rH}px vs ${nH}px)`);
}

console.log(process.exitCode ? 'RESULT: FAIL' : 'RESULT: PASS');
await browser.close();