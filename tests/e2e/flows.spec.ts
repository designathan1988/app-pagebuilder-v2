// Every flow of tools/ui/flows.ts, played as a test of its own (the audit's AUD-31: no gate ran the flows, and
// forms-mask had been broken since 87eb183 by a selector the forms panel no longer drew). A flow plays on a fresh
// editor with the real gestures `npm run ui` uses (tools/ui/play.ts): it passes when every expectation it states is met
// and the page logs no error and records no incident.
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { FLOWS } from '../../tools/ui/flows.ts';
import { playFlow } from '../../tools/ui/play.ts';

for (const flow of FLOWS) {
  test(`the ${flow.name} flow plays clean: ${flow.about}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEditor(page);
    expect(await playFlow(page, flow)).toEqual([]);
  });
}
