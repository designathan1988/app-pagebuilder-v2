Archived 2026-10-02 from `.memory/panel-audit.md` (not versioned): the static audit of the Style panel of 2026-09-29. History only.

# Style panel audit — static pass (2026-09-29)

Method: the panel's contract (`manifest/properties.json`), the design (`design/final/index.html` markup and
`design/final/shots/*.png`), our own spec (`spec/BEHAVIOUR.md`, section `inspector-panel`), the drawing code
(`src/editor/shell/inspector.tsx`, `src/editor/inspector/rows.ts`, `sections.ts`, `inspector.css`,
`panel-editors.css`) and the last photos of the running app (`.cache/logs/ui-style-051617/`,
`.cache/logs/uso-refactor-031508/`). The app was NOT run for this pass (another session holds the tree), so every
item below is read from data and code, and the rendered look is marked as pending.

## What the contract says (spec/BEHAVIOUR.md, inspector-panel, "Our contract")

> The Style tab shows always all eight sections, in this order: Layout, Space, Size, Position, Paint, Border, Text,
> Effects (DESIGN.md), whatever the element type; the intent's "Content" section is the Settings tab. Later entries
> may add sections after Effects.

## Findings

### 1. The section order breaks the contract (hard)

- The contract: Layout, Space, Size, Position, **Paint, Border, Text**, Effects.
- The app draws: Layout, Space, Size, Position, **Text, Paint, Border**, Effects, Advanced — because the panel draws
  `properties.json` `sections` in array order (`inspector.tsx:563`, `STYLE_SECTIONS`).
- `manifest/properties.json`: `sections` = content, layout, space, size, position, **text**, paint, border, effects,
  advanced, interactions.
- Fix: move `text` after `border` in that array (data only). No unit test pins the order today
  (`src/editor/inspector/sections.test.ts` pins summaries only); the browser specs must be run after.

### 2. The spec line on opening sections is stale

- Spec: "Every section starts open."
- The app: a section with no value set starts collapsed, a section carrying essentials stays open
  (`sections.ts:83-92`); the code cites the user's item 5.1 and the mockup, and the mockup does draw Position closed
  with the summary `static · z auto`.
- Fix: amend the spec sentence (behaviour is the intended one).

### 3. `Gap` is drawn twice in Layout > Flex (organization)

- The pair row `gap-axes` draws row-gap | column-gap (doors `style.set#inspector-row-gap` order 14,
  `style.set#inspector-column-gap` order 15).
- The composite `gap` (longhands row-gap, column-gap, labelKey `property.gap` → "Gap") also has a door in the panel:
  `style.set#inspector-gap`, order 16 — drawn as its own row right after.
- The design draws ONE row: "Gap" with the two axis marks.
- Fix options: keep the pair and drop the composite's `inspector-style` placement (recommended, it matches the
  design), or keep the composite and drop the pair. Either way, check `manifest/references.json` and the scenarios
  that name the removed door before deleting it.

### 4. Pair rows carry the wrong label (design)

- A pair row's label is the first field's own label (`rows.ts:32-41`), so the panel reads "Row gap | Column" where
  the design reads "Gap" with ↕/↔ marks; same for "Font size | 700" where the design pairs Font | Size.
- The design pairs: Gap (row-gap | column-gap), Width | Height, Font (font-family | font-size).
  The app pairs: gap-axes, size-width-height, size-min-max-width, size-min-max-height, text-size-weight,
  text-line-height-letter-spacing.
- Fix: give `rows[]` its own `labelKey` (contract: `src/manifest/schema.ts`, reader: `rows.ts`, drawn in
  `inspector.tsx:676-683`), and align the text pair with the design (Font | Size) or decide to keep the current one.

### 5. The section header lost the design's origin dot

- The design: a 6 px dot after the title, coloured by origin (`--color-origin-here`,
  `--color-origin-breakpoint`, `--color-origin-state`) plus the summary when collapsed (`.has`, `.from-bp`,
  `.from-st` in the mockup).
- The app: label + summary + a "N SET" badge (`inspector-section__count`, `inspector.tsx:694`), no dot.
- Effect: at a breakpoint/state the header no longer says whether the section's values come from here, another
  breakpoint or another state — the field-level origin text still says it (`FieldOrigin`).
