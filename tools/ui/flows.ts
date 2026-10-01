// The flows the UI driver runs (tools/ui/drive.ts): golden paths, each a short list of steps in the language of the
// app itself — a door by its manifest id, a real gesture, a photo, an expectation read through the test port. Adding a
// flow is adding one entry here; adding a way to touch the app is adding one step kind to the driver.
//
// A flow never reaches into the app's insides: it acts through doors and reads through `__builderTestPort` (the
// document, the selection, the status bar's message, the incident feed, the explanations), so what it proves is what a
// person would get.

export type Step =
  // press a door: the first control drawn for it (a palette tile takes its label, a Layers row its name)
  | { readonly door: string; readonly labelled?: string }
  // a click on anything the app draws
  | { readonly click: string }
  // type into a control, Enter keeping it unless told otherwise
  | { readonly type: { readonly at: string; readonly text: string; readonly enter?: boolean; readonly clear?: boolean } }
  // a key with its modifiers, as a person presses it
  | { readonly key: string }
  // type into the currently focused editor, including its canvas iframe
  | { readonly text: string }
  // move across a control in small real pointer steps; fractions are relative to its drawn box
  | { readonly move: { readonly at: string; readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly steps: number; readonly interval: number } }
  // a real drag: from one node or point to another, in page pixels (the frame's own space)
  | { readonly drag: { readonly from: string | { readonly x: number; readonly y: number }; readonly to: string | { readonly x: number; readonly y: number }; readonly modifier?: string } }
  // wait for the app to settle (two frames and a breath)
  | { readonly wait?: number }
  // name the photo taken after this step (every step is photographed; a flow may name the ones that matter)
  | { readonly photo: string }
  // what the app must say after this step, read through the test port
  | {
      readonly expect: {
        readonly selection?: readonly string[];
        readonly selectedCount?: number;
        readonly message?: string;
        readonly nodes?: number;
        readonly files?: readonly string[];
        readonly exportedFiles?: readonly string[];
      };
    };

export interface Flow {
  readonly name: string;
  readonly about: string;
  readonly steps: readonly Step[];
}

const CONTAINER_TILE = { door: 'element.insert#elements-tile', labelled: 'Container' } as const;
const PARAGRAPH_TILE = { door: 'element.insert#elements-tile', labelled: 'Paragraph' } as const;
const HEADING_TILE = { door: 'element.insert#elements-tile', labelled: 'Heading' } as const;
const INSERT_PANEL = { door: 'workspace.setPanelOpen#toolbar-activity-bar-insert' } as const;
const STYLE_TAB = { door: 'workspace.setActiveTab#inspector-tab-style' } as const;

