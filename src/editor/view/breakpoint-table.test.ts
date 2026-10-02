// The project's breakpoints (spec project-breakpoints) on the real store: what each change makes of the table, the
// styles that go with a removed breakpoint, the refusals, the undo, and that the canvas's cascade, the validator and
// the export read the project's table.
import { describe, expect, it } from 'vitest';
import fixture from '../../../manifest/features/fixtures/responsive-title.json';
import { breakpointsOf, documentWithout, isRefusal } from '../../core/document/breakpoints.ts';
import type { DocumentJson } from '../../core/document/model.ts';
import { validateDocument } from '../../core/document/validate.ts';
import { siteFiles } from '../../core/export/export.ts';
import { createEditorStore, MODEL_RULES } from '../store.ts';
import { activeBreakpoint, viewportWidth } from './breakpoints.ts';

const quiet = { read: () => null, write: () => {} };
const storeWith = (document?: DocumentJson) => createEditorStore({ storage: quiet, freeze: true, ...(document === undefined ? {} : { restored: { document, selection: [] } }) });
const ids = (document: DocumentJson) => breakpointsOf(document).map((b) => `${b.id}:${b.width}`);

describe('project breakpoints', () => {
  it('makes a breakpoint at the width the canvas shows, shows it, and undoes to the default table', () => {
    const store = storeWith();
    store.dispatch('view.setViewportWidth', { width: 900 });
    expect(store.dispatch('breakpoints.add', {}).status).toBe('done');
    const { document } = store.getState();
    expect(ids(document)).toEqual(['desktop:1440', 'laptop:1180', 'screen-900:900', 'tablet:834', 'phone:390']);
    expect(breakpointsOf(document).find((b) => b.id === 'screen-900')?.name).toBe('Screen 900');
    expect(activeBreakpoint(store.getState()).id).toBe('screen-900');
    expect(viewportWidth(store.getState())).toBe(900);
    expect(store.getState().history.past).toHaveLength(1);
    store.dispatch('history.undo', {});
    expect(store.getState().document.breakpoints).toBeUndefined();
  });

  it('refuses a width the table has, past the base, or past a neighbour', () => {
    const store = storeWith();
    expect(store.dispatch('breakpoints.add', { width: 834 }).status).toBe('refused');
    expect(store.dispatch('breakpoints.add', { width: 1440 }).status).toBe('refused');
    expect(store.dispatch('breakpoints.add', { width: 100 }).status).toBe('refused');
    expect(store.dispatch('breakpoints.setWidth', { breakpoint: 'tablet', width: 1180 }).status).toBe('refused');
    expect(store.dispatch('breakpoints.setWidth', { breakpoint: 'tablet', width: 390 }).status).toBe('refused');
    expect(store.dispatch('breakpoints.setWidth', { breakpoint: 'tablet', width: 1179 }).status).toBe('done');
    expect(store.dispatch('breakpoints.setWidth', { breakpoint: 'desktop', width: 1600 }).status).toBe('done');
    expect(ids(store.getState().document)).toEqual(['desktop:1600', 'laptop:1180', 'tablet:1179', 'phone:390']);
  });

  it('renames, refuses a name another breakpoint shows, and gives a default its own name back', () => {
    const store = storeWith();
    expect(store.dispatch('breakpoints.rename', { breakpoint: 'tablet', name: 'Phone' }).status).toBe('refused');
    expect(store.dispatch('breakpoints.rename', { breakpoint: 'tablet', name: '  ' }).status).toBe('refused');
    expect(store.dispatch('breakpoints.rename', { breakpoint: 'tablet', name: 'Tablet portrait' }).status).toBe('done');
    expect(breakpointsOf(store.getState().document).find((b) => b.id === 'tablet')?.name).toBe('Tablet portrait');
    expect(store.dispatch('breakpoints.rename', { breakpoint: 'tablet', name: 'Tablet' }).status).toBe('done');
    expect(breakpointsOf(store.getState().document).find((b) => b.id === 'tablet')?.name).toBeNull();
  });

  it('removes a breakpoint with the styles set at it, never the base, and undo brings them back', () => {
    const store = storeWith(fixture as unknown as DocumentJson);
    store.dispatch('view.setBreakpoint', { breakpoint: 'tablet' });
    expect(store.dispatch('breakpoints.remove', { breakpoint: 'desktop', styles: 'discard' }).status).toBe('refused');
    expect(store.dispatch('breakpoints.remove', { breakpoint: 'tablet', styles: 'discard' }).status).toBe('done');
    const title = store.getState().document.pages[0]?.tree.children[0];
    expect(Object.keys(title?.styles ?? {})).toEqual(['desktop', 'phone']);
    expect(activeBreakpoint(store.getState()).id).toBe('desktop');
    expect(ids(store.getState().document)).toEqual(['desktop:1440', 'laptop:1180', 'phone:390']);
    store.dispatch('history.undo', {});
    expect(Object.keys(store.getState().document.pages[0]?.tree.children[0]?.styles ?? {})).toEqual(['desktop', 'tablet', 'phone']);
    expect(store.getState().document.breakpoints).toBeUndefined();
  });

  it('moves the styles of a removed breakpoint into a neighbour, where it sets nothing of its own', () => {
    const narrower = storeWith(fixture as unknown as DocumentJson);
    expect(narrower.dispatch('breakpoints.remove', { breakpoint: 'phone', styles: 'narrower' }).status).toBe('refused');
    expect(narrower.dispatch('breakpoints.remove', { breakpoint: 'tablet', styles: 'narrower' }).status).toBe('done');
    // the phone keeps its own size: its own value wins over the tablet's it inherited
    expect(narrower.getState().document.pages[0]?.tree.children[0]?.styles).toEqual({ desktop: { base: { 'font-size': '48px' } }, phone: { base: { 'font-size': '24px' } } });
    const wider = storeWith(fixture as unknown as DocumentJson);
    expect(wider.dispatch('breakpoints.remove', { breakpoint: 'tablet', styles: 'wider' }).status).toBe('done');
    // the laptop held nothing: it takes the tablet's size
    expect(wider.getState().document.pages[0]?.tree.children[0]?.styles).toEqual({ desktop: { base: { 'font-size': '48px' } }, laptop: { base: { 'font-size': '32px' } }, phone: { base: { 'font-size': '24px' } } });
    expect(wider.getState().message?.key).toBe('status.breakpoints.removedInto');
  });

  it('refuses removing a breakpoint a motion runs only at', () => {
    const document = { ...(fixture as unknown as DocumentJson), pages: [{ ...(fixture as unknown as DocumentJson).pages[0], motions: [{ breakpoints: ['tablet'] }] }] };
    expect(isRefusal(documentWithout(document as unknown as Record<string, unknown>, 'tablet'))).toBe(true);
    expect(isRefusal(documentWithout(document as unknown as Record<string, unknown>, 'phone'))).toBe(false);
    // moved into another breakpoint, the motion runs there instead
    const moved = documentWithout(document as unknown as Record<string, unknown>, 'tablet', 'phone');
    expect(isRefusal(moved) ? null : JSON.stringify(moved.document)).toContain('"breakpoints":["phone"]');
  });

  it('validates styles against the project table and writes its media queries', () => {
    const base = fixture as unknown as DocumentJson;
    const styled = (breakpoints: DocumentJson['breakpoints']): DocumentJson => ({
      ...base,
      ...(breakpoints === undefined ? {} : { breakpoints }),
      pages: base.pages.map((page) => ({ ...page, tree: { ...page.tree, children: page.tree.children.map((n) => ({ ...n, styles: { ...n.styles, 'screen-900': { base: { 'font-size': '40px' } } } })) } })),
    });
    expect(validateDocument(styled(undefined), [], MODEL_RULES).some((p) => p.path.endsWith('/styles/screen-900'))).toBe(true);
    const table = [...breakpointsOf(base)];
    table.splice(2, 0, { id: 'screen-900', name: 'Screen 900', width: 900, height: 1194, base: false });
    const document = styled(table);
    expect(validateDocument(document, [], MODEL_RULES)).toEqual([]);
    const { css } = siteFiles(document, MODEL_RULES);
    expect(css).toContain('@media (max-width: 900px)');
    expect(css.indexOf('max-width: 1180px')).toBeLessThan(css.indexOf('max-width: 900px'));
    expect(css.indexOf('max-width: 900px')).toBeLessThan(css.indexOf('max-width: 834px'));
    // a table out of order or with two bases is no project's
    expect(validateDocument({ ...document, breakpoints: [...table].reverse() }, [], MODEL_RULES).some((p) => p.path.startsWith('/breakpoints'))).toBe(true);
  });
});
