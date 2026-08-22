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
  const m = cam.projectionMatrixInverse;
  const w = cam.matrixWorld;
  const mul = (m, v) => {
    const x = m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12]*v[3];
    const y = m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13]*v[3];
    const z = m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]*v[3];
    const t = m[3]*v[0]+m[7]*v[1]+m[11]*v[2]+m[15]*v[3];
    return [x/t, y/t, z/t, 1];
  };
  const rayDir = (nx, ny) => {
    const v = mul(m, [nx, ny, 0, 1]);
    const o = [w[12], w[13], w[14]];
    const d = [v[0]-o[0], v[1]-o[1], v[2]-o[2]];
    const len = Math.hypot(...d);
    return { o, d: d.map(x => x/len) };
  };
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
  const hitAt = (nx, ny) => {
    const { o, d } = rayDir(nx, ny);
    let best = null;
    for (const { obj, bb } of meshes) {
      obj.updateMatrixWorld(true);
      const mw = obj.matrixWorld.elements;
      const V3 = cam.position.constructor; const c = bb.getCenter ? bb.getCenter(new V3()) : null;
      if (!c) continue;
      const half = { x: (bb.max.x-bb.min.x)/2, y: (bb.max.y-bb.min.y)/2, z: (bb.max.z-bb.min.z)/2 };
      const center = [
        mw[12]+mw[0]*c.x+mw[4]*c.y+mw[8]*c.z,
        mw[13]+mw[1]*c.x+mw[5]*c.y+mw[9]*c.z,
        mw[14]+mw[2]*c.x+mw[6]*c.y+mw[10]*c.z,
      ];
      const abs = Math.abs;
      const a0 = [mw[0], mw[1], mw[2]], a1 = [mw[4], mw[5], mw[6]], a2 = [mw[8], mw[9], mw[10]];
      const ex = Math.hypot(a0[0], a0[1], a0[2]);
      const ey = Math.hypot(a1[0], a1[1], a1[2]);
      const ez = Math.hypot(a2[0], a2[1], a2[2]);
      const hx = half.x*ex, hy = half.y*ey, hz = half.z*ez;
      const p = [o[0]-center[0], o[1]-center[1], o[2]-center[2]];
      let tmin = -Infinity, tmax = Infinity;
      const axes = [[1,0,0,hx],[0,1,0,hy],[0,0,1,hz]];
      for (const [ax, ay, az, h] of axes) {
        const e = d[0]*ax+d[1]*ay+d[2]*az;
        const f = p[0]*ax+p[1]*ay+p[2]*az;
        if (abs(e) < 1e-9) { if (-f > h || f > h) { tmin = Infinity; break; } }
        else { let t1 = (f+h)/e, t2 = (f-h)/e; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) { tmin = Infinity; break; } }
      }
      if (tmin > 0 && tmin < (best ? best.d : Infinity)) {
        const mat = obj.material;
        const col = mat.color ? mat.color : null;
        best = { d: tmin, name: obj.name || obj.geometry.type, color: col ? `#${col.getHexString()}` : String(mat.type) };
      }
    }
    return best;
  };
  const out = {};
  for (const [label, nx, ny] of [['y26', 0, 0.26], ['y28', 0, 0.28], ['y30', 0, 0.30], ['y32', 0, 0.32], ['y34', 0, 0.34], ['y38', 0, 0.38], ['y42', 0, 0.42]]) {
    out[label] = hitAt(nx, 1 - ny * 2);
  }
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
