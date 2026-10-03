// FT1: a code file's tab, and its close button, are current only while the file shows (the Code view, or Split beside
// the canvas): over the canvas alone every open file's tab was drawn current beside the page's, two tabs selected.
import { describe, expect, it } from 'vitest';
import type { EditorUi } from '../state.ts';
import { MODEL_RULES } from '../store.ts';
import { openFile } from './explorer.ts';
import { closeFileTab, isFileShown } from './file-tabs.ts';

const ui = (editorView: 'code' | 'split' | undefined) => ({ code: { open: ['css/styles.css', 'js/menu.js'], active: 'css/styles.css' }, ...(editorView === undefined ? {} : { editorView }) }) as unknown as EditorUi;
const state = (editorView: 'code' | 'split' | undefined) => ({ ui: ui(editorView) }) as unknown as Parameters<NonNullable<typeof openFile.current>>[0];

describe('a code file tab is current while its file shows (FT1)', () => {
  it('shows the active file in the Code view and in Split, never over the canvas alone, never another open file', () => {
    expect(isFileShown(ui('code'), 'css/styles.css')).toBe(true);
    expect(isFileShown(ui('split'), 'css/styles.css')).toBe(true);
    expect(isFileShown(ui(undefined), 'css/styles.css')).toBe(false);
    expect(isFileShown(ui('code'), 'js/menu.js')).toBe(false);
  });

  it('draws the tab and its close button current only then', () => {
    expect(openFile.current?.(state(undefined), { path: 'css/styles.css' }, MODEL_RULES)).toBe(false);
    expect(openFile.current?.(state('code'), { path: 'css/styles.css' }, MODEL_RULES)).toBe(true);
    expect(openFile.current?.(state('code'), { path: 'js/menu.js' }, MODEL_RULES)).toBe(false);
    expect(closeFileTab.current?.(state(undefined), { path: 'css/styles.css' }, MODEL_RULES)).toBe(false);
  });
});
