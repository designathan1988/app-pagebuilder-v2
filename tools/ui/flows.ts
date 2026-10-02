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
  // accept the browser's pending-draft warning and reload the real page
  | { readonly reload: true }
  | { readonly files: { readonly at: string; readonly paths: readonly string[] } }
  // move across a control in small real pointer steps; fractions are relative to its drawn box
  | { readonly move: { readonly at: string; readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly steps: number; readonly interval: number } }
  // a real drag: from one node or point to another, in page pixels (the frame's own space)
  | { readonly drag: { readonly from: string | { readonly x: number; readonly y: number }; readonly to: string | { readonly x: number; readonly y: number }; readonly modifier?: string } }
  // a stroke drawn with the button held through points of a control, as fractions of its drawn box (the Layout
  // Composer's stage), with a key held through it
  // (from: the stroke starts at the middle of that control, a handle; hold: the button stays down for a photo of the
  // preview, released by the next `release` step)
  | { readonly stroke: { readonly at: string; readonly points: readonly (readonly [number, number])[]; readonly modifier?: string; readonly from?: string; readonly hold?: true } }
  | { readonly release: true }
  // the wheel turned over a control, as a person scrolls the canvas (pixels down; negative: up)
  | { readonly wheel: { readonly at: string; readonly dy: number } }
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
        // text the last export's files hold together, and text none of them may hold
        readonly exportHas?: readonly string[];
        readonly exportLacks?: readonly string[];
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


// The Layout Composer's twelve mandatory cases (.memory/layout-composer-spec.md): points in the page's px at the
// Desktop width (1440 x 900, the stage the page root is composed in), as fractions of the stage.
const PX = (x: number, y: number): readonly [number, number] => [x / 1440, y / 900];
const STAGE = '[data-layout-stage]';
const COMPOSE: readonly Step[] = [{ door: 'workspace.setPanelOpen#toolbar-activity-bar-layout-composer' }, { door: 'layout.enter#layout-compose' }];
const draw = (from: readonly [number, number], to: readonly [number, number], modifier?: string): Step => ({ stroke: { at: STAGE, points: [PX(...from), PX(...to)], ...(modifier === undefined ? {} : { modifier }) } });
// the export, and what no exported file may hold: the composer's authoring data and its overlay
const EXPORTED: readonly Step[] = [{ click: '[data-door="project.export#toolbar-top-bar-export"]' }, { wait: 800 }, { expect: { exportLacks: ['layout-composer', 'authoring', 'data-layout'] } }];
const HEADER_BODY: readonly Step[] = [...COMPOSE, draw([40, 40], [1400, 140]), draw([40, 170], [1400, 700])];

// The Data panel's doors (manifest/commands/content.json) and the files the jornada03 study handed its people.
const DATA_PANEL = { door: 'workspace.setPanelOpen#toolbar-activity-bar-data' } as const;
const CARLA_CSV = 'jornada03/00-frame/targets/carla/cardapio.csv';
const CARLA_PHOTOS = ['jornada03/00-frame/targets/marina/assets/graos.png', 'jornada03/00-frame/targets/marina/assets/xicara.png', 'jornada03/00-frame/targets/marina/assets/loja.png'];
// a part of the card in Connect fields, by what it shows
const part = (to: string) => `[data-door="data.bindElement#data-bind-field"][data-args*='"to":"${to}"'] select`;

