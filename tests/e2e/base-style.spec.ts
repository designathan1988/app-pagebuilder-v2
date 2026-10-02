import fs from 'node:fs';
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { unzip } from '../../tools/runner/unzip.ts';
import { runDoor, runs } from './door.ts';

const IMPORT = 'project.importHtml#menu-file';
const EXPORT = 'project.export#toolbar-top-bar-export';

test('neutral defaults render in the canvas and export while authored CSS keeps its value', runs(IMPORT, EXPORT), async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const freshPage = await page.locator('.frame__page').evaluate((iframe) => {
    const body = (iframe as HTMLIFrameElement).contentDocument?.body;
    if (body === undefined) throw new Error('new page is missing');
    return { margin: getComputedStyle(body).marginLeft, font: getComputedStyle(body).fontFamily };
  });
  expect(freshPage.margin).toBe('0px');
  expect(freshPage.font).toContain('system-ui');

  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, IMPORT);
  await (await chooser).setFiles([
    {
      name: 'index.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><section class="card"><h2 style="font-size: 28px">Title</h2><h3>Subheading</h3><p>Text</p><ul><li>Item</li></ul><blockquote>Quote</blockquote><pre>Code</pre><hr><table><tr><th>Head</th><td>Cell</td></tr></table><form><input type="text"><input type="checkbox"><button>Send</button></form><img alt="Example"><video></video></section><a href="https://example.com">Link</a></body></html>'),
    },
    { name: 'styles.css', mimeType: 'text/css', buffer: Buffer.from('.card { color: #2563eb; }') },
  ]);

  // the import asks where the pages go (spec html-import destinations): the imported page replaces the empty project,
  // so it is the export's index.html, as the export checks below read it
  await page.locator('[data-door="project.importHtml#destination-replace"]').click();
  await page.locator('[data-confirmation="confirm"]').click();
  const frame = page.frameLocator('.frame__page');
  await expect(frame.getByText('Title')).toBeVisible();
  await page.keyboard.press('Control+0');
  const canvas = await page.locator('.frame__page').evaluate((iframe) => {
    const doc = (iframe as HTMLIFrameElement).contentDocument;
    if (doc === null) throw new Error('canvas document is missing');
    const value = (selector: string, property: string) => {
      const element = doc.querySelector(selector);
      if (element === null) throw new Error(`missing ${selector}`);
      return doc.defaultView?.getComputedStyle(element).getPropertyValue(property) ?? '';
    };
    return {
      bodyMargin: value('body', 'margin-left'),
      bodyFont: value('body', 'font-family'),
      titleSize: value('h2', 'font-size'),
      subtitleSize: value('h3', 'font-size'),
      paragraphMargin: value('p', 'margin-bottom'),
      listPadding: value('ul', 'padding-left'),
      cardColor: value('section', 'color'),
      linkColor: value('a', 'color'),
      quoteBorder: value('blockquote', 'border-left-width'),
      tableCollapse: value('table', 'border-collapse'),
      buttonFont: value('button', 'font-family'),
      textInputRadius: value('input[type="text"]', 'border-radius'),
      checkboxRadius: value('input[type="checkbox"]', 'border-radius'),
      imageWidth: value('img', 'max-width'),
      videoWidth: value('video', 'max-width'),
    };
  });
  expect(canvas.bodyMargin).toBe('0px');
  expect(canvas.bodyFont).toContain('system-ui');
  expect(canvas.titleSize).toBe('28px');
  // the ladder the base gives a heading that carries no authored size: h3 is 1.25rem (the neutral defaults follow the
  // browser's own top two steps, src/core/render/base.ts)
  expect(canvas.subtitleSize).toBe('20px');
  expect(canvas.paragraphMargin).toBe('16px');
  // a list keeps the browser's own indent (spec elements-lists, Problems in Pager 6: no style of the editor's own)
  expect(canvas.listPadding).toBe('40px');
  expect(canvas.cardColor).toBe('rgb(37, 99, 235)');
  expect(canvas.linkColor).toBe('rgb(37, 99, 235)');
  expect(canvas.quoteBorder).toBe('3px');
  expect(canvas.tableCollapse).toBe('collapse');
  expect(canvas.buttonFont).toBe(canvas.bodyFont);
  expect(canvas.textInputRadius).toBe('6px');
  expect(canvas.checkboxRadius).toBe('0px');
  expect(canvas.imageWidth).toBe('100%');
  expect(canvas.videoWidth).toBe('100%');

  const download = page.waitForEvent('download');
  await runDoor(page, EXPORT);
  const files = unzip(fs.readFileSync(await (await download).path()));
  const html = files.get('index.html')?.toString('utf8');
  const css = files.get('css/styles.css')?.toString('utf8');
  if (html === undefined || css === undefined) throw new Error('the export lacks HTML or CSS');
  expect(css).toContain('font-family: system-ui');
  expect(css).toMatch(/\.card\s*\{[^}]*color: #2563eb;/);

  const exported = await context.newPage();
  await exported.setViewportSize({ width: 1440, height: 900 });
  await exported.route('https://site.test/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return path === '/css/styles.css' ? route.fulfill({ contentType: 'text/css', body: css }) : route.fulfill({ contentType: 'text/html', body: html });
  });
  await exported.goto('https://site.test/index.html');
  expect(await exported.locator('body').evaluate((body) => getComputedStyle(body).marginLeft)).toBe(canvas.bodyMargin);
  expect(await exported.locator('h2').evaluate((heading) => getComputedStyle(heading).fontSize)).toBe(canvas.titleSize);
  expect(await exported.locator('.card').evaluate((card) => getComputedStyle(card).color)).toBe(canvas.cardColor);
  await exported.locator('input[type="text"]').focus();
  expect(await exported.locator('input[type="text"]').evaluate((input) => getComputedStyle(input).outlineWidth)).toBe('2px');
  await exported.close();
});