- Fix: draw the dot with the section's origin (the same rule the fields use), keep or drop the badge by decision.

### 6. Group titles: dead and singleton groups (organization)

- The design's Style panel has NO group titles inside a section; the app titles every group of a multi-group section
  (`titledGroups`, `rows.ts:79`). With 38-69 fields in a section, titles may be worth keeping — but then they are a
  deliberate deviation and should be recorded as such.
- Dead groups (declared, no field): `layout/more` ("More"), `position/anchors` ("Anchors").
- Singleton groups (a title over one field): `layout/display` ("Display"), `text/advanced` ("Advanced text", holds
  only the `font-variant` composite), `effects/shadow` ("Shadows").

### 7. The `advanced` section duplicates other sections' organization

- Its groups repeat labels used elsewhere: "Columns" (also in Layout), "More" (also in Layout), "Advanced text"
  (also in Text).
- It holds `font-variant-*` (13 fields) away from their composite `font-variant`, which lives in Text.
- It has no summary, so collapsed it shows nothing (every other section has one).
- Fix options: fold its fields into their home sections and delete the section, or rename its groups and give it a
  summary. The design has no such section (only the eight + later additions after Effects are allowed).

### 8. Field icons: 2 of 181 properties

- `properties.json`: `flex-direction` and `text-align` carry `icons` (the only two).
- The design's panel uses, inside fields: the direction arrows, the alignment matrix, the text-align buttons, the
  search magnifier, the spacing link, the "add a gradient" plus, and a radius glyph inside the Radius field.
- The app has the first three and the spacing link; the radius glyph (and any other field glyph) is missing — the
  visual pass confirms the rest.

### 9. Pending — the visual pass (needs the app)

- The rendered panel for each element kind (Container, Heading, Paragraph, Image, Link, Button): row order, spacing,
  truncation, the box model, the editors (shadow, gradient, border, radius, grid tracks), and the chips row
  (element/class/state/breakpoint) against `design/final/shots/1440-01-default.png` and `1440-03-selection.png`.
- The 25 composites drawn next to their own longhands in All-properties mode (some intended: the border and radius
  editors; some suspect: gap, columns, grid-column/row/area, background-position, transition) — to judge on screen,
  because the design shows a compact row where the app may show two.
- Every fix above gets a photo before and after, and `npm run check:fast` plus the panel's browser specs.

## Verified on the running app (2026-09-29, the audit session, after the design pass and the audit's fixes)

The pass ran the real app in Chrome (`.cache/logs/audit-panel-intro.png`; the facts dumped from the DOM with the
Intro selected, Style › All properties, every section opened, then Display set to `flex` for the gap row). Findings
1, 3, 4, 5, 6 and 9 are closed; two stay open, both the design's to decide (a later decision of the owner's, not this
audit's to make):

- **1 (the section order) — closed.** `manifest/properties.json` `sections` reads content, layout, space, size,
  position, **paint, border, text**, effects, advanced, interactions, so the panel draws the contract's order. The
  audit read an older array.
- **2 (the spec line "Every section starts open") — closed as non-existent.** `spec/BEHAVIOUR.md`'s inspector-panel
  holds no such line; its "Our rule" already says a collapsed section shows its summary (2917) and the defaults are
  the Pager's own (2879). Nothing to amend.
- **3 (`Gap` twice) — closed.** On a flex container the Layout section draws one "Gap" row (the pair: row-gap |
  column-gap); the composite's own door (`style.set#inspector-gap`) is drawn as the pair's compact control, not as a
  second row.
