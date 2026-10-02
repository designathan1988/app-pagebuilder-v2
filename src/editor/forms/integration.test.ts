import { describe, expect, it } from 'vitest';
import { createEditorStore, MODEL_RULES } from '../store.ts';
import { manualClock } from '../../core/ports/clock.ts';
import { sequentialIds } from '../../core/ports/ids.ts';
import { validateDocument } from '../../core/document/validate.ts';
import { previewPage, siteFiles } from '../../core/export/export.ts';
import { siteScripts } from './script.ts';

function storeWithInput() {
  const store = createEditorStore({ ids: sequentialIds('forms'), clock: manualClock(Date.UTC(2026, 9, 1)), ports: { readOnly: () => false } });
  store.dispatch('element.insert', { entry: 'input-text' });
  return store;
}
describe('forms integrated with the document, history and output owners', () => {
  it('requires text-compatible controls for masks without losing validation or history', () => {
    const store = storeWithInput();
    store.dispatch('element.setInputType', { type: 'number' });
    const numeric = store.getState();
    const value = JSON.stringify({ mask: { kind: 'preset', preset: 'cpf' } });
    expect(store.dispatch('element.setAttribute', { attribute: 'formField', value }).status).toBe('refused');
    expect(store.getState().document).toBe(numeric.document);
    expect(store.getState().history).toBe(numeric.history);
    store.dispatch('element.setInputType', { type: 'text' });
    expect(store.dispatch('element.setAttribute', { attribute: 'formField', value }).status).toBe('done');
    const masked = store.getState();
    expect(store.dispatch('element.setInputType', { type: 'number' }).status).toBe('refused');
    expect(store.getState().document).toBe(masked.document);
    expect(store.getState().history).toBe(masked.history);
  });
  it('refuses malformed configuration before history and validates imported values too', () => {
    const store = storeWithInput();
    const before = store.getState();
    const invalid = JSON.stringify({ mask: { kind: 'regex', pattern: '[' } });
    expect(store.dispatch('element.setAttribute', { attribute: 'formField', value: invalid }).status).toBe('refused');
    expect(store.getState().document).toBe(before.document);
    expect(store.getState().history).toBe(before.history);
    const document = structuredClone(before.document);
    const input = document.pages[0]?.tree.children[0];
    if (!input) throw new Error('The inserted field is missing');
    const imported = { ...document, pages: document.pages.map(page => ({ ...page, tree: { ...page.tree, children: [{ ...input, attributes: { ...input.attributes, formField: invalid } }] } })) };
    expect(validateDocument(imported, [], MODEL_RULES)).toEqual(expect.arrayContaining([expect.objectContaining({ path: '/pages/0/tree/children/0/attributes/formField' })]));
  });
  it('keeps configuration in one undo step and writes identical runtime text into preview', () => {
    const store = storeWithInput();
    const before = store.getState().document;
    const value = JSON.stringify({ mask: { kind: 'preset', preset: 'cpf' } });
    expect(store.dispatch('element.setAttribute', { attribute: 'formField', value }).status).toBe('done');
    const configured = store.getState().document;
    store.dispatch('history.undo', {});
    expect(store.getState().document).toEqual(before);
    store.dispatch('history.redo', {});
    expect(store.getState().document).toEqual(configured);
    const files = siteFiles(configured, MODEL_RULES, true, siteScripts);
    expect(files.forms).toContain('Check this value and its format.');
    expect(files.forms).toContain('Confira');
    const preview = previewPage(configured, MODEL_RULES, 0, siteScripts);
    expect(preview).toContain(files.forms);
    expect(preview.match(/<!DOCTYPE html>/g)).toHaveLength(1);
    expect(preview).not.toContain('<script defer src="js/forms.js">');
    expect(siteFiles(before, MODEL_RULES, true, siteScripts).forms).toBeNull();
  });
});
