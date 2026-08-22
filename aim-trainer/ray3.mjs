import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.click('#btn-start-range');
await page.waitForTimeout(1000);

const result = await page.evaluate(async () => {
  const cam = window.__debug.camera;
  cam.updateMatrixWorld(true);
  const m = cam.projectionMatrixInverse.elements;
  const w = cam.matrixWorld.elements;
  const mul = (m, v) => {
    const x = m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12]*v[3];
    const y = m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13]*v[3];
    const z = m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]*v[3];
    const t = m[3]*v[0]+m[7]*v[1]+m[11]*v[2]+m[15]*v[3];
    return [x/t, y/t, z/t, 1];
  };
  const o = [w[12], w[13], w[14]];
  const dirs = {};
  for (const fy of [0.42, 0.60]) {
    const ny = 1 - fy * 2;
    const v = mul(w, mul(m, [0, ny, 0, 1]));
    const d = [v[0]-o[0], v[1]-o[1], v[2]-o[2]];
    const len = Math.hypot(...d);
    dirs[fy] = { ndcY: ny, world: v.map(x=>+x.toFixed(2)), d: d.map(x=>+(x/len).toFixed(3)) };
  }
  const scene = cam.parent;
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
  const hitAt = (ny) => {
    const v = mul(w, mul(m, [0, ny, 0, 1]));
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
      const a0 = [mw[0], mw[1], mw[2]], a1 = [mw[4], mw[5], mw[6]], a2 = [mw[8], mw[9], mw[10]];
      const hx = half.x*Math.hypot(...a0), hy = half.y*Math.hypot(...a1), hz = half.z*Math.hypot(...a2);
      const p = [center[0]-o[0], center[1]-o[1], center[2]-o[2]];
      let tmin = -Infinity, tmax = Infinity, miss = false;
      const axes = [[1,0,0,hx],[0,1,0,hy],[0,0,1,hz]];
      for (const [ax, ay, az, h] of axes) {
        const e = rd[0]*ax+rd[1]*ay+rd[2]*az;
        const f = p[0]*ax+p[1]*ay+p[2]*az;
        if (Math.abs(e) < 1e-9) { if (-f > h || f > h) { miss = true; break; } }
        else { let t1 = (f+h)/e, t2 = (f-h)/e; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) { miss = true; break; } }
      }
      if (!miss && tmin > 0 && tmin < (best ? best.d : Infinity)) {
        const mat = obj.material;
        best = { d: +tmin.toFixed(2), name: obj.name || obj.geometry.type, color: mat.color ? `#${mat.color.getHexString()}` : mat.type };
      }
    }
    return best;
  };
  return { dirs, hit42: hitAt(1 - 0.42*2), hit60: hitAt(1 - 0.60*2) };
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
