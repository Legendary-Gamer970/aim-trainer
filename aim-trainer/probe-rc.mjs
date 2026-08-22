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

const result = await page.evaluate(async () => {
  const cam = window.__debug.camera;
  const scene = cam.parent;
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  const m = cam.projectionMatrixInverse.clone().elements;
  const w = cam.matrixWorld.elements;
  const mul = (mm, v) => {
    const x = mm[0]*v[0]+mm[4]*v[1]+mm[8]*v[2]+mm[12]*v[3];
    const y = mm[1]*v[0]+mm[5]*v[1]+mm[9]*v[2]+mm[13]*v[3];
    const z = mm[2]*v[0]+mm[6]*v[1]+mm[10]*v[2]+mm[14]*v[3];
    const t = mm[3]*v[0]+mm[7]*v[1]+mm[11]*v[2]+mm[15]*v[3];
    return [x/t, y/t, z/t, 1];
  };
  const o = [w[12], w[13], w[14]];
  const meshes = [];
  const walk = (obj) => {
    for (const c of obj.children) {
      if (c.geometry && c.visible) {
        const g = c.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        meshes.push({ obj: c, bb: g.boundingBox });
      }
      walk(c);
    }
  };
  walk(scene);
  const hitAt = (fx, fy) => {
    const ndc = [fx * 2 - 1, -(fy * 2 - 1)];
    const v = mul(w, mul(m, [ndc[0], ndc[1], 0, 1]));
    const d = [v[0]-o[0], v[1]-o[1], v[2]-o[2]];
    const len = Math.hypot(...d);
    const rd = d.map(x => x/len);
    let best = null;
    for (const { obj, bb } of meshes) {
      obj.updateMatrixWorld(true);
      const mw = obj.matrixWorld.elements;
      const V3 = cam.position.constructor;
      const c = bb.getCenter(new V3());
      const center = [mw[12]+mw[0]*c.x+mw[4]*c.y+mw[8]*c.z, mw[13]+mw[1]*c.x+mw[5]*c.y+mw[9]*c.z, mw[14]+mw[2]*c.x+mw[6]*c.y+mw[10]*c.z];
      const half = { x: (bb.max.x-bb.min.x)/2, y: (bb.max.y-bb.min.y)/2, z: (bb.max.z-bb.min.z)/2 };
      const hx = half.x*Math.hypot(mw[0], mw[1], mw[2]);
      const hy = half.y*Math.hypot(mw[4], mw[5], mw[6]);
      const hz = half.z*Math.hypot(mw[8], mw[9], mw[10]);
      const p = [center[0]-o[0], center[1]-o[1], center[2]-o[2]];
      let tmin = -Infinity, tmax = Infinity, miss = false;
      const axes = [[1,0,0,hx],[0,1,0,hy],[0,0,1,hz]];
      for (const [ax, ay, az, h] of axes) {
        const e = rd[0]*ax+rd[1]*ay+rd[2]*az;
        const f = p[0]*ax+p[1]*ay+p[2]*az;
        if (Math.abs(e) < 1e-9) { if (-f > h || f > h) { miss = true; break; } }
        else { let t1 = (f-h)/e, t2 = (f+h)/e; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) { miss = true; break; } }
      }
      if (!miss && tmin > 0 && tmin < (best ? best.d : Infinity)) {
        const mat = obj.material;
        best = { d: +tmin.toFixed(2), hit: [o[0]+rd[0]*tmin, o[1]+rd[1]*tmin, o[2]+rd[2]*tmin].map(v=>+v.toFixed(2)),
          name: obj.name || obj.geometry.type, color: mat.color ? `#${mat.color.getHexString()}` : mat.type };
      }
    }
    return best;
  };
  const out = {};
  for (const fy of [0.55, 0.70, 0.80, 0.90, 0.97]) {
    for (const fx of [0.1, 0.35, 0.5, 0.65, 0.9]) {
      out[`x${Math.round(fx*100)}y${Math.round(fy*100)}`] = hitAt(fx, fy);
    }
  }
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();