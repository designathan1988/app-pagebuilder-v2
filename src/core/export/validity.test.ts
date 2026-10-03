// The exported pages are valid HTML (stage 6; the audit's AUD-22): every fixture's export, page by page, through
// html-validate's recommended rules. An error is accepted only where the Checks panel tells the person about the same
// element with the same rule (a form with no submit button: what it holds is the person's to finish), never one the
// export makes itself (an input written without its type).
import fs from 'node:fs';
import { HtmlValidate } from 'html-validate';
import { describe, expect, it } from 'vitest';
import { siteScripts } from '../../editor/forms/script.ts';
import { MODEL_RULES } from '../../editor/store.ts';
import { manifest } from '../../manifest/runtime.ts';
import { checksOf } from '../a11y/checks.ts';
import type { DocumentJson } from '../document/model.ts';
import { pageLines, siteFiles } from './export.ts';

const FIXTURES = fs.readdirSync('manifest/features/fixtures').filter((file) => file.endsWith('.json'));
// the html-validate rules a check of the Checks panel stands for
const REPORTED_BY_CHECKS: Readonly<Record<string, string>> = { 'wcag/h32': 'checks.formSubmit', 'wcag/h37': 'checks.imageAlt' };

describe('the export of every fixture', () => {
  it('is valid HTML, but for what Checks reports on the same element', { timeout: 60_000 }, async () => {
    const validator = new HtmlValidate({ extends: ['html-validate:recommended'] });
    const unreported: string[] = [];
    for (const file of FIXTURES) {
      const document = JSON.parse(fs.readFileSync(`manifest/features/fixtures/${file}`, 'utf8')) as DocumentJson;
      const site = siteFiles(document, MODEL_RULES, true, siteScripts);
      const issues = checksOf(document, manifest.interactions.checks);
      for (const [index, page] of site.pages.entries()) {
        // the node each line was written for (the code pane's map), line for line with the page
        const lines = pageLines(document, index, MODEL_RULES).html;
        expect(lines.length, `${file} ${page.file}`).toBe(page.html.split('\n').length);
        const report = await validator.validateString(page.html);
        for (const said of report.results.flatMap((result) => result.messages)) {
          const node = lines[said.line - 1]?.node ?? null;
          const rule = REPORTED_BY_CHECKS[said.ruleId];
          if (node !== null && rule !== undefined && issues.some((issue) => issue.node === node && issue.rule === rule)) continue;
          unreported.push(`${file} ${page.file}:${said.line} ${said.ruleId}: ${said.message}`);
        }
      }
    }
    expect(unreported).toEqual([]);
  });
});
