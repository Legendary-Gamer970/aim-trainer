import fs from 'node:fs';
import { PNG } from 'pngjs';

const scan = (f, label) => {
  const png = PNG.sync.read(fs.readFileSync(`/tmp/opencode/${f}`));
  const { width: w, height: h, data } = png;
  const px = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // find window-blue-ish (150..200, 200..240, 230..255) and sign-blue (30..70, 90..140, 170..215) and board-white (230..255) pixels
  let winBlue = 0, signBlue = 0, boardWhite = 0;
  const winPts = [], signPts = [], whitePts = [];
  for (let y = 60; y < h - 60; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b] = px(x, y);
      if (r >= 140 && r <= 210 && g >= 195 && g <= 240 && b >= 225 && b <= 255) {
        winBlue++;
        if (winPts.length < 3) winPts.push([x, y, r, g, b]);
      }
      if (r >= 30 && r <= 80 && g >= 90 && g <= 150 && b >= 165 && b <= 220) {
        signBlue++;
        if (signPts.length < 3) signPts.push([x, y, r, g, b]);
      }
      if (r >= 235 && g >= 235 && b >= 235 && g > r && b > r) {
        boardWhite++;
        if (whitePts.length < 3) whitePts.push([x, y, r, g, b]);
      }
    }
  }
  console.log(`${label}: window-blue=${winBlue} sign-blue=${signBlue} board-white=${boardWhite}`);
  if (winPts.length) console.log('  window pts:', JSON.stringify(winPts));
  if (signPts.length) console.log('  sign pts:', JSON.stringify(signPts));
  if (whitePts.length) console.log('  white pts:', JSON.stringify(whitePts));
};

scan('env-left.png', 'left view (office)');
scan('env-right.png', 'right view (tower/shed)');
scan('env-back.png', 'back view');
scan('env-front.png', 'front view (berm)');