export const FLOWS: readonly Flow[] = [
  {
    name: 'field-history',
    about: 'a confirmed field keeps focus while document undo and redo update it and the canvas',
    steps: [
      INSERT_PANEL,
      HEADING_TILE,
      STYLE_TAB,
      { type: { at: '[data-door="inspector.search#inspector-search-field"] input', text: 'font-size', enter: false } },
      { type: { at: '[data-door="style.set#inspector-font-size"] input', text: '32px' } },
      { photo: 'confirmed-value' },
      { key: 'Control+z' },
      { expect: { message: 'Undone:' } },
      { photo: 'undone-with-field-focused' },
      { key: 'Control+y' },
      { expect: { message: 'Redone:' } },
      { photo: 'redone-with-field-focused' },
    ],
  },
  {
    name: 'button-text-spaces',
    about: 'spaces typed in the button on the canvas are kept as text and undone together',
    steps: [
      INSERT_PANEL,
      { door: 'element.insert#elements-tile', labelled: 'Button' },
      { key: 'Escape' },
      { key: 'Enter' },
      { key: 'Control+a' },
      { text: 'Conhecer os planos' },
      { photo: 'button-with-spaces-during-edit' },
      { key: 'Enter' },
      { expect: { message: 'Saved the text of Button.' } },
      { photo: 'button-with-spaces-saved' },
      { key: 'Control+z' },
      { photo: 'button-text-undone' },
    ],
  },
  {
    name: 'menu-rest',
    about: 'a slow crossing keeps File open, while a stationary pointer over Edit switches after the dwell',
    steps: [
      { click: '[data-menu="file"]' },
      { move: { at: '[data-menu="edit"]', from: [0.1, 0.1], to: [0.9, 1.6], steps: 12, interval: 25 } },
      { photo: 'file-after-slow-crossing' },
      { click: '[data-door="project.save#menu-file"]' },
      { photo: 'project-saved' },
      { click: '[data-menu="file"]' },
      { move: { at: '[data-menu="edit"]', from: [0.5, 0.5], to: [0.5, 0.5], steps: 1, interval: 180 } },
      { photo: 'edit-after-rest' },
      { key: 'Escape' },
    ],
  },
  {
    name: 'typing-safety',
    about: 'letters after an outside press leave the structure intact; an intentional canvas shortcut still works',
    steps: [
      INSERT_PANEL,
      CONTAINER_TILE,
      HEADING_TILE,
      { expect: { nodes: 3 } },
      { click: '.status-bar__message' },
      { key: 'g' },
      { expect: { nodes: 3, message: 'Letters typed here do nothing' } },
      { photo: 'outside-letters-blocked' },
      { key: 'F6' },
      { key: 'Escape' },
      { wait: 400 },
      { key: 'r' },
      { expect: { nodes: 4 } },
      { photo: 'chosen-canvas-shortcut' },
      { key: 'Control+z' },
      { expect: { nodes: 3 } },
    ],
  },
  {
    name: 'open',
    about: 'the app opens, the empty project is there, and nothing is wrong',
    steps: [{ click: '.workbench' }, { photo: 'the-editor' }, { expect: { message: '' } }],
  },
  {
    name: 'insert',
    about: 'a container, a heading and a paragraph go in through the palette, and the document holds them',
    steps: [
      INSERT_PANEL,
      CONTAINER_TILE,
      { expect: { selectedCount: 1, nodes: 2 } },
      { photo: 'container' },
      HEADING_TILE,
      { door: 'workspace.setActiveTab#inspector-tab-settings' },
      { type: { at: '.inspector textarea', text: 'Hello from the driver', enter: true } },
      { photo: 'heading-with-text' },
      PARAGRAPH_TILE,
      { expect: { nodes: 4 } },
      { photo: 'paragraph' },
    ],
  },
  {
    name: 'style',
    about: 'the panel writes a colour and a size onto the selected element, and the frame computes them',
    steps: [
      INSERT_PANEL,
      CONTAINER_TILE,
      HEADING_TILE,
      STYLE_TAB,
      { type: { at: '[data-door="style.set#inspector-color"] input', text: '#ff0000', enter: true } },
      { type: { at: '[data-door="style.set#inspector-font-size"] input', text: '48px', enter: true } },
      { photo: 'styled' },
      { expect: { selectedCount: 1 } },
    ],
  },
  {
    name: 'drag',
    about: 'an element is dragged on the canvas and lands where it was dropped',
    steps: [
      INSERT_PANEL,
      CONTAINER_TILE,
      HEADING_TILE,
      { drag: { from: 'Heading', to: { x: 40, y: 300 } } },
      { photo: 'after-the-drag' },
      { expect: { selectedCount: 1 } },
    ],
  },
  {
    name: 'undo',
    about: 'a change and its undo: the document comes back to what it was',
    steps: [
      INSERT_PANEL,
      CONTAINER_TILE,
      { expect: { nodes: 2 } },
      { key: 'Control+z' },
      { expect: { nodes: 1 } },
      { key: 'Control+Shift+z' },
      { expect: { nodes: 2 } },
      { photo: 'redone' },
    ],
  },
  {
    name: 'quick-panel',
    about: 'the quick panel opens over the selection with its fields',
    steps: [
      INSERT_PANEL,
      CONTAINER_TILE,
      { key: 'Control+Shift+Q' },
      { wait: 300 },
      { photo: 'quick-panel' },
      { key: 'Escape' },
      { photo: 'closed-again' },
    ],
  },
  {
    name: 'export',
    about: 'the project exports: the ZIP carries the page, the stylesheet and no incident',
    steps: [
      INSERT_PANEL,
      CONTAINER_TILE,
      {
        click: '[data-door="project.export#toolbar-top-bar-export"]',
      },
      { wait: 800 },
      { photo: 'exported' },
      { expect: { exportedFiles: ['index.html', 'css/styles.css'] } },
    ],
  },
];
