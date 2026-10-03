// The panels whose features were built last: a door whose feature is registered as built is usable (the door rule,
// src/app/features.ts), so View › Timeline, View › Checks and Help › Keyboard shortcuts open their panels — the dock's
// Timeline, the Checks and the Keyboard shortcuts — and the Styles view opens with its New variable usable. A door of
// a feature that waits is drawn disabled by the unit test src/editor/doors/door.test.tsx, which plants one.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { openMenu, runDoor, runs } from './door.ts';

// the doors the manifest places in a region
function placedIn(region: string): string[] {
  const refs: string[] = [];
  for (const file of fs.readdirSync('manifest/commands')) {
    const { commands } = JSON.parse(fs.readFileSync(path.join('manifest/commands', file), 'utf8')) as { commands: { id: string; entryPoints: { id: string; placement: { region: string } | string }[] }[] };
    for (const c of commands) for (const d of c.entryPoints) if (typeof d.placement === 'object' && d.placement.region === region) refs.push(`${c.id}#${d.id}`);
  }
  return refs;
}

// every door drawn in a region, with whether it is disabled and why
const drawnIn = (page: Page, region: string) =>
  page.locator(`[data-region="${region}"] [data-door]`).evaluateAll((els) => els.map((el) => ({ ref: el.getAttribute('data-door') ?? '', disabled: el.getAttribute('aria-disabled') === 'true', title: el.getAttribute('title') ?? '' })));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await expect(page.locator('.workbench')).toBeVisible();
});

// The door rule (the user's order of 2026-09-26, item 3): View › Timeline's feature (timeline-animations) is
// registered as built, so the item is usable and opens the dock's Timeline tab with its 18 doors drawn.
test('View › Timeline opens the dock on its Timeline tab', runs('workspace.setPanelOpen#menu-view-timeline'), async ({ page }) => {
  const tabs = () => page.locator('[data-region="tab-strip"] [role="tab"]').evaluateAll((els) => els.map((el) => el.textContent));
  // a fresh profile keeps the dock closed, drawing only its strip (DEC-02, which revoked A3.18's no strip): the door
  // opens it
  await openMenu(page, 'view');
  const door = page.locator('[data-door="workspace.setPanelOpen#menu-view-timeline"]');
  await expect(door).not.toHaveAttribute('aria-disabled', 'true');
  await door.click();
  expect(await tabs()).toEqual(['Timeline', 'Checks']);
  const shown = page.locator('[data-region="dock-timeline"]');
  await expect(shown).toBeVisible();
  expect(placedIn('dock-timeline').length).toBe(18);
  expect((await shown.locator('[data-door]').count())).toBeGreaterThan(0);
});

// css-variables-tokens is built: the Styles view's New variable is usable (it was "not available yet" while its feature
// waited); creating a variable through it is its feature's scenarios' to prove.
for (const ref of ['workspace.setPanelOpen#toolbar-activity-bar-styles', 'workspace.setPanelOpen#menu-view-variables']) {
  test(`${ref} opens the Styles view with New variable, usable`, runs(ref), async ({ page }) => {
    const sidebar = await page.locator('.sidebar').boundingBox();
    await runDoor(page, ref);
    const view = await page.locator('[data-region="styles"]').boundingBox();
    expect(view?.x).toBeCloseTo(sidebar?.x ?? -1, 0);
    // the Explorer's own body is gone with the view switched, while the Layers stays: it shows in the stack below
    // whatever view shows (the user's real-use audit, item 3.9; spec panel-resize)
    await expect(page.locator('[data-region="explorer-pages"]')).toHaveCount(0);
    await expect(page.locator('[data-region="explorer-layers"]')).toHaveCount(1);
    const drawn = await drawnIn(page, 'styles');
    // the view's title draws the panel header's own drag handles, then the header's Close (dock-toggles), then New variable
    expect(drawn.map((d) => d.ref).filter((ref) => !ref.startsWith('workspace.movePanel'))).toEqual(['workspace.setPanelOpen#panel-header-close', 'tokens.create#variables-add']);
    expect(drawn.filter((d) => d.disabled || d.title.includes('not available yet')).map((d) => d.ref)).toEqual([]);
  });
}

test('View › Checks and Help › Keyboard shortcuts open their panels', async ({ page }) => {
  for (const [menu, ref, region] of [
    ['view', 'workspace.setPanelOpen#menu-view-checks', 'dock-checks'],
    ['help', 'workspace.setPanelOpen#menu-help-shortcuts', 'shortcuts'],
  ] as const) {
    await page.keyboard.press('Escape');
    await openMenu(page, menu);
    const door = page.locator(`[data-door="${ref}"]`);
    await expect(door, ref).not.toHaveAttribute('aria-disabled', 'true');
    await door.click();
    // the panel it opens is drawn with content, a region of it and the doors inside
    const shown = page.locator(`[data-region="${region}"]`);
    await expect(shown, ref).toBeVisible();
    // and what it holds (the audit's AUD-35: the region alone could be empty): the issues or the words that there are
    // none; the manifest's shortcuts, the command bar's Ctrl+K among them
    if (region === 'dock-checks') await expect(shown.locator('.dock-checks__list li, .dock-checks__none').first(), ref).toBeVisible();
    else await expect(shown.locator('[data-shortcut="commandBar.open#key-ctrl-k-in-global"] kbd'), ref).toHaveText(/K$/);
  }
});
