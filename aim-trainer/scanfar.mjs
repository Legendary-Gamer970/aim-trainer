import fs from 'node:fs';
import { PNG } from 'pngjs';

const report = (f, label) => {
  const png = PNG.sync.read(fs.readFileSync(`/tmp/opencode/${f}`));
  const { width: w, height: h, data } = png;
  const px = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  console.log(`--- ${label} ---`);
  for (const yf of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
    const row = [];
    for (const xf of [0.1, 0.3, 0.5, 0.7, 0.9]) row.push(`${(xf * 100).toFixed(0)}%:${px(Math.floor(w * xf), Math.floor(h * yf)).join(',')}`);
    console.log(`y=${(yf * 100).toFixed(0)}%`, row.join(' '));
  }
};
report('env-far.png', 'far (hills, horizon edge)');
report('env-ground.png', 'ground (pad/grass)');
report('env-back.png', 'back (platform/shed)');
