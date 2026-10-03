// Joins each region's two crops (tools/parity/pair.ts) into one image, the canonical's above the app's, 8 px apart on
// white, scaled 2x when narrower than 700 px: <state>-<region>-pair.png beside the crops. The images are composed on a
// canvas in the installed Chrome, so the tool needs nothing beyond Playwright. Run: node tools/parity/join.ts <folder>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const folder = process.argv[2];
if (!folder) throw new Error('usage: node tools/parity/join.ts <folder of tools/parity/pair.ts>');

const pairs = fs
  .readdirSync(folder)
  .filter((name) => name.endsWith('-canon.png') && !name.includes('whole'))
  .map((name) => ({ canon: path.join(folder, name), app: path.join(folder, name.replace(/-canon\.png$/, '-app.png')) }))
  .filter((pair) => fs.existsSync(pair.app));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const pair of pairs) {
  const dataUrl = (file: string) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  const joined = await page.evaluate(
    async ({ canon, app }) => {
      const load = async (url: string) => createImageBitmap(await (await fetch(url)).blob());
      const [a, b] = await Promise.all([load(canon), load(app)]);
      const width = Math.max(a.width, b.width);
      const height = a.height + b.height + 8;
      const scale = width < 700 ? 2 : 1;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d context');
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.scale(scale, scale);
      context.drawImage(a, 0, 0);
      context.drawImage(b, 0, a.height + 8);
      return canvas.toDataURL('image/png');
    },
    { canon: dataUrl(pair.canon), app: dataUrl(pair.app) },
  );
  fs.writeFileSync(pair.canon.replace(/-canon\.png$/, '-pair.png'), Buffer.from(joined.split(',')[1] ?? '', 'base64'));
}
console.log(`${pairs.length} pairs joined in ${folder}`);
await browser.close();
