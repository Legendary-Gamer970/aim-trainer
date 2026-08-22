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
  const ny = 1 - 0.42 * 2;
  const v = mul(m, [0, ny, 0, 1]);
  const o = [w[12], w[13], w[14]];
  const d = [v[0]-o[0], v[1]-o[1], v[2]-o[2]];
  const len = Math.hypot(...d);
  const info = { o, d: d.map(x => x/len), camPos: [cam.position.x, cam.position.y, cam.position.z], camRot: [cam.rotation.x, cam.rotation.y, cam.rotation.z] };
  const scene = cam.parent;
  const counts = { meshes: 0 };
  const walk = (obj) => {
    for (const c of obj.children) {
      if (c.geometry && c.visible) {
        counts.meshes++;
        if (c.geometry.type === 'BoxGeometry') {
          const g = c.geometry;
          if (!g.boundingBox) g.computeBoundingBox();
          const cw = new cam.position.constructor();
          g.boundingBox.getCenter(cw);
          const ctr = new cam.position.constructor();
          ctr.copy(cw).applyMatrix4(c.matrixWorld || new (cam.position.constructor.constructor)());
          const mw = c.matrixWorld.elements;
          const worldC = [mw[12]+mw[0]*cw.x+mw[4]*cw.y+mw[8]*cw.z, mw[13]+mw[1]*cw.x+mw[5]*cw.y+mw[9]*cw.z, mw[14]+mw[2]*cw.x+mw[6]*cw.y+mw[10]*cw.z];
          if (Math.abs(worldC[0]) < 10 && worldC[2] < -15) {
            counts.sample = { center: worldC.map(v=>+v.toFixed(1)), bbMin: [g.boundingBox.min.x, g.boundingBox.min.y, g.boundingBox.min.z], bbMax: [g.boundingBox.max.x, g.boundingBox.max.y, g.boundingBox.max.z] };
          }
        }
      }
      walk(c);
    }
  };
  walk(scene);
  info.counts = counts;
  return info;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
