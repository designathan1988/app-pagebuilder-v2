import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';
import { unzip } from '../../tools/runner/unzip.ts';
import type { FrameLocator } from '@playwright/test';

const INSERT = 'workspace.setPanelOpen#toolbar-activity-bar-insert';
const TILE = 'element.insert#elements-tile';
const SETTINGS = 'workspace.setActiveTab#inspector-tab-settings';
const KIND = 'element.setAttribute#forms-mask-kind';
const PREVIEW = 'view.enterPreview#key-ctrl-p-in-global';
const EXIT = 'view.exitPreview#key-escape-in-preview';
const EXPORT = 'project.export#toolbar-top-bar-export';
const OPEN = 'project.open#menu-file';
async function write(page: Page, door: string, value: string): Promise<void> {
  const field = control(page, door).locator('input').first();
  await field.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}

test('a configured mask runs in preview and the downloaded site with accessible errors', runs(INSERT, TILE, SETTINGS, KIND, PREVIEW, EXIT, EXPORT), async ({ page }) => {
  await openEditor(page);
  await runDoor(page, INSERT);
  await runDoor(page, TILE, { args: { entry: 'input-text' } });
  await runDoor(page, SETTINGS);
  await write(page, KIND, 'Preset');
  await expect(page.locator('[data-region="status-bar"]')).toContainText('Form settings saved for Input.');
  const trial = control(page, 'element.setAttribute#forms-preview-input').locator('input');
  await trial.fill('52998224725');
  await expect(page.locator('[data-region="forms-settings"] .forms-preview')).toContainText('529.982.247-25');
  await expect(page.locator('[data-region="forms-settings"] .forms-preview')).toContainText('Valid');
  await trial.fill('52998224726');
  await expect(page.locator('[data-region="forms-settings"] .forms-preview')).toHaveText('529.982.247-26 · Raw: 52998224726 · Incomplete or invalid');
  // The shortcut belongs to the global context; leave the configuration text field first.
  await page.locator('[data-region="status-bar"]').click();
  await runDoor(page, PREVIEW);
  await expect(page.locator('[data-region="preview-page"]')).toBeVisible();
  const frame = page.frameLocator('[data-region="preview-page"]');
  const input = frame.locator('input');
  await input.fill('52998224726');
  await input.press('Tab');
  await expect(input).toHaveValue('529.982.247-26');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(frame.getByText('Check this value and its format.')).toBeVisible();
  await input.fill('52998224725');
  await input.press('Tab');
  await expect(input).toHaveValue('529.982.247-25');
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  await runDoor(page, EXIT);
  const download = page.waitForEvent('download');
  await runDoor(page, EXPORT);
  const files = unzip(fs.readFileSync(await (await download).path()));
  expect([...files.keys()].sort()).toEqual(['css/styles.css', 'index.html', 'js/forms.js']);
  const html = files.get('index.html')?.toString('utf8') ?? '';
  expect(html).toContain('<script defer src="js/forms.js"></script>');
  expect(html).not.toMatch(/data-node-id|data-door|__builder/);
  const site = await page.context().newPage();
  const errors: string[] = [];
  site.on('pageerror', error => errors.push(error.message));
  await site.route('https://forms.example/**', route => {
    const path = new URL(route.request().url()).pathname.slice(1) || 'index.html';
    const body = files.get(path);
    return route.fulfill({ status: body ? 200 : 404, body: body ?? '', contentType: path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html' });
  });
  await site.goto('https://forms.example/');
  await site.locator('input').fill('52998224726');
  await site.locator('input').press('Tab');
  await expect(site.locator('input')).toHaveValue('529.982.247-26');
  await expect(site.locator('input')).toHaveAttribute('aria-invalid', 'true');
  await expect(site.getByText('Check this value and its format.')).toBeVisible();
  await site.locator('input').fill('52998224725');
  await site.locator('input').press('Tab');
  await expect(site.locator('input')).toHaveAttribute('aria-invalid', 'false');
  expect(errors).toEqual([]);
  await site.close();
});

const cases = [
  ['cpf', '52998224725', '529.982.247-25'], ['cnpj', '12ABC34501DE35', '12.ABC.345/01DE-35'],
  ['cpf-cnpj', '11222333000181', '11.222.333/0001-81'], ['cep', '01310100', '01310-100'],
  ['phone-br', '11988887777', '(11) 98888-7777'], ['phone-international', '+14155552671', '+14155552671'],
  ['rg', '12345678X', '12345678X'], ['pis', '12044567891', '120.44567.89-1'], ['voter', '012345670191', '0123 4567 0191'],
  ['plate', 'abc1d23', 'ABC1D23'], ['card', '4111111111111111', '4111 1111 1111 1111'],
  ['expiry', '1299', '12/99'], ['cvv', '123', '123'], ['email', 'a@example.org', 'a@example.org'],
  ['url', 'https://example.org/path', 'https://example.org/path'], ['date-br', '29022024', '29/02/2024'],
  ['time', '2359', '23:59'], ['currency', '1234,56', 'R$ 1.234,56'], ['measurement', '12,5', '12,5 kg'],
] as const;

function catalogueProject(): string {
  const node = (id: string, type: string, tag: string, attributes: Record<string, unknown> = {}, text: string | null = null, children: unknown[] = []): unknown => ({ id, type, tag, name: id, attributes, text, children, classes: [], styles: {} });
  const fields = cases.map(([preset]) => node(preset, 'input', 'input', {
    inputType: 'text', name: preset,
    formField: JSON.stringify({ mask: { kind: 'preset', preset, submit: 'raw', ...(preset === 'currency' ? { currency: 'BRL', locale: 'pt-BR' } : {}), ...(preset === 'measurement' ? { suffix: 'kg' } : {}) }, rules: { required: true }, messages: { en: { required: `Required ${preset}` } } }),
  }));
  fields.push(node('send', 'input', 'input', { inputType: 'submit', value: 'Send' }));
  const form = node('catalogue', 'form', 'form', { formSubmit: JSON.stringify({ destination: 'endpoint', endpoint: 'https://forms.example/submit', method: 'POST', encoding: 'json', successId: 'success', errorId: 'failure' }) }, null, fields);
  return JSON.stringify({ version: 1, pages: [{ id: 'home', name: 'Home', file: 'index.html', tree: node('root', 'page', 'body', {}, null, [form, node('success', 'paragraph', 'p', { id: 'success' }, 'Submitted'), node('failure', 'paragraph', 'p', { id: 'failure' }, 'Submission failed')]) }] });
}

async function exerciseCatalogue(surface: Page | FrameLocator): Promise<void> {
  for (const [preset, value, formatted] of cases) {
    const field = surface.locator(`input[name="${preset}"]`);
    await field.click();
    await field.press('Control+A');
    await field.pressSequentially(value);
    await field.press('Tab');
    await expect.poll(async () => (await field.inputValue()).replaceAll('\u00a0', ' '), { message: `${preset} formats its accepted value` }).toBe(formatted);
    await expect(field, `${preset} accepts the formatted value`).toHaveAttribute('aria-invalid', 'false');
    await field.fill('');
    await field.press('Tab');
    await expect(field, `${preset} refuses a missing required value`).toHaveAttribute('aria-invalid', 'true');
    await expect(surface.getByText(`Required ${preset}`, { exact: true })).toBeVisible();
    await field.fill(value);
    await field.press('Tab');
    await expect(field).toHaveAttribute('aria-invalid', 'false');
  }
}

test('all nineteen presets validate and submit raw values in preview and export', runs(OPEN, PREVIEW, EXIT, EXPORT), async ({ page }) => {
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'forms.json', mimeType: 'application/json', buffer: Buffer.from(catalogueProject()) });
  const submissions: Record<string, unknown>[] = [];
  await page.context().route('https://forms.example/submit', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' } });
    submissions.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
  });
  await runDoor(page, PREVIEW);
  const frame = page.frameLocator('[data-region="preview-page"]');
  await exerciseCatalogue(frame);
  await frame.locator('input[type="submit"]').click();
  await expect(frame.getByText('Submitted', { exact: true })).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({ cpf: '52998224725', cnpj: '12ABC34501DE35', currency: '1234.56', measurement: '12.5' });
  expect(Object.keys(submissions[0] ?? {})).toHaveLength(19);
  await runDoor(page, EXIT);
  const download = page.waitForEvent('download');
  await runDoor(page, EXPORT);
  const files = unzip(fs.readFileSync(await (await download).path()));
  const site = await page.context().newPage();
  await site.route('https://site.example/**', route => {
    const path = new URL(route.request().url()).pathname.slice(1) || 'index.html';
    const body = files.get(path);
    return route.fulfill({ status: body ? 200 : 404, body: body ?? '', contentType: path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html' });
  });
  await site.goto('https://site.example/');
  await exerciseCatalogue(site);
  await site.locator('input[type="submit"]').click();
  await expect(site.getByText('Submitted', { exact: true })).toBeVisible();
  expect(submissions).toHaveLength(2);
  expect(submissions[1]).toEqual(submissions[0]);
  await site.close();
});
