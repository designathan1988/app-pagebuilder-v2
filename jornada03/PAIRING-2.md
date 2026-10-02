# Pairing 2 — the app against the canonical design (stage 5)

The plan's stage 5 closes on this record: every surface compared with `design/final/index.html`, what differed, and
what was done. It is a **manual** comparison: the automated pairing tool of stage 0.4 (12 states × theme × language,
numeric diff per control) was deferred by the user's speed order and was not built, so this record covers the states
photographed during the stage (light and dark from the visual baselines, English; the Portuguese texts were checked in
the i18n tests and the pt-BR scenarios). Photos: `.cache/logs/ui-*` per row; canonical shots taken from the static
server of `design/final` (`.claude/launch.json` design-static).

Open divergences: **none**. Kept on purpose: four, each with its reason.

## Compared and fixed

| Surface | Divergence found | Commit (QA-LOG) |
|---|---|---|
| Top bar | No save state left of Preview | efda375 (106) |
| Activity bar | Matches (plain-name tooltips, the active icon keeps its panel open: J8b) | — |
| Explorer | A long page's file name ran over its name; a file's badge shrank under its name | 5e69781 (108) |
| Layers | Colour dot, collapse-all, Shift range, instance badge, F6 stop | c985a51, 2065c78, 4241fbe, dd3100a (85, 84, 90, 95) |
| Insert | Search by accents, synonyms and relevance; one Tab stop per group | c0805d3, 6f3e333 (86, 105) |
| Styles | Colour swatches; a new variable takes the focus | e6302a8, 4b347b0 (92, 107) |
| Floating windows | No way back but a drag: Put back in its place | 27644a1 (97) |
| Inspector · Style | The Alignment row's label under its disclosure | 48d1c68 (100) |
| Inspector · Interactions | Two contradicting notes, two systems unlabelled, a motion card unlike the canonical card | 346543d (99) |
| Quick panel | 216 px, Paint one column, cut name, Reset under its value, over the handles | a1394fd (98) |
| Command bar | Pages, layers, classes; a panel opened from it takes the focus | e146bf1, 8db5ee7 (88, 104) |
| Canvas overlays | Breakpoint band; labels never steal a press; size chip clear of the label; 16:9 image marker | e36bc45, c1e4972, 1223dbb (89, 101, 102) |
| Bottom dock | No strip when closed (A3.18) | c8d2f81 (96) |
| Keyboard | F6 Layers stop, arrows start at the page, region keys, focus into opened panels | dd3100a, b4860d8, 8db5ee7, 6f3e333 (95, 103, 104, 105) |
| 1280 × 720 | The canvas bars ran past the centre | 9d09b5d (91) |
| Language and texts | Browser language, gender-neutral Portuguese | 60f885c, c11a2d2 (87, 93) |
| Image picker | Paths only, no thumbnails or search | 5cd620f (94) |

## Kept on purpose

1. **A single field's row keeps a 24 px Reset column** (Style inspector), where the canonical runs values to the panel's
   edge. Decision jornada02 A.0 / J6: focusing a field never squeezes its value when its Reset appears.
2. **Page tabs carry no ×** (file tabs), where the canonical draws one on every tab. Every page of the project has its
   tab — they are the project's pages, not files opened — so closing one would mean nothing; a code file's tab has its ×
   as in the canonical.
3. **The quick panel's bar is two lines** (grip, name, close; then the tag and the actions), where the canonical's is
   one. The app's bar holds more than the canonical's (the grip, Edit on canvas, the close button): on one line in
   196 px the element's name had a few pixels.
4. **Events and Motion are two lists in the Interactions tab**, where the canonical shows one list of cards. The two
   models (events-actions and the stage 10 motion) are drawn with the same card; merging them is a migration of saved
   projects, which the user put out of scope with stage 16.
