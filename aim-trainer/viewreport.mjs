import fs from 'node:fs';
import { PNG } from 'pngjs';

const report = (f) => {
  const png = PNG.sync.read(fs.readFileSync(`/tmp/opencode/${f}`));
  const { width: w, height: h, data } = png;
  const px = (x, y) => {
    const i = (y * w + x) * 4;
    return `(${data[i]},${data[i + 1]},${data[i + 2]})`;
  };
  console.log(`--- ${f} ---`);
  for (const yf of [0.12, 0.25, 0.4, 0.5, 0.6, 0.72, 0.85]) {
    const row = [];
    for (const xf of [0.08, 0.25, 0.5, 0.75, 0.92]) row.push(`${(xf * 100).toFixed(0)}%:${px(Math.floor(w * xf), Math.floor(h * yf))}`);
    console.log(`y=${(yf * 100).toFixed(0)}%`, row.join(' '));
  }
};
['v2-front.png', 'v2-back.png', 'v2-left.png', 'v2-right.png', 'v2-backdown.png', 'v2-far.png'].forEach(report);