export const FLOWS: readonly Flow[] = [
  {
    name: 'data-c4',
    about: "jornada03 C4 with Carla's original files: upload the photos, import cardapio.csv as it is, connect the card's photo, name and price, and fill it",
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/content-card.json'] } },
      { door: 'workspace.setPanelOpen#toolbar-activity-bar-explorer' },
      { files: { at: '[data-door="files.upload#explorer-upload"]', paths: CARLA_PHOTOS } },
      { expect: { files: ['img/graos.png', 'img/xicara.png', 'img/loja.png'] } },
      DATA_PANEL,
      { files: { at: '[data-door="data.preview#data-import"]', paths: [CARLA_CSV] } },
      { photo: 'csv-preview' },
      { type: { at: 'form:has([data-door="data.importNew#data-import-new"]) input[name="name"]', text: 'Cardapio', enter: false } },
      { door: 'data.importNew#data-import-new' },
      { expect: { message: 'Imported 12 items into Cardapio.' } },
      { door: 'selection.select#layers-row', labelled: 'Card' },
      { type: { at: part('image'), text: 'foto' } },
      { type: { at: part('text'), text: 'nome' } },
      { type: { at: `[data-door="data.bindElement#data-bind-field"][data-args*='"to":"text"'] >> nth=1 >> select`, text: 'preco' } },
      { photo: 'mapping' },
      { door: 'data.fill#data-fill' },
      { expect: { message: 'Card repeats 12 items of Cardapio.' } },
      { photo: 'filled' },
    ],
  },
  {
    name: 'data-c2',
    about: 'jornada03 C2: two pages made from the open page and a list of names, the first opened',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/content-site.json'] } },
      DATA_PANEL,
      { type: { at: 'form:has([data-door="pages.fromNames#data-pages-from-names"]) textarea', text: 'Unidade Centro\nUnidade Norte', enter: false } },
      { door: 'pages.fromNames#data-pages-from-names' },
      { expect: { message: 'Made 2 pages from Home.' } },
      { photo: 'pages-made' },
    ],
  },
  {
    name: 'breakpoints',
    about: 'stage 2: a breakpoint made at the width the canvas shows, renamed and resized in the Breakpoints dialog, then removed',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/responsive-title.json'] } },
      { type: { at: '[data-door="view.setViewportWidth#viewport-width"] input.viewport-width__value', text: '900' } },
      { door: 'breakpoints.add#toolbar-breakpoint-add-here' },
      { expect: { message: 'Added the breakpoint Screen 900 at 900 px.' } },
      { photo: 'made-at-900' },
      { door: 'workspace.openDialog#toolbar-breakpoints-manage' },
      { type: { at: '[data-door="breakpoints.rename#breakpoints-dialog-name"][data-args*="screen-900"]', text: 'Small tablet' } },
      { expect: { message: 'Renamed the breakpoint to Small tablet.' } },
      { type: { at: '[data-door="breakpoints.setWidth#breakpoints-dialog-width"][data-args*="screen-900"]', text: '960' } },
      { expect: { message: 'Small tablet now holds screens up to 960 px.' } },
      { photo: 'dialog-renamed-and-resized' },
      { click: `[data-door="breakpoints.remove#breakpoints-dialog-remove"][aria-haspopup][data-args*='"tablet"']` },
      { photo: 'where-the-styles-go' },
      { click: `[data-door="breakpoints.remove#breakpoints-dialog-remove"][data-args*='"narrower"']` },
      { expect: { message: 'Removed the breakpoint Tablet; its styles moved to Phone.' } },
      { photo: 'tablet-removed' },
    ],
  },
  {
    name: 'side-by-side',
    about: 'stage 2: the other breakpoints next to the frame, the selection outlined in each, a side frame clicked to edit there',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/responsive-title.json'] } },
      { door: 'view.toggleSideBySide#toolbar-breakpoints-side-by-side' },
      { expect: { message: 'Side by side: on.' } },
      { door: 'selection.select#layers-row', labelled: 'Title' },
      { photo: 'three-side-frames' },
      { click: `[data-door="view.setBreakpoint#side-by-side-frame"][data-args*='"phone"']` },
      { expect: { message: 'Editing the Phone breakpoint.' } },
      { photo: 'phone-edited' },
    ],
  },
  {
    name: 'smart-fields',
    about: 'stage 3: lengths of two units written as calc(), the wheel stepping a focused field, keywords typed and shown in Portuguese',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/responsive-title.json'] } },
      { door: 'selection.select#layers-row', labelled: 'Title' },
      { type: { at: '[data-door="style.set#inspector-width"] input', text: '100% - 20px' } },
      { photo: 'width-calc' },
      { click: '[data-door="style.set#inspector-font-size"] input' },
      { wheel: { at: '[data-door="style.set#inspector-font-size"] input', dy: -100 } },
      { wheel: { at: '[data-door="style.set#inspector-font-size"] input', dy: -100 } },
      { photo: 'font-size-wheeled' },
      { click: '[data-menu="view"]' },
      { click: 'button.menu__item:has-text("Language")' },
      { door: 'preferences.setLanguage#menu-language-pt-br' },
      { type: { at: '[data-door="style.set#inspector-width"] input', text: 'automático' } },
      { photo: 'width-automatico' },
    ],
  },
  {
    name: 'colour-variables',
    about: 'stage 3: the project variable brand used from the colour picker without typing var(, and the contrast with the background',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/brand-title.json'] } },
      { door: 'selection.select#layers-row', labelled: 'Title' },
      { click: `[data-door="colorPicker.open#field-color-swatch"][data-args*='"color"']` },
      { photo: 'picker-with-variables' },
      { click: '[data-door="style.set#color-picker-variable"]' },
      { photo: 'brand-used' },
      { door: 'colorPicker.apply#color-picker-apply' },
    ],
  },
  {
    name: 'font-menu',
    about: 'stage 3 / J15: the font menu on the body, never cut by the inspector, each family drawn in its own face',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/responsive-title.json'] } },
      { door: 'selection.select#layers-row', labelled: 'Title' },
      { click: '[data-door="style.set#inspector-font-family"] .field__values, [data-door="style.set#inspector-font-family"] button[aria-haspopup]' },
      { photo: 'font-menu-open' },
    ],
  },
  {
    name: 'value-presets',
    about: 'stage 3: a shadow chosen by its thumbnail',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/responsive-title.json'] } },
      { door: 'selection.select#layers-row', labelled: 'Title' },
      { click: `[data-door="inspector.toggleRow#inspector-row-disclosure"][data-args*='"box-shadow"']` },
      { photo: 'shadow-thumbnails' },
      { click: `[data-door="style.setShadows#inspector-shadow-preset"][data-args*='0.28']` },
      { photo: 'strong-shadow' },
    ],
  },
  {
    name: 'easing-curve',
    about: 'stage 3: an action easing chosen from ready-made curves drawn as curves, then a Bézier typed by its points',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/motion.json'] } },
      { door: 'selection.select#layers-row', labelled: 'Hero' },
      { door: 'workspace.setActiveTab#inspector-tab-interactions' },
      { door: 'motion.add#inspector-motion-add' },
      { door: 'workspace.setPanelOpen#status-bar-motion' },
      { click: '[data-door="motion.select#timeline-motion-bar"]' },
      { click: '[data-door="motion.updateAction#timeline-motion-action-easing"] .easing-curve__button' },
      { photo: 'ready-made-curves' },
      { click: '.easing-preset[title="ease-in-out"]' },
      { click: '[data-door="motion.updateAction#timeline-motion-action-easing"] .easing-curve__button' },
      { type: { at: '.easing-popover__point:nth-child(2) input', text: '1.6', enter: false } },
      { photo: 'own-curve' },
      { click: '.easing-popover__points button[type="submit"]' },
      { photo: 'own-curve-used' },
    ],
  },
  {
    name: 'data-c3',
    about: 'jornada03 C3/H13: the header shared with every page, its menu changed once',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/content-site.json'] } },
      { door: 'selection.select#layers-row', labelled: 'Header' },
      DATA_PANEL,
      { door: 'regions.share#data-share' },
      { expect: { message: 'Header is shared with 2 pages.' } },
      { door: 'selection.select#layers-row', labelled: 'About link' },
      { door: 'workspace.setActiveTab#inspector-tab-settings' },
      { type: { at: '[data-door="text.set#inspector-text"] textarea, [data-door="text.set#inspector-text"] input', text: 'Sobre' } },
      { expect: { message: 'Saved the text of About link.' } },
      { door: 'workspace.setPanelOpen#toolbar-activity-bar-explorer' },
      { door: 'pages.switch#explorer-page-row', labelled: 'About' },
      { photo: 'about-shows-the-change' },
    ],
  },
  {
    name: 'layout-01-header-sidebar-content',
    about: 'draw a header band and a body, cut a sidebar off it while the preview shows the cut, fix its width',
    steps: [
      ...HEADER_BODY,
      { stroke: { at: STAGE, points: [PX(400, 150), PX(400, 450), PX(400, 720)], hold: true } },
      { photo: 'cut-preview' },
      { release: true },
      { photo: 'header-sidebar-content' },
      { click: '[data-layout-region="r2"]' },
      { click: `[data-door="layout.configure#layout-width"][data-args='{"field":"width","value":"fixed"}']` },
      { photo: 'sidebar-fixed' },
      ...EXPORTED,
      { reload: true },
      { expect: { nodes: 4 } },
    ],
  },
  {
    name: 'layout-02-dashboard',
    about: 'place the dashboard template: the predictor names it, the page is a grid of real elements',
    steps: [...COMPOSE, { click: `[data-door="layout.template#layout-template"][data-args='{"template":"dashboard"}']` }, { photo: 'dashboard' }, { expect: { nodes: 8 } }, ...EXPORTED],
  },
  {
    name: 'layout-03-asymmetric',
    about: 'a pinwheel of five regions compiles to one grid with areas and no wrapper',
    steps: [
      ...COMPOSE,
      draw([40, 40], [936, 270]),
      draw([964, 40], [1400, 540]),
      draw([504, 568], [1400, 810]),
      draw([40, 298], [476, 810]),
      draw([504, 298], [936, 540]),
      { photo: 'pinwheel' },
      { expect: { nodes: 6 } },
      ...EXPORTED,
    ],
  },
  {
    name: 'layout-04-repeated-grid',
    about: 'two cards, the repeat handle dragged to four, the suggestion makes them a grid',
    steps: [
      ...COMPOSE,
      draw([40, 40], [290, 300]),
      draw([320, 40], [570, 300]),
      { stroke: { at: STAGE, from: '[data-layout-handle^="repeat:"]', points: [PX(700, 170), PX(1130, 170)] } },
      { photo: 'four-cards' },
      { expect: { nodes: 5 } },
      { door: 'layout.suggest#layout-suggest' },
      { photo: 'cards-as-a-grid' },
      ...EXPORTED,
    ],
  },
  {
    name: 'layout-05-nested',
    about: 'a region drawn inside another with the Draw tool becomes its child element',
    steps: [
      ...COMPOSE,
      draw([40, 40], [800, 600]),
      { click: `[data-door="layout.view#layout-tool"][data-args='{"tool":"draw"}']` },
      { stroke: { at: STAGE, points: [PX(100, 100), PX(400, 300)], hold: true } },
      { photo: 'nest-preview' },
      { release: true },
      { photo: 'nested' },
      { expect: { nodes: 3 } },
      ...EXPORTED,
    ],
  },
  {
    name: 'layout-06-multiple-split',
    about: 'one zigzag stroke across a region makes three columns in one undo step',
    steps: [
      ...COMPOSE,
      draw([40, 40], [1400, 600]),
      { stroke: { at: STAGE, points: [PX(500, 20), PX(500, 620), PX(950, 620), PX(950, 20)] } },
      { photo: 'three-columns' },
      { expect: { nodes: 4 } },
      { key: 'Control+z' },
      { photo: 'one-undo-back-to-one' },
      { expect: { nodes: 2 } },
    ],
  },
  {
    name: 'layout-07-multiple-merge',
    about: 'Shift sweeping across four regions merges them into one in one undo step',
    steps: [
      ...COMPOSE,
      draw([40, 40], [1400, 600]),
      { stroke: { at: STAGE, points: [PX(380, 20), PX(380, 620)] } },
      { stroke: { at: STAGE, points: [PX(720, 20), PX(720, 620)] } },
      { stroke: { at: STAGE, points: [PX(1060, 20), PX(1060, 620)] } },
      { photo: 'four-columns' },
      { stroke: { at: STAGE, points: [PX(200, 300), PX(500, 300), PX(900, 300), PX(1300, 300)], modifier: 'Shift', hold: true } },
      { photo: 'merge-preview' },
      { release: true },
      { photo: 'merged' },
      { expect: { nodes: 2 } },
      { key: 'Control+z' },
      { expect: { nodes: 5 } },
    ],
  },
  {
    name: 'layout-08-subtract',
    about: 'an Alt box inside a region cuts it out: the region becomes the bands around it',
    steps: [
      ...COMPOSE,
      draw([40, 40], [1400, 600]),
      draw([400, 200], [800, 400], 'Alt'),
      { photo: 'cut-out' },
      { expect: { nodes: 5 } },
      ...EXPORTED,
    ],
  },
  {
    name: 'layout-09-structural-resize',
    about: 'dragging the shared boundary moves both regions and the status bar says their sizes',
    steps: [
      ...HEADER_BODY,
      { stroke: { at: STAGE, points: [PX(600, 150), PX(600, 720)] } },
      { click: '[data-layout-region="r3"]' },
      { stroke: { at: STAGE, from: '[data-layout-handle^="boundary:"]', points: [PX(800, 435)], hold: true } },
      { photo: 'boundary-preview' },
      { release: true },
      { photo: 'resized' },
      { expect: { message: 'Resized:' } },
    ],
  },
  {
    name: 'layout-10-desktop-to-mobile',
    about: 'stack on a tablet and hide the header on a phone: media queries at 834 and 390 px',
    steps: [
      ...HEADER_BODY,
      { stroke: { at: STAGE, points: [PX(600, 150), PX(600, 720)] } },
      { door: 'view.setBreakpoint#toolbar-breakpoint-tabs-tablet' },
      { click: '[data-layout-region="r2"]' },
      { door: 'layout.respond#layout-stack' },
      { photo: 'tablet-stacked' },
      { door: 'view.setBreakpoint#toolbar-breakpoint-tabs-phone' },
      { wheel: { at: '[data-canvas-stage]', dy: -2000 } },
      { click: '[data-layout-region="r1"]' },
      { door: 'layout.respond#layout-hide' },
      { photo: 'phone-without-header' },
      { door: 'view.setBreakpoint#toolbar-breakpoint-tabs-desktop' },
      ...EXPORTED,
      { expect: { exportHas: ['max-width: 834px', 'max-width: 390px'] } },
    ],
  },
  {
    name: 'layout-11-real-content',
    about: 'compose a section that holds text: its elements become placed regions and none is ever lost',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/aurora.json'] } },
      { door: 'selection.select#layers-row', labelled: 'Hero' },
      { door: 'workspace.setPanelOpen#toolbar-activity-bar-layout-composer' },
      { door: 'layout.enter#layout-compose' },
      { photo: 'hero-content-placed' },
      { stroke: { at: STAGE, points: [[0.2, 0.3], [0.5, 0.5], [0.8, 0.7]], modifier: 'Shift' } },
      { photo: 'merge-of-content-refused' },
      { expect: { message: 'cannot be merged' } },
      { door: 'layout.leave#layout-done' },
      ...EXPORTED,
      { expect: { exportHas: ['<h1'] } },
    ],
  },
  {
    name: 'layout-12-reopen',
    about: 'leave, reload, compose again: the container reopens with the layout it keeps',
    steps: [
      ...HEADER_BODY,
      { stroke: { at: STAGE, points: [PX(600, 150), PX(600, 720)] } },
      { door: 'layout.leave#layout-done' },
      { photo: 'left' },
      { reload: true },
      { expect: { nodes: 4 } },
      { door: 'workspace.setPanelOpen#toolbar-activity-bar-layout-composer' },
      { door: 'layout.enter#layout-compose' },
      { photo: 'reopened-as-drawn' },
      { expect: { message: 'Composing the layout of Page' } },
    ],
  },
  {
    name: 'layout-composer-tools',
    about: 'trace a wireframe image into regions, relate them with a rule, remove it, and place a template',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/layout-wireframe.json'] } },
      { door: 'workspace.setPanelOpen#toolbar-activity-bar-layout-composer' },
      { door: 'layout.enter#layout-compose' },
      { click: `[data-door="layout.reference#layout-reference"][data-args='{"file":"img/wireframe.png"}']` },
      { photo: 'reference-under-the-stage' },
      { door: 'layout.trace#layout-trace' },
      { wait: 400 },
      { photo: 'traced-regions' },
      { click: `[data-door="layout.view#layout-tool"][data-args='{"tool":"relate"}']` },
      { stroke: { at: '[data-layout-stage]', points: [[0.2, 0.6], [0.5, 0.6], [0.8, 0.6]] } },
      { photo: 'rule-painted' },
      { door: 'layout.unrelate#layout-unrelate' },
      { photo: 'rule-removed' },
      { door: 'layout.reference#layout-reference-clear' },
      { key: 'Control+z' },
      { key: 'Control+z' },
      { key: 'Control+z' },
      { photo: 'back-to-the-reference' },
    ],
  },
  {
    name: 'layout-composer-template',
    about: 'place the dashboard template on an empty page and check the widths',
    steps: [
      { door: 'workspace.setPanelOpen#toolbar-activity-bar-layout-composer' },
      { door: 'layout.enter#layout-compose' },
      { click: `[data-door="layout.template#layout-template"][data-args='{"template":"dashboard"}']` },
      { photo: 'dashboard-placed' },
      { door: 'view.setBreakpoint#toolbar-breakpoint-tabs-phone' },
      { door: 'layout.respond#layout-stack' },
      { photo: 'dashboard-on-a-phone' },
    ],
  },
  {
    name: 'layout-composer-properties',
    about: 'set what regions mean and how they size, then say what changes on a tablet and a phone',
    steps: [
      { door: 'workspace.setPanelOpen#toolbar-activity-bar-layout-composer' },
      { door: 'layout.enter#layout-compose' },
      { stroke: { at: '[data-layout-stage]', points: [[0.04, 0.03], [0.96, 0.12]] } },
      { stroke: { at: '[data-layout-stage]', points: [[0.04, 0.16], [0.96, 0.6]] } },
      { stroke: { at: '[data-layout-stage]', points: [[0.3, 0.13], [0.3, 0.63]] } },
      { photo: 'three-regions' },
      { click: `[data-door="layout.configure#layout-semantic"][data-args='{"field":"semantic","value":"main"}']` },
      { click: `[data-door="layout.configure#layout-width"][data-args='{"field":"width","value":"fill-available"}']` },
      { type: { at: '[data-door="layout.configure#layout-padding"] input', text: '24' } },
      { photo: 'main-region-configured' },
      { click: '[data-layout-region="r2"]' },
      { click: `[data-door="layout.configure#layout-semantic"][data-args='{"field":"semantic","value":"aside"}']` },
      { photo: 'aside-region' },
      { door: 'view.setBreakpoint#toolbar-breakpoint-tabs-tablet' },
      { photo: 'tablet-as-drawn' },
      { click: '[data-layout-region="r2"]' },
      { door: 'layout.respond#layout-stack' },
      { photo: 'tablet-stacked' },
      { door: 'view.setBreakpoint#toolbar-breakpoint-tabs-phone' },
      { wheel: { at: '[data-canvas-stage]', dy: -2000 } },
      { click: '[data-layout-region="r1"]' },
      { door: 'layout.respond#layout-hide' },
      { photo: 'phone-header-hidden' },
      { door: 'view.setBreakpoint#toolbar-breakpoint-tabs-desktop' },
      { photo: 'desktop-unchanged' },
    ],
  },
  {
    name: 'layout-composer',
    about: 'compose the page by drawing: regions drawn, cut and merged become ordinary elements, one undo step each',
    steps: [
      { door: 'workspace.setPanelOpen#toolbar-activity-bar-layout-composer' },
      { photo: 'panel-idle' },
      { door: 'layout.enter#layout-compose' },
      { photo: 'composing-the-page' },
      { stroke: { at: '[data-layout-stage]', points: [[0.04, 0.03], [0.5, 0.08], [0.96, 0.12]] } },
      { photo: 'header-drawn' },
      { stroke: { at: '[data-layout-stage]', points: [[0.04, 0.16], [0.5, 0.4], [0.96, 0.6]] } },
      { photo: 'body-drawn' },
      { stroke: { at: '[data-layout-stage]', points: [[0.3, 0.13], [0.3, 0.4], [0.3, 0.63]] } },
      { photo: 'body-cut-in-two' },
      { stroke: { at: '[data-layout-stage]', points: [[0.15, 0.4], [0.5, 0.4], [0.8, 0.4]], modifier: 'Shift' } },
      { photo: 'merged-back' },
      { key: 'Control+z' },
      { photo: 'undo-brings-the-cut-back' },
      { click: '[data-layout-region]' },
      { photo: 'region-selected' },
      { door: 'layout.view#layout-lens' },
      { door: 'layout.leave#layout-done' },
      { photo: 'done' },
    ],
  },
  {
    name: 'assistant',
    about: 'open the assistant and inspect its model, local key and Companion setup',
    steps: [
      { door: 'workspace.setPanelOpen#toolbar-activity-bar-assistant' },
      { photo: 'assistant-conversation' },
      { door: 'assistant.setPreferences#assistant-preferences' },
      { photo: 'assistant-preferences' },
      { type: { at: '[data-door="assistant.setModel#assistant-model"] input', text: 'claude-opus-5-5' } },
      { door: 'assistant.setPreferences#assistant-close-preferences' },
      { photo: 'assistant-ready-for-setup' },
    ],
  },
  {
    name: 'forms-submission',
    about: 'configure a service destination without altering the native action implicitly',
    steps: [
      INSERT_PANEL,
      { click: `[data-door="element.insert#elements-tile"][data-args='{"entry":"form"}']` },
      { door: 'workspace.setActiveTab#inspector-tab-settings' },
      { click: '[data-door="element.setAttribute#forms-submission-destination"] input' },
      { photo: 'native-submission' },
      { type: { at: '[data-door="element.setAttribute#forms-submission-endpoint"] input', text: 'https://example.com/forms' } },
      { type: { at: '[data-door="element.setAttribute#forms-submission-destination"] input', text: 'webhook' } },
      { type: { at: '[data-door="element.setAttribute#forms-submission-method"] input', text: 'POST' } },
      { type: { at: '[data-door="element.setAttribute#forms-submission-encoding"] input', text: 'json' } },
      { type: { at: '[data-door="element.setAttribute#forms-submission-honeypot"] input', text: 'website' } },
      { photo: 'configured-service' },
    ],
  },
  {
    name: 'forms-mask',
    about: 'configure a field mask and trial a valid and invalid value',
    steps: [
      INSERT_PANEL,
      { door: 'element.insert#elements-tile', labelled: 'Text' },
      { door: 'workspace.setActiveTab#inspector-tab-settings' },
      { click: '[data-door="element.setAttribute#forms-mask-kind"] input' },
      { photo: 'field-without-mask' },
      { type: { at: '[data-door="element.setAttribute#forms-mask-kind"] input', text: 'Preset' } },
      { type: { at: '[data-door="element.setAttribute#forms-preview-input"] input', text: '52998224725' } },
      { click: '[data-region="forms-settings"] output' },
      { photo: 'cpf-valid' },
      { type: { at: '[data-door="element.setAttribute#forms-preview-input"] input', text: '52998224726' } },
      { click: '[data-region="forms-settings"] output' },
      { photo: 'cpf-invalid' },
    ],
  },
  {
    name: 'lean-field',
    about: 'a value keeps its whole cell while its field holds the focus: Reset stands at the row end or, in a pair, at the label end (J6)',
    steps: [
      INSERT_PANEL,
      CONTAINER_TILE,
      HEADING_TILE,
      STYLE_TAB,
      { type: { at: '[data-door="style.set#inspector-font-size"] input', text: '48px' } },
      { type: { at: '[data-door="style.set#inspector-color"] input', text: '#204060' } },
      { click: '[data-door="style.set#inspector-font-size"] input' },
      { photo: 'pair-focused-reset-at-label-end' },
      { click: '[data-door="style.set#inspector-color"] input' },
      { photo: 'single-focused-reset-at-row-end' },
    ],
  },
  {
    name: 'bare-radius',
    about: 'a radius accepts the same bare lengths and arithmetic as other length fields',
    steps: [
      INSERT_PANEL,
      CONTAINER_TILE,
      { click: '[data-section="border"] .inspector-section__header' },
      { type: { at: '[data-door="style.setRadius#inspector-border-radius-radius-editor"] input', text: '12' } },
      { photo: 'bare-radius-result' },
    ],
  },
  {
    name: 'viewport-width',
    about: 'continuous widths follow the responsive cascade and return to a reference tab',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/aurora.json'] } },
      { photo: 'reference-width' },
      { type: { at: '[data-door="view.setViewportWidth#viewport-width"] input[inputmode="numeric"]', text: '1024' } },
      { expect: { message: 'Viewport: 1024 px; editing Laptop styles.' } },
      { photo: 'intermediate-laptop' },
      { type: { at: '[data-door="view.setViewportWidth#viewport-width"] input[inputmode="numeric"]', text: '600' } },
      { photo: 'intermediate-tablet' },
      { door: 'view.setBreakpoint#toolbar-breakpoint-tabs-desktop' },
      { photo: 'reference-restored' },
    ],
  },
  {
    name: 'large-page',
    about: 'the unchanged 641-node study page opens and draws every element',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['jornada03/00-frame/targets/probe-large.json'] } },
      { expect: { nodes: 641 } },
      { photo: 'large-page-ready' },
    ],
  },
  {
    name: 'import-folder',
    about: 'a folder contributes two pages with its images and stylesheet while preserving the client pages',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/client-site.json'] } },
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.importHtml#menu-file-folder"]', paths: ['manifest/features/fixtures/folders/legacy'] } },
      { photo: 'folder-pages-ready' },
      { click: '[data-door="project.importHtml#destination-page"]' },
      { photo: 'four-pages-and-coffee-image' },
    ],
  },
  {
    name: 'import-pages',
    about: 'importing a legacy page alongside two existing client pages',
    steps: [
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.open#menu-file"]', paths: ['manifest/features/fixtures/client-site.json'] } },
      { photo: 'two-client-pages' },
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.importHtml#menu-file"]', paths: ['manifest/features/fixtures/import/legacy.html'] } },
      { photo: 'import-destination' },
      { click: '[data-door="project.importHtml#destination-page"]' },
      { photo: 'after-import' },
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.importHtml#menu-file"]', paths: ['manifest/features/fixtures/import/legacy.html'] } },
      { click: '[data-door="project.importHtml#destination-inside"]' },
      { photo: 'inside-current-page' },
      { click: '[data-menu="file"]' },
      { files: { at: '[data-door="project.importHtml#menu-file"]', paths: ['manifest/features/fixtures/import/legacy.html'] } },
      { click: '[data-door="project.importHtml#destination-replace"]' },
      { photo: 'replace-confirmation' },
      { click: '[data-confirmation="confirm"]' },
      { photo: 'project-replaced-after-confirmation' },
    ],
  },
  {
    name: 'font-menu-draft',
    about: 'the font list opens without confirming unfinished typing, then Escape returns to that draft',
    steps: [
      INSERT_PANEL, HEADING_TILE,
      { type: { at: '[data-door="style.set#inspector-font-family"] input', text: 'Ge', enter: false } },
      { click: '[data-door="style.set#inspector-font-family"] button[aria-haspopup="menu"]' },
      { photo: 'font-list-with-unfinished-word' },
      { key: 'Escape' }, { photo: 'unfinished-word-after-escape' },
    ],
  },
  {
    name: 'draft-recovery',
    about: 'unconfirmed canvas text and a field return after reload, still ready for editing',
    steps: [
      INSERT_PANEL, HEADING_TILE,
      { key: 'Escape' }, { key: 'Enter' }, { text: ' Especial' },
      { photo: 'canvas-draft' }, { reload: true }, { photo: 'canvas-draft-restored' },
      { text: '!' }, { key: 'Enter' },
      { door: 'workspace.setActiveTab#inspector-tab-settings' },
      { type: { at: '[data-door="element.setId#inspector-id"] input', text: 'draft-heading', enter: false } },
      { photo: 'field-draft' }, { reload: true }, { photo: 'field-draft-restored' },
      { key: 'Enter' }, { photo: 'draft-confirmed' },
    ],
  },
  {
    name: 'outside-picker',
    about: 'an outside click types into Alt immediately and active activity icons keep their panel open',
    steps: [
      INSERT_PANEL,
      { door: 'element.insert#elements-tile', labelled: 'Image' },
      { door: 'workspace.setActiveTab#inspector-tab-settings' },
      { door: 'assetPicker.open#field-source-choose' },
      { photo: 'picker-open' },
      { click: '[data-door="element.setAttribute#inspector-alt"] input' },
      { text: 'Grãos de café' },
      { key: 'Enter' },
      { photo: 'alt-kept-after-one-click' },
      INSERT_PANEL,
      INSERT_PANEL,
      { photo: 'insert-still-open' },
      { click: '[data-menu="file"]' },
      { door: 'workspace.setActiveTab#inspector-tab-style' },
      { photo: 'style-tab-open-after-menu' },
    ],
  },
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