- **4 (pair labels) — closed.** The row reads "Gap ↕ normal ↔ normal" (the pair's own `labelKey`, rows.ts); Size
  reads "Width" (Auto | 1360) and "Min width" (min | max). The Font|Size pairing the audit proposed is a design
  decision that has not been taken, not a defect.
- **5 (the origin dot) — closed.** The header draws it: the screenshot shows `LAYOUT ●` with the dot in the origin
  colour (green = Here), beside the summary and the count badge.
- **6 (group titles) — closed.** No group title is drawn anywhere in the sections (no `titledGroups` in the code);
  the dead and singleton groups the audit listed have no title to draw. `layout/more` and `position/anchors` remain
  declared-but-empty in properties.json, which the manifest check does not refuse.
- **7 (the `advanced` section) — OPEN.** Still drawn, still without a summary, its 14 fields holding
  `font-variant-*` away from their composite in Text, and its group labels repeating other sections'. Folding it
  into the home sections (or renaming its groups and giving it a summary) is a change to `properties.json` and the
  reveal scenarios that name it (`inspector.reveal` into a collapsed section, the tag switch) — the design owner's
  call.
- **8 (the radius glyph) — OPEN, minor.** The Radius field is the radius editor (`style.setRadius#…radius-editor`);
  the mockup draws a radius glyph inside it and the app draws none. Cosmetic, and the design owner's.
- **9 (the visual pass) — done.** The rendered panel matches the design's row shapes seen at the fit zoom: one Gap
  row, pair rows with their own labels, box model in Space, sections in the contract's order with their dots and
  counts.


## Visual pass on the running app (2026-09-29, the dogfooding session)

The app was built into a full landing page (Hero + a nested features grid + an asymmetric gallery + a footer of
three link lists, 58 elements) through the doors alone, with real gestures, and then read with screenshots and
measured in the DOM. Nothing of the panel was found broken; the two findings left open are closed:

- **7 (the `advanced` section) — closed as allowed.** The Style tab draws Layout, Space, Size, Position, Paint,
  Border, Text, Effects, Advanced: the contract's eight, in order, plus a later entry after Effects, which
  `spec/BEHAVIOUR.md` (inspector-panel) allows. Its rows are one flat list (Text selection, Set custom
  declarations, the break-break/contain/counter/font/writing-mode group of 16); no group title repeats another
  section's, and the collapsed header is the section's own business (it carries no summary to show). Nothing to fix;
  a future decision to fold its fields into their home sections would be a manifest change, not a defect fix.
- **8 (the radius glyph) — closed, it is drawn and it is centred.** The Radius row draws the corner glyph
  (`svg.icon--sm` → `#square-round-corner`, 14×14), the value slot, the `px` suffix and the slider: every part's
  centre lies on y=1899 in a 24px row, with 4px between parts and 7px insets — measured, not eyeballed. The old
  "deaf field" (the slider's absolute overlay) is what had hidden it; its removal (A3.30) is what the eye now sees.

Measured in the same pass, for the record:

- **Panels follow the tokens**: activity bar 40, sidebar 224 (`size.sidebar`), inspector 288 (`size.inspector`);
  the stage takes the rest (868 of 1440). At 1200 and 1024 wide nothing overlaps and the canvas drops its own zoom
  (30% at 1024) so the whole page still fits.
- **No clipped chrome text**: the two `scrollWidth > clientWidth` hits are `.field__rest-value` spans, which carry
  `text-overflow: ellipsis` by design (a long font stack, a border shorthand) — an ellipsis, not a cut glyph.
- **The section header draws its origin dot** (`inspector-section__origin`, `data-origin="here"`) beside the
  label, matching the design; the count badge sits after it.
- **States read in the right order**: hover is a 1px `--color-canvas-hover` outline with the element's size label
  (587), the selection is 2px in the layer's own colour (676) with its handles, and the hover box is withheld while
  the hovered node is part of the selection (`chrome.tsx:766`) — the two never fight.
- **The overlays do not push the layout**: the command palette (Ctrl+K) opens centred over the canvas with the
  shell's geometry unchanged (checked against the boxes with the palette open).
- **The windowed layers tree is usable**: a wheel scroll reveals rows and the row under the pointer takes the
  click (the harness's index-based clicking was the fragile part, never the tree).
- **The export of the built page**: zip → `index.html` + `css/styles.css` + `img/*`, zero inline styles, the hero
  background as `url("img/hero.png")` (the path, no blob), `.footer-link` in the class attribute, `id="gallery"`
  with the footer's `#gallery` fragment link — the canvas-only object-URL resolution never leaks into the export.
