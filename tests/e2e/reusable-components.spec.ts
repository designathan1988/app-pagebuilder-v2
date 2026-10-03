// reusable-components beyond its scenarios (spec/BEHAVIOUR.md#reusable-components): the context menu shows only the
// commands that apply (PRODUCT.md §5.3 context-menu), so Create a component is left out on the page root and inside an
// instance, whose refusals no built door reaches (the handlers' refusals are unit tests, components.test.ts); Detach
// from the component is offered on an instance's root only. The scenarios cannot say an item is not drawn: this test
// reads the open menu in Chrome, after the document holds the component.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const MENU = 'contextMenu.open#layers-row-secondary-click';
const CREATE = 'components.startCreate#context-menu';
// the name prompt the create opens: its field keeps the name (the element's own is filled in)
const PROMPT = 'components.create#prompt-name';
const DETACH = 'components.detach#context-menu';

type Port = { document: () => { components?: { name: string }[] } };
const componentNames = (page: Page) => page.evaluate(() => ((window as unknown as { __builderTestPort: Port }).__builderTestPort.document().components ?? []).map((c) => c.name));
const item = (page: Page, ref: string) => page.locator(`[data-door="${ref}"]`);

test('an outside click closes the component prompt and selects the target row without creating anything', runs(OPEN, MENU, CREATE), async ({ page }) => {
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles(FIXTURE);
  await menuOn(page, 'n-card-a');
  await control(page, CREATE).click();
  await expect(control(page, PROMPT).locator('input')).toBeFocused();
  const row = control(page, 'selection.select#layers-row', { args: { target: 'n-title' } });
  await row.click();
  await expect(page.locator('[data-region="component-prompt"]')).toHaveCount(0);
  await expect(row).toBeFocused();
  expect(await componentNames(page)).toEqual([]);
});

async function menuOn(page: Page, target: string): Promise<void> {
  await page.keyboard.press('Escape');
  await runDoor(page, MENU, { args: { target } });
  await expect(page.locator('[role="menu"]').first()).toBeVisible();
}

test('Create a component is offered only where it applies, Detach only on an instance', runs(OPEN, MENU, CREATE, PROMPT, DETACH), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  // an ordinary element: Create, no Detach
  await menuOn(page, 'n-card-a');
  await expect(item(page, CREATE)).toHaveCount(1);
  await expect(item(page, DETACH)).toHaveCount(0);
  await control(page, CREATE).click();
  await control(page, PROMPT).locator('input').fill('CardA');
  await page.keyboard.press('Enter');
  await expect.poll(() => componentNames(page)).toEqual(['CardA']);
  // the instance's root: Detach, no Create; an element inside it: neither
  await menuOn(page, 'n-card-a');
  await expect(item(page, DETACH)).toHaveCount(1);
  await expect(item(page, CREATE)).toHaveCount(0);
  await menuOn(page, 'n-card-a-title');
  await expect(item(page, CREATE)).toHaveCount(0);
  await expect(item(page, DETACH)).toHaveCount(0);
  // the page root: no Create
  await menuOn(page, 'n-page');
  await expect(item(page, CREATE)).toHaveCount(0);
  // another card: Create, and no Detach
  await menuOn(page, 'n-card-b');
  await expect(item(page, CREATE)).toHaveCount(1);
  await expect(item(page, DETACH)).toHaveCount(0);
});
