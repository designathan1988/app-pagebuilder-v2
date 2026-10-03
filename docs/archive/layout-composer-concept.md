Archived 2026-10-02: translated from Portuguese (`.memory/layout-composer-spec.md`, not versioned until now). This is
the **original concept** of the Layout tool, the user's conversation with another assistant pasted on 2026-10-01. It is
superseded wherever it conflicts with `spec/BEHAVIOUR.md#layout-composer` and the manifest
(`manifest/features/23-layout-composer.json`, `manifest/commands/layout-composer.json`): on 2026-10-02 the user
rejected the several tools, lenses and modes ("one tool is enough") and chose one key per gesture (`docs/PRODUCT.md`
DEC-16, DEC-17). Nothing below is a requirement unless the register in `docs/PRODUCT.md` (STG-11.*) says so.

# Layout Composer — the user's full source (pasted 2026-10-01 18:01, verbatim, translated)

This is the complete material behind plan stage 11. The plan only summarises it; build from this text.

ANOTHER THING, CHECK THE FEASIBILITY OF IMPLEMENTING THIS FEATURE, SINCE THERE WERE COMPLAINTS ABOUT THE LAYOUT:

Loading older messages…
ok, and it is precisely in the layout that this is defined, right? the rest of the application does not need to
foresee it, right?
Almost. Composition intelligence must be concentrated in the Layout system, but the rest of the application needs to
be prepared to consume its result.
The Layout must be the only one responsible for deciding things like:

* regions;
* split/merge;
* grid/flex;
* spatial hierarchy;
* constraints;
* gaps;
* sizing;
* structural responsiveness;
* relationships between areas;
* converting the geometry into real structure;
* generating the layout tree.

The rest of the Pagebuilder should not try to "guess the layout" again.
The correct division would be:
Layout Composer → generates structure → the normal Pagebuilder uses that structure
For example, you draw:
`┌───────┬─────────────┐`
`│       │             │`
`│ SIDE  │   CONTENT   │`
`│       │             │`
`└───────┴─────────────┘`
The Layout Composer can turn that into something equivalent to:
`Page`
`└─ Grid`
`   ├─ Sidebar`
`   └─ Content`
with properties:
`columns: 280px 1fr`
`gap: 24px`
`responsive:`
`  mobile: stack`
From there on, the rest of the application only needs to know how to work with those elements normally.
So there should not be logic scattered like this:
`canvas decides layout`
`drag-drop decides layout`
`properties decide layout`
`responsive decides layout`
`renderer decides layout`
That would be a disaster because you would create multiple sources of truth.
The ideal is:
`                Layout Engine`
`                     │`
`             Layout Model`
`                     │`
`        ┌────────────┼─────────────┐`
`        ↓            ↓             ↓`
`     Canvas       Renderer      Inspector`
`        ↓            ↓             ↓`
`   interaction     display       editing`
These parts see the layout, but they do not invent a different interpretation of it.
There is, however, an important distinction: the rest of the application needs to offer infrastructure for the Layout
to work.
For example:

* the document model needs to support containers/regions;
* undo/redo needs to record split and merge;
* serialization needs to save the layout;
* the renderer needs to render Grid/Flex correctly;
* the inspector needs to allow editing the generated properties;
* drag-and-drop needs to accept components inside the regions;
* breakpoints need to be able to store variations;
* selection needs to recognise regions;
* copy/paste and duplicate need to preserve relationships;
* export needs to convert it into HTML/CSS/JS.

But these parts do not need to know how to infer the layout.
Think of a kind of compiler:
`DRAWING`
`   ↓`
`Layout Engine`
`   ↓`
`Layout Model`
`   ↓`
`normal Pagebuilder structure`
`   ↓`
`render / edit / export`
I would even avoid having the Layout Composer generate HTML directly while the user works.
Better:
`gesture`
`↓`
`layout topology`
`↓`
`layout model`
`↓`
`document model`
`↓`
`HTML/CSS at export/rendering`
That way your project does not end up with two systems:
the normal pagebuilder
and
the layout pagebuilder
Both use the same document.
The architectural rule I would give Claude would be:
Layout intelligence has one owner.
The Layout Engine is the only owner of the spatial interpretation.
Everything else only reads, presents, modifies through valid commands and persists the result.
This is especially important in your project because, if Claude spreads split, snap, grid, constraint and
responsiveness logic across several modules, afterwards any change will break something else.
So: yes, the definition is born in the Layout; no, the rest of the application should not try to anticipate it. But it
needs clear contracts to receive and manipulate the result.
look. what I am saying is this: the layout tool must let him create freely and it will make the correct translation
itself. outside the layout tool, the page will follow the normal flow
Exactly. Now it is precise.
The Layout tool is a temporarily free composition environment. Inside it, you are not subject to the document's normal
flow. You draw spatially as you like.
Inside Layout mode:
free draw → free move → resize → cut → split → merge → shapes → snap → grid → guides → constraints
You could make something completely free:
`┌──────────┬────────────────────┐`
`│          │                    │`
`│          │        A           │`
`│    B     ├────────────┬───────┤`
`│          │     C      │   D   │`
`│          ├────────────┴───────┤`
`│          │         E          │`
`└──────────┴────────────────────┘`
During that construction, it does not matter whether it does not yet correspond directly to a div, Grid or Flexbox.
When the layout is applied/finalised:
`FREE GEOMETRY`
`      ↓`
`interpretation`
`      ↓`
`spatial relationships`
`      ↓`
`hierarchy`
`      ↓`
`constraints`
`      ↓`
`Grid / Flex / containers`
`      ↓`
`normal Pagebuilder structure`
That is where the geometric freedom ends.
Outside the Layout tool, the page goes back to working exactly according to the normal flow of the web and of your
Pagebuilder.
That is:
`LAYOUT MODE`
`free / spatial / graphic`
`        ↓`
`       APPLY`
`        ↓`
`NORMAL PAGEBUILDER`
`flow / grid / flex / containers`
This also means that you do not need to turn the whole Pagebuilder into a freeform editor. On the contrary, that would
be a mistake.
A text inserted later still obeys its container. An image still takes part in the flow. A button is still placed
normally. Drag-and-drop still obeys the structure. Changing content does not depend on absolute coordinates.
The Layout tool only answers:
"What is the spatial architecture of this part of the page?"
After it has answered, the rest of the application works on top of that architecture normally.
And that solves a very important point: if you make a three-column layout and then put a lot of text into the second
column, the page is still normal web. The column grows, the content flows, Grid/Flex responds, responsiveness keeps
working. It is not stuck to the original drawing as it would be in an editor based on coordinates.
So the rule I would put explicitly in the prompt is:
Freeform is an authoring mechanism, not the runtime layout model.
Or in Portuguese (translated):
Spatial freedom exists only during the authoring of the layout. The result must be compiled into a normal, responsive,
flow-based web structure.
This is, in fact, the right architecture for what you are imagining.
Write the complete specification of the layout tool.
The specification below is already written as a technical document for you to hand to Claude Code.
Visual Layout Tool
1. Objective
Create in the Pagebuilder a visual tool for the structural composition of pages that lets the user draw layouts freely
on the canvas and automatically convert that composition into a real, clean, responsive and editable web structure.
The tool must work as a combination of:

* a Shape Builder applied to layout;
* a wireframe editor;
* a geometric editor;
* a Grid system;
* a constraints system;
* a visual compiler to HTML/CSS.

The user should not need to think in advance about `div`, `grid`, `flex`, `row`, `column`, wrappers or the DOM
hierarchy.
They must build the spatial intent visually.
The tool interprets that intent and generates the correct structure.
2. Central principle
Spatial freedom exists only inside the Layout tool.
Outside it, the page keeps working normally according to the traditional flow of the Pagebuilder and the web.
Flow:

```text
LAYOUT MODE
freeform spatial authoring
        ↓
layout interpretation
        ↓
layout compilation
        ↓
normal Pagebuilder structure
        ↓
HTML / CSS / JS
```

Architectural rule:
Freeform is an authoring mechanism, not the runtime layout model.
The tool must not turn the whole Pagebuilder into an editor based on absolute positioning.
3. Main concept
The user works with REGIONS.
A region represents a structural area of the layout.
Example:

```text
┌─────────────────────────────┐
│           HEADER            │
├─────────┬───────────────────┤
│         │                   │
│ SIDEBAR │      CONTENT      │
│         │                   │
│         ├─────────┬─────────┤
│         │ CARD A  │ CARD B  │
└─────────┴─────────┴─────────┘
```

The user does not need to create:

```text
container
 ├─ header
 └─ wrapper
     ├─ aside
     └─ main
         └─ grid
```

The tool must discover that structure.
4. A single construction tool
The main interaction must be based on a single contextual tool.
Do not create a bar full of independent tools for:

* split;
* merge;
* cut;
* create;
* join;
* divide;
* resize;
* subtract.

The context and the gesture determine the operation.
Principle:
One tool, many structural gestures.
5. Fundamental operations
The tool needs to support:

* Draw
* Split
* Cut
* Merge
* Resize
* Move
* Nest
* Detach
* Extract
* Subtract
* Duplicate
* Align
* Distribute
* Repeat
* Reshape
* Delete
* Restore
* Undo
* Redo

6. Draw
The user can click and drag on the canvas to create a region.
While drawing:

* show a preview of the region;
* show width and height;
* apply snapping;
* show relevant alignments;
* show distances;
* respect guides;
* respect the grid when enabled.

The region can be created:

* on the root canvas;
* inside another region;
* over existing regions;
* fitted into existing divisions.

The system must interpret the context correctly.
7. Split
The user must be able to divide regions by drawing directly over them.
Example:

```text
BEFORE

┌───────────────────────┐
│                       │
│                       │
└───────────────────────┘
```

Gesture:

```text
────────────
```

Result:

```text
┌───────────────────────┐
│                       │
├───────────────────────┤
│                       │
└───────────────────────┘
```

The split can be:

* horizontal;
* vertical;
* multiple;
* partial;
* applied to only one region;
* applied to several regions when geometrically coherent.

The system must show a preview before the commit.
8. Cut Line
The user can draw a line crossing a region.
The tool must:

1. identify every region hit;
2. determine the intersections;
3. show a preview;
4. create the new subdivisions;
5. update the topology;
6. update the constraints;
7. update snapping;
8. update the measures;
9. preserve undo/redo.

The cut must not be only visual.
It must change the structure of the Layout Model.
9. Merge
Compatible regions must be joinable by a gesture.
Example:

```text
┌──────────┬──────────┐
│    A     │    B     │
└──────────┴──────────┘
```

The user crosses A and B with a joining gesture.
Result:

```text
┌─────────────────────┐
│                     │
└─────────────────────┘
```

The system must recognise:

* adjacency;
* topological compatibility;
* the same parent;
* continuity;
* shared boundaries.

The merge must remove unnecessary divisions from the structure.
10. Merge by sweep
Inspired by the Shape Builder.
The user can press and drag across several regions:

```text
A → B → C → D
```

The crossed regions are highlighted in real time.
On finishing:

```text
merge(A,B,C,D)
```

The result must be a single region whenever geometrically possible.
11. Subtract
A region or area can be removed from another.
It can be triggered by a keyboard modifier or a specific gesture.
The system must show the result clearly before the commit.
Subtract can result in:

* empty space;
* a cutout;
* a new topology;
* a visual mask;
* an unoccupied region.

The compiler will decide later how to represent it.
12. Shapes
The user must not be limited only to simple rectangles.
Shapes useful for spatial composition must be supported:

* rectangles;
* irregular regions;
* shapes with cutouts;
* polygons;
* compound areas;
* rounded corners;
* asymmetric regions.

Free geometry does not mean that the final result necessarily has the same geometric implementation.
The compiler must determine whether the shape will be represented by:

* CSS Grid;
* nested containers;
* clip-path;
* border-radius;
* pseudo-elements;
* SVG;
* a combination of these techniques.

13. Geometry Engine
Every spatial operation must use a single geometric engine.
No module may implement its own parallel coordinates.
Mandatory flow:

```text
Pointer Events
      ↓
Coordinate System
      ↓
Geometry Engine
      ↓
Snap / Guides / Grid
      ↓
Layout Topology
      ↓
Layout Model
```

The Geometry Engine must be responsible for:

* bounds;
* intersections;
* containment;
* adjacency;
* overlap;
* edges;
* vertices;
* distances;
* alignment;
* snapping candidates;
* split intersections;
* merge compatibility;
* hit testing;
* transformations.

14. Coordinate system
There must be a single source of truth for coordinates.
It needs to consider:

* zoom;
* pan;
* viewport;
* canvas origin;
* nested regions;
* rulers;
* guides;
* transforms;
* device pixel ratio.

Zoom and pan must not change the geometric meaning of the layout.
15. Grid
The Grid system must be part of the tool.
It must allow:

* a grid in pixels;
* a column-based grid;
* gutters;
* margins;
* subdivisions;
* a configurable grid;
* the grid on/off;
* different presets;
* display without affecting the export.

Important:
A visual grid does not necessarily mean CSS Grid.
The grid serves authoring.
The compiler decides the implementation later.
16. Snap
The snap system must act on:

* Grid;
* guides;
* rulers;
* edges;
* centers;
* corners;
* dividers;
* regions;
* siblings;
* parent bounds;
* repeated spacing;
* custom anchors.

Types:

* edge snap;
* center snap;
* intersection snap;
* spacing snap;
* equal-size snap;
* grid snap;
* guide snap.

The snap must show visual feedback before fixing.
17. Rulers
Add horizontal and vertical rulers.
The rulers must:

* follow the zoom;
* follow the pan;
* show real coordinates;
* allow creating guides;
* show the cursor's position;
* show the selection;
* allow an adjustable origin when necessary.

18. Guides
Guides can be created:

* pulling from the rulers;
* manually;
* by duplicating;
* numerically;
* from existing alignments.

They must be able to:

* lock;
* hide;
* be removed;
* be renamed;
* move;
* receive snap.

19. Smart Guides
Smart Guides appear temporarily during editing.
Examples:

* aligned centres;
* aligned edges;
* equal gaps;
* equal dimensions;
* uniform distribution;
* similar proportions;
* a spatial baseline.

20. Measurement System
During move, resize, draw, split and merge, show the relevant measures.
Examples:

```text
320 px
24 px
1:1
50%
```

Show:

* width;
* height;
* distance;
* gap;
* offset;
* alignment;
* ratio;
* relative position.

21. Constraints
The tool must allow structural relationships between regions.
Examples:

```text
same width
same height
equal gap
maintain ratio
fill available
minimum width
maximum width
minimum height
maximum height
fixed
fluid
hug content
stretch
```

Also:

```text
A.width = B.width
gap(A,B) = 24
C.width >= 280
D.fillRemaining = true
```

Constraints must be part of the Layout Model.
22. Structural resize
Resize must not simply change visual pixels.
When moving a divider between two regions:

```text
┌───────┬─────────────┐
│       │             │
└───────┴─────────────┘
```

the system must interpret the structural change.
It can result in:

```text
280px 1fr
```

or:

```text
30% 70%
```

or:

```text
minmax(240px, 30%) 1fr
```

depending on the context and the constraints.
23. Move
Regions can be moved freely while Layout Mode is active.
During a move:

* preview;
* snapping;
* prospective parent;
* prospective sibling relationship;
* insertion indicator;
* dimensions;
* overlap analysis;
* merge suggestions.

The system must distinguish:

* move;
* reorder;
* nest;
* detach;
* merge.

24. Nest
When moving a region over another, it must be possible to insert it as a child.
Before the commit:

* highlight the possible parent;
* show the padding;
* show the probable position;
* show the structural change.

Nesting must change the Layout Model, not only coordinates.
25. Detach
An inner region can be taken out of its parent.
The system must recalculate:

* the parent structure;
* the remaining children;
* tracks;
* constraints;
* spacing;
* hierarchy.

26. Align
Allow visual alignment:

* left;
* right;
* top;
* bottom;
* horizontal center;
* vertical center.

It can operate on several regions.
27. Distribute
Distribute regions:

* horizontally;
* vertically;
* equal gaps;
* equal width;
* equal height.

The system must recognise when that can later become Grid/Flex.
28. Repeat
Allow turning a visual repetition into a structural pattern.
Example:
four equal regions:

```text
[A] [A] [A] [A]
```

The system can interpret it as:

```text
repeat(4, 1fr)
```

The user must be able to edit the quantity, the gap and the rules.
29. Layout Topology
The tool needs to keep a topological representation independent of the CSS implementation.
It must know:

* which regions exist;
* who contains whom;
* who is adjacent;
* which edges are shared;
* which regions belong to the same group;
* which divisions structure the space;
* which regions resulted from splits;
* which regions were merged;
* which constraints exist.

30. Layout Model
Create an intermediate model that represents structural intent.
Conceptual example:

```text
Layout
 ├─ Region Header
 └─ Split horizontal
     ├─ Region Sidebar
     └─ Region Main
         └─ Split vertical
             ├─ Region A
             └─ Region B
```

The model must not depend directly on HTML.
31. Layout Compiler
Create a stage responsible for turning the Layout Model into the Pagebuilder's real structure.
Flow:

```text
Geometry
   ↓
Topology
   ↓
Layout Model
   ↓
Constraint Resolution
   ↓
Structure Inference
   ↓
DOM Structure
   ↓
CSS Layout
```

32. Structure inference
The compiler must analyse:

* alignment;
* repetition;
* direction;
* gaps;
* containment;
* sizing;
* proportions;
* spans;
* nesting;
* responsive relationships.

And decide between:

* CSS Grid;
* Flexbox;
* nested containers;
* block flow;
* absolute positioning only when necessary.

33. Absolute forbidden as the default solution
Do not convert a free drawing directly into:

```css
position:absolute;
left:...
top:...
width:...
height:...
```

Absolute positioning is allowed only when the intent itself requires overlap or independent positioning.
The default must be a fluid structure.
34. Grid inference
When there are:

* rows;
* columns;
* regular gaps;
* spans;
* two-dimensional alignments;

prefer CSS Grid.
Detect:

* tracks;
* repeated tracks;
* fractions;
* fixed tracks;
* auto tracks;
* spans;
* template areas.

35. Flexbox inference
When there is distribution along a predominant axis:

* row;
* column;
* alignment;
* ordering;
* flexible items;

prefer Flexbox.
36. Minimal structure
The compiler must avoid unnecessary wrappers.
Objective:

```text
smallest valid structure preserving intent
```

Do not generate deeply nested DOM without need.
37. Stable code
Small visual changes must not produce large arbitrary restructurings of the DOM.
The compiler needs to prioritise structural stability.
38. Responsiveness
The Layout Composer needs to support desktop, tablet and mobile.
Do not create three independent documents.
There must be a common structure with variations per breakpoint.
39. Responsive inference
When possible, infer behaviour.
Desktop example:

```text
[A][B][C]
```

mobile:

```text
[A]
[B]
[C]
```

The system can interpret it as a change of tracks.
40. Responsive editing
The user must be able to:

* change the breakpoint;
* move regions;
* change splits;
* stack/unstack;
* change gaps;
* hide regions;
* modify sizing.

The specific changes must be stored as overrides.
41. Real content
After the layout is applied, the regions need to accept normally:

* text;
* image;
* button;
* form;
* video;
* component;
* widget;
* any other Pagebuilder element.

42. Normal flow outside Layout Mode
When Layout Mode is off:

* elements follow the normal flow;
* Grid works normally;
* Flex works normally;
* content influences size;
* containers grow with content;
* responsiveness works normally;
* the current drag-and-drop keeps operating.

43. Re-editing
Already compiled layouts must be reopenable in Layout Mode.
The system must rebuild their spatial representation without destroying the existing structure.
44. Round-trip
Ideally:

```text
Layout Model
→ Pagebuilder structure
→ Layout Mode
→ Layout Model
```

without important semantic loss.
45. Hover Preview
Before executing any structural operation, show a preview.
Examples:
Split:

```text
highlighted line
+ resulting areas
```

Merge:

```text
regions receive a common highlight
```

Nest:

```text
the parent is highlighted
```

Subtract:

```text
the removed area is hatched
```

46. Feedback
Every operation must be predictable.
The user must never need to "try to find out" the result.
Before the commit, show:

* the operation;
* the target;
* the result;
* the affected areas.

47. Cursors
Use specific cursors for:

* draw;
* resize;
* move;
* split;
* merge;
* subtract;
* pan.

48. Selection
Support:

* single select;
* multi-select;
* marquee;
* shift select;
* selection hierarchy;
* selection cycling in overlapping areas.

49. Keyboard modifiers
Use modifiers for secondary operations when it makes sense.
Conceptual example:

```text
Shift → additive selection
Alt → subtract
Ctrl → precision/alternate action
Space → pan
```

Do not depend only on keyboard modifiers for essential functions.
50. Undo/Redo
Every change needs to be transactional.
Examples:

* split;
* merge;
* resize;
* move;
* nesting;
* subtract;
* guide creation;
* constraint change.

A merge operation involving five regions must be undone in a single undo.
51. Inspector
Selecting a region must allow editing the relevant properties.
Examples:

* width;
* height;
* sizing mode;
* min/max;
* gap;
* padding;
* alignment;
* layout behaviour;
* responsive behaviour;
* constraints.

The Inspector must not expose unnecessary implementation details when it can show intent.
52. Sizing modes
Regions must support concepts such as:

```text
Fixed
Fluid
Fill
Hug
Min/Max constrained
Proportional
```

The corresponding CSS implementation is the compiler's responsibility.
53. Visual hierarchy
The user must be able to see quickly:

* parent;
* children;
* siblings;
* groups;
* nested layout;
* boundaries.

Without constantly polluting the screen.
54. Grid overlays
Allow the visual overlay of:

* column grid;
* baseline grid;
* spacing grid;
* custom grid.

All must talk to Snap.
55. Zoom
Zoom needs to work without affecting precision.
Snap must keep using document coordinates.
56. Pan
Space + drag or an equivalent interaction.
Pan must not change the layout.
57. Optional minimap
For large layouts, there can be a minimap.
It is not a fundamental requirement for the first version.
58. Layout templates
The user can save created structures as templates.
A template represents a reusable structure.
Example:

```text
Dashboard
Landing page
Sidebar layout
Article
Gallery
```

59. Conversion into a template
Any valid Layout Model can be saved as a template.
60. Do not duplicate systems
Do not create a second independent document model.
The tool needs to generate structures compatible with the existing Pagebuilder.
61. Single source of truth
Layout Intelligence must have a single owner.
Do not spread interpretation between:

* renderer;
* canvas;
* inspector;
* drag and drop;
* responsive engine.

The Layout Engine produces the structure.
Other modules consume that structure.
62. Integration with drag-and-drop
After the layout exists, the normal drag-and-drop must recognise its regions as valid containers.
The user must be able to drag components into them.
63. Integration with styles
The current properties system must keep working.
Changing:

* background;
* border;
* radius;
* padding;
* shadow;
* effects;

must not require Layout Mode.
64. Integration with export
Export must produce:

* clean HTML;
* clean CSS;
* JS only when necessary.

No editor-specific code in the final output.
65. Persistence
Save:

* layout structure;
* topology;
* constraints;
* responsive overrides;
* relevant guides;
* semantic layout data.

Do not save unnecessary purely transient state.
66. Performance
Interactions must remain fluid during:

* draw;
* resize;
* move;
* snap;
* guide calculation;
* preview;
* selection.

Avoid recomputing the whole page on each pointer move.
Use incremental updates when possible.
67. Hit testing
Create a robust system for:

* small regions;
* overlapping regions;
* nested regions;
* dividers;
* handles;
* guides;
* shapes.

68. Precision
Geometric operations must not accumulate progressive errors.
Avoid floating point drift in repeatedly edited structures.
69. Error recovery
An invalid operation must:

* not change the document;
* show feedback;
* preserve the previous state.

70. Layout validity
The engine must validate:

* invalid overlaps;
* regions without a valid parent;
* impossible dimensions;
* conflicting constraints;
* degenerate geometry;
* hierarchical cycles.

71. Complex cases
The system must support:

```text
header + sidebar + content
dashboard
nested grids
asymmetric layouts
magazine layout
cards
hero sections
split screens
sidebar resizing
complex nested regions
irregular decorative layouts
```

72. Main UX
The experience must allow:

```text
DRAW
CUT
MERGE
MOVE
RESIZE
DONE
```

without forcing the user to open dozens of panels.
73. Interface philosophy
The canvas is the main interface.
Panels complement the canvas.
They must not replace direct interaction.
74. Success criterion
A user must be able to reproduce a complex wireframe visually without thinking about CSS.
After finishing:

* the structure needs to be clean;
* responsive;
* editable;
* semantically understandable;
* compatible with normal web flow.

75. Mandatory tests
Test manually in the real browser.
Do not validate only by unit tests.
Create at least:
Case 1
Header + sidebar + content.
Case 2
Dashboard with 6+ regions.
Case 3
Asymmetric layout.
Case 4
Repetitive grid.
Case 5
Nested regions.
Case 6
Multiple split.
Case 7
Multiple merge.
Case 8
Subtract.
Case 9
Structural resize.
Case 10
Desktop → mobile.
Case 11
Layout with real content.
Case 12
Reopen a compiled layout in Layout Mode.
76. Test as a real user
Use Playwright/browser to:

* open the application;
* create a layout;
* draw;
* cut;
* merge;
* move;
* resize;
* nest;
* insert content;
* change breakpoint;
* undo;
* redo;
* save;
* reload;
* export.

77. Visual validation
Capture screenshots during development.
Compare:

* before;
* during;
* after.

Do not consider it working only because of the absence of errors in the console.
78. Structural validation
After creating each layout, inspect:

* DOM;
* hierarchy;
* Grid/Flex;
* wrappers;
* generated CSS;
* responsive rules.

79. Acceptance
The tool is only considered ready when:

* Draw works;
* Split works;
* Merge works;
* Cut works;
* Resize works;
* Nest works;
* Snap works;
* Grid works;
* Guides work;
* Rulers work;
* Constraints work;
* responsive editing works;
* the Layout Compiler works;
* the compiled layout stays editable;
* the page outside Layout Mode keeps using the normal flow;
* no relevant existing system was broken.

80. Non-goals
Do not turn the whole Pagebuilder into a freeform editor.
Do not use absolute positioning as the default implementation.
Do not create a second pages system.
Do not require CSS knowledge to create a layout.
Do not turn each gesture into a separate tool.
Do not produce only static wireframes.
Do not generate only an image or a visual representation.
Do not generate code disconnected from the document model.
81. Expected result
The final experience must be:

```text
The user imagines a structure.

Draws that structure directly on the canvas.

Divides regions with lines.

Joins regions with gestures.

Moves and resizes.

Uses grid, snap, ruler, guides and constraints.

The system understands the spatial relationships.

The Layout Compiler converts it into a correct web structure.

The user leaves Layout Mode.

The page starts working as a normal Pagebuilder page.
```

The tool must make disappear from the creation process the need for the user to manually plan containers, wrappers,
Grid, Flexbox and hierarchy before being able to draw what they can already visualise.
Pasted text(20261001-173031).txt Document
Is this one better or not?:
Yes. It is better — mainly as a product and architecture specification.
The main leap is that it stops treating the tool as just a "visual layout editor" and starts defining it as a visual
language of spatial programming: the user expresses regions, relationships, divisions, proportions, repetitions and
behaviour, and the system compiles that into a web structure.
The most important improvements are these:

* The Layout Intent Graph is much better than a simple Layout Model, because it keeps intent, relationships,
  constraints, patterns, responsiveness and provenance, not only geometry.
* The Gesture Algebra gives a formal basis for draw, split, merge, repeat, constrain etc., which helps undo/redo,
  versioning and transformation without becoming a pile of ad hoc state.
* The Ambiguity Engine solves a central problem: the same geometry can mean Grid, Flex or different proportions. The
  specification now foresees candidates, confidence and a preview before confirmation.
* The Layout Predictor is excellent because it shows not only "where it will go", but "what the system understood":
  "3 equal columns", "280px + Fill", "Nest inside Content".
* The Responsive Continuum is far superior to the rigid desktop/tablet/mobile model. The user literally drags the
  width and sculpts where the behaviour changes.
* The topological editing of boundaries is probably one of the best ideas of the document: dividers and vertices
  become real entities of the layout, instead of each rectangle being independent.
* Stable Compilation solves another serious problem: small changes cannot rebuild half of the DOM. The specification
  now requires preserving structure, minimising wrappers and keeping the round-trip.

And it preserves exactly the principle you had been defining: inside Layout Mode there is spatial authoring; afterwards
the result becomes normal web, without a special runtime.
But there is an important caveat: it is better as a conceptual specification, but worse as a single implementation
prompt for Claude Code.
Now the scope has become enormous. There are at least four heavy systems together:
geometry/topology + intent graph + compiler + responsive inference
and also reverse import, semantic diff, stress testing, variables, reusable spatial components, pattern recognition
etc. If you send everything as "implement this", there is a big chance it will create superficial skeletons of 25
features instead of doing the core right.
I would treat as the mandatory core exactly what the text itself concludes: Layout Intent Graph + Gesture Algebra +
Responsive Continuum, but I would add a fourth: Topological Editing.
So my assessment is:
As a product vision: much better.
As architecture: better.
As a definition of the innovation: much better.
As a direct prompt for Claude Code to implement everything at once: it needs to be turned into execution phases.
I would not reduce this specification. I would keep it as the master specification and write a separate prompt telling
Claude exactly which core to implement first, without it trying to build the 25 ideas superficially at the same time.
why? what is so much that it cannot implement everything at once?
It can implement everything. The problem is not "it cannot"; the problem is that, if you ask for everything in a single
run without hierarchy, the chance increases a lot that it delivers several superficial parts, incompatible with each
other or apparently ready without really working together.
What makes this specification large is not the number of items, but the fact that several of them are practically
systems of their own.
The core already requires four strongly coupled layers:

1. Layout Intent Graph — it needs to represent geometry, topology, constraints, relationships, patterns, semantics,
   responsive behaviour and provenance as the canonical source of the layout.
2. Gesture Algebra — draw, split, merge, repeat, constrain etc. need to become declarative reversible operations, not
   simply arbitrary changes of state.
3. Topological Editing — edges and vertices become structural entities. Dragging a shared edge can change several
   regions at once; removing an edge can mean a merge; duplicating it can create tracks.
4. Compiler — after that it is still necessary to turn all that intent into DOM + Grid/Flex/CSS without destroying the
   existing structure and without generating unnecessary wrappers. The specification itself requires a stable and
   minimal compilation.

These four alone already need to work as a unit.
Then come systems that depend on them.
For example, the Ambiguity Engine needs to look at the same geometry and distinguish interpretations such as Grid, Flex
row, proportional regions or fixed tracks. It also needs to generate candidates, determine confidence and allow
switching the interpretation before the commit.
That means it is not enough to do:
`if 3 boxes aligned:`
`    use grid`
It needs a representation good enough to compare interpretations.
The Responsive Continuum is not simply adding breakpoints either. The specification says the user drags the width
continuously and the system records changes of behaviour, which can later be compiled into media queries, container
queries or intrinsic behaviour.
So you have something like:
`Geometry`
`   ↓`
`Topology`
`   ↓`
`Intent`
`   ↓`
`Constraints`
`   ↓`
`Patterns`
`   ↓`
`Responsive behavior`
`   ↓`
`Compiler`
`   ↓`
`DOM/CSS`
Any error in one layer contaminates the following ones.
The Content Pressure Engine is another example. It needs to distinguish whether a region drawn at 300 px means fixed
300, preferred 300 / min 220 / max 360 or simply something equivalent to 1fr, considering content, space and
neighbours.
That is not a small visual feature. It is part of a layout solver.
And there are still second-order features:

* pattern recognition;
* structural refactoring of existing layouts;
* different handles depending on the recognised structure;
* several "lenses" over the same graph;
* structural provenance for a reliable round-trip;
* canonicalisation after many edits;
* reusable spatial components;
* layout variables;
* stress testing;
* reverse import HTML/CSS → intent graph;
* semantic layout diff.

There is nothing absurd individually. The problem is the interaction between all of it.
For example:
`split`
`→ creates a new boundary`
`→ changes topology`
`→ changes constraints`
`→ may break a pattern`
`→ changes responsive behavior`
`→ the compiler recalculates the structure`
`→ provenance needs to stay valid`
`→ undo needs to restore everything correctly`
Or:
`merge`
`→ removes a boundary`
`→ two regions become one`
`→ wrappers may become redundant`
`→ canonicalization removes unnecessary structure`
`→ the compiler tries to preserve the existing DOM`
`→ responsive variants need to be reconciled`
That is where an AI tends to fail: each feature in isolation seems to work, but their composition does not.
So I would correct what I said before this way:
I would not divide because Claude is incapable of writing all the code.
I would divide the implementation to force it to build the system from the bottom up, making each layer become real
infrastructure of the next, instead of creating 25 modules with provisional implementations.
You can perfectly hand the whole specification to it at once. I even think you should, because it needs to know the
complete destination.
But the command should be something like:
This is the complete specification and no feature may be discarded. Implement it completely. However, carry out the
construction in order of architectural dependency. Do not create stubs, placeholders or superficial versions of future
features. Build first the necessary shared infrastructure and move immediately on to the following layers until the
whole specification is finished.
The difference is important.
It would not be:
`do only 4 things now`
`and the others are left for later`
It would be:
`you will do EVERYTHING,`
`but the implementation must grow in this order:`

`geometry`
`→ topology`
`→ intent graph`
`→ gesture algebra`
`→ constraints`
`→ compiler`
`→ responsive`
`→ advanced interaction`
`→ reverse/refactoring features`
`→ full validation`
And it keeps working until everything is finished.
So, answering directly: I see nothing in this specification that is conceptually impossible to implement. It is only
large enough to require a strict architectural order. If you want, we can have Claude execute the whole specification,
without reducing scope; I would only write the prompt to stop it from turning "implement everything" into "I created
twenty files and marked twenty TODOs".
ok but can he be asked to put these implementations in a part that does not break the application and works
separately? then if I want to take it out I just take it out, etc... what is that called?
Yes. The most correct name for what you want is an isolated module or, better still, a plugin architecture.
In your case, I would ask Claude to implement the whole system as a self-contained feature module: an encapsulated
feature, with clear limits and few integration points with the Pagebuilder.
The idea is this:
`Pagebuilder`
`│`
`├── core/`
`├── canvas/`
`├── properties/`
`├── ...`
`│`
`└── modules/`
`    └── layout-composer/`
`        ├── geometry/`
`        ├── topology/`
`        ├── intent/`
`        ├── gestures/`
`        ├── constraints/`
`        ├── compiler/`
`        ├── responsive/`
`        ├── ui/`
`        ├── adapters/`
`        └── index.ts`
The Pagebuilder should not know all that complexity internally. It should see something close to:
`registerLayoutComposer()`
and the module talks to the application through well-defined interfaces/contracts.
For example:
`Pagebuilder`
`     │`
`     │ document API`
`     │ selection API`
`     │ history API`
`     │ canvas API`
`     ▼`
`Layout Composer`
And not:
`Layout code scattered in`
`canvas.js`
`drag.js`
`properties.js`
`renderer.js`
`history.js`
`elements.js`
`app.js`
`...`
That second scenario is exactly what you do not want.
The important requirement is low coupling. The module may depend on the Pagebuilder's APIs, but the Pagebuilder must not
become full of special Layout Composer logic.
I would also require an integration boundary, something like a layer of adapters:
`Layout Composer`
`      ↓`
`Adapters`
`      ↓`
`Pagebuilder APIs`
That way, internally the Layout Composer can have all that complex architecture:
`Geometry Engine`
`Topology Engine`
`Layout Intent Graph`
`Gesture Algebra`
`Constraint Solver`
`Responsive Engine`
`Layout Compiler`
without contaminating the rest of the application.
And to be able to remove it easily, there is a very useful requirement:
Removability
That is, the feature must be designed so that removing:
`/modules/layout-composer/`
and taking out its single registration call keeps the Pagebuilder working normally.
That is almost an internal plugin architecture.
I would write something like this in the prompt:
Implement the whole new Layout tool as a self-contained and removable module, with an architecture similar to an
internal plugin.
Do not spread its logic through the Pagebuilder.
Create a domain of its own, for example:
`modules/layout-composer/`
All the tool-specific functioning must stay inside that domain: Geometry Engine, Topology, Layout Intent Graph, Gesture
Algebra, Constraints, Responsive Engine, Compiler, UI and the other features.
Integration with the Pagebuilder must happen through a minimal and explicit set of interfaces/adapters for canvas,
document model, selection, history, rendering, persistence and export.
The Pagebuilder must not come to know the Layout Composer's internal details.
Avoid adding tool-specific conditionals in several existing files.
Architectural objective:
`Pagebuilder APIs ← adapters → Layout Composer`
and not:
`Layout logic scattered through the whole application`.
The tool must have a single clear point of registration/activation.
Design it with REMOVABILITY as a requirement: it must be possible to remove the Layout Composer's directory and its
registration point, restoring the normal Pagebuilder without dismantling or rewriting other parts of the application.
The Layout Composer can produce normal structures of the existing document model, but its spatial authoring logic must
never become a requirement for the page's normal functioning.
When Layout Mode is off, no tool-specific engine may control the Pagebuilder's normal behaviour.
Do not duplicate the document model. Use adapters and well-defined commands to turn the compiled result into the
application's normal structures.
So, if you want the most precise term to talk to it:
"Implement this as an isolated, self-contained, low-coupled, removable feature module with a plugin-style integration
boundary."
That describes exactly what you want.

The current document already establishes a base far above a common pagebuilder: regions, one contextual tool by
gestures, a single geometric engine, a topology independent of CSS, a structural compiler and round-trip. Pasted text
Pasted text What is missing for it to become really revolutionary is to change the definition of the product: **not to
be a layout editor, but a visual language of spatial programming**.

# Spatial Layout Compiler

## Central concept

The canvas stops being only a place where the user draws boxes.

It becomes a visual language.

The user does not create:

`div`
`grid`
`flex`
`wrapper`
`row`
`column`

Nor do they need to decide in advance how something will be implemented.

They express directly:

**regions, relationships, divisions, proportions, repetitions, dependencies and spatial behaviour.**

The system turns that into an intermediate structural representation and compiles it into the best possible web
structure.

In other words:

**the user programs layout by drawing.**

---

# 1. Layout Intent Graph

The central piece must not be only a `Layout Model`.

Create a **Layout Intent Graph — LIG**.

It represents not only where the regions are, but why they are that way.

Example:

```text
Header
 ├ relation: above Main
 └ width: follow Parent

Main
 ├ contains Sidebar
 ├ contains Content
 └ distribution: horizontal

Sidebar
 ├ preferredWidth: 280
 └ minWidth: 220

Content
 └ fillRemaining

Cards
 ├ pattern: repeated
 ├ equalWidth
 ├ gap: 24
 └ responsiveFlow: adaptive
```

The model stops representing coordinates and starts representing **spatial intent**.

Each element can carry:

Geometry
Topology
Constraints
Relationships
Patterns
Semantics
Responsive behavior
Content behavior
Provenance

That becomes the canonical source of the layout.

---

# 2. Gesture Algebra

Draw, Cut, Split, Merge, Move and Resize must not be only commands.

They form a **visual algebra of layout transformation**.

Example:

```text
draw(A)
split(A, vertical)
split(A.right, horizontal)
repeat(A.bottom, 3)
merge(B, C)
constrain(equalWidth)
```

The user never necessarily sees this.

But internally each gesture becomes a declarative operation.

Consequence:

Undo stops being an arbitrary restoration of state.

It becomes:

```text
operation
inverseOperation
```

Layouts can also be reproduced, transformed, compared, versioned and turned into templates much more safely.

---

# 3. Compound gestures

Do not limit the interaction to one gesture = one operation.

The tool must interpret sequences.

The user can draw:

```text
│ │ │
```

and the system recognise:

```text
divide into 4 columns
```

They can cross four regions:

```text
A → B → C → D
```

and interpret:

```text
merge
```

They can draw a line and keep dragging to generate several divisions.

They can circle regions and generate a grouping.

They can cross gaps to equalise them.

They can drag a divider across several regions to align tracks.

The gesture comes to express a complete spatial transformation.

---

# 4. Ambiguity Engine

The biggest problem of a system of this kind will be ambiguity.

The solution must not be simply "the AI decided".

The system must calculate the possible interpretations.

Example:

The user creates:

```text
[A][B][C]
```

It can represent:

```text
Grid
Flex row
3 proportional regions
3 fixed regions
repeat(3, 1fr)
```

The engine calculates candidates and assigns confidence.

The most probable interpretation appears as a preview.

When two interpretations are really plausible:

```text
Repeat 3 columns
< >
Flex row
```

The user switches the interpretation before confirming.

That way the system stays predictable.

---

# 5. Layout Predictor

Before the commit, the preview must not show only geometry.

It must also show the structural interpretation.

When drawing three equal regions:

```text
┌────┬────┬────┐
```

there appears discreetly:

```text
3 equal columns
24 gap
fluid
```

When dragging a region over another:

```text
Nest inside Content
```

When resizing:

```text
280px + Fill
```

When aligning cards:

```text
Convert to repeated layout?
```

The user sees **what the system understood**, not only where the element will go.

---

# 6. Constraint Painting

Constraints need not depend mainly on the Inspector.

They must also be creatable directly on the canvas.

Example:

The user selects two edges and drags between them.

The system creates:

```text
same gap
```

Selects three elements and equalises them visually:

```text
equal width
```

Drags a region until it fills the space:

```text
fill remaining
```

Locks a dimension:

```text
fixed
```

Links two edges:

```text
aligned
```

The canvas comes to allow drawing **relationships**, not only shapes.

---

# 7. Responsive Continuum

Eliminate the idea that responsiveness must be conceived only as:

```text
Desktop
Tablet
Mobile
```

Add a continuous width control.

```text
320 ─────────────── 1920
          ▲
```

The user drags the viewport's width and watches the layout react continuously.

When something stops working visually, they modify the layout at that point.

The system records a **change of behaviour**, not necessarily a manual breakpoint.

Example:

```text
> 920
3 columns

640–920
2 columns

< 640
1 column
```

The compiler can later turn that into media queries, container queries or intrinsic rules.

The user comes to **sculpt the responsiveness**.

---

# 8. Responsive Morphing

More advanced still: changes need not happen only in jumps.

The system can represent fluid properties.

Example:

```text
sidebar:
280px → 220px → hidden

gap:
32px → 24px → 16px

columns:
4 → 3 → 2 → 1
```

The Layout Intent Graph knows the transformation.

The compiler decides how to carry it out.

---

# 9. Content Pressure Engine

Layout must not be inferred only by looking at empty geometry.

After real content enters, the system tests how the structure reacts.

Example:

A region drawn at 300px can mean:

```text
Fixed 300
```

or:

```text
Preferred 300
Min 220
Max 360
```

or:

```text
1fr
```

The engine observes:

content; available space; neighbouring regions; constraints; behaviour at other widths.

Then it preserves the intent without turning the initial drawing into rigid pixels.

---

# 10. Structural Refactoring by Gesture

The tool is not only for creating layouts.

It must allow **refactoring existing layouts visually**.

Imagine a page already done.

The user enters Layout Mode and draws a line between the content and the sidebar.

The engine can reorganise the existing containers automatically.

They select six scattered cards and make a repetition gesture.

They come to share a Grid structure.

They remove a division.

Redundant wrappers disappear.

They move two groups together.

The compiler recalculates the minimal hierarchy.

That also turns the tool into a **visual DOM/layout refactorer**.

---

# 11. Pattern Recognition

The engine must recognise patterns spontaneously.

Example:

```text
[A] [A] [A] [A]
```

Instead of storing four independent decisions:

```text
Pattern
count = 4
track = equal
gap = 24
```

Afterwards the user can change:

```text
4 → 6
```

and the layout expands.

Other patterns:

Card grids
Galleries
Dashboards
Sidebars
Master-detail
Split screens
Holy-grail layouts
Masonry-like structures
Repeated rows
Alternating sections

The user draws examples.

The system discovers the rule.

---

# 12. Structural Handles

After the system identifies a structure, the handles must represent its semantics.

In a Grid, the user sees handles for:

tracks; gaps; spans; repetitions.

In Flex:

distribution; alignment; ordering; flexible growth.

In a Split:

ratio; minimum; maximum; fill behavior.

Do not simply show eight generic resize handles.

The layout itself determines the available controls.

---

# 13. Layout Lenses

Allow temporarily switching the display of the same document.

### Spatial Lens

Shows the visual composition.

### Structure Lens

Shows containers and hierarchy.

### Constraint Lens

Shows relationships.

### Responsive Lens

Shows behaviour per width.

### Flow Lens

Shows direction and distribution.

### Semantic Lens

Shows header, nav, main, aside, section etc.

They are not independent editing modes.

They are different ways of seeing the same Layout Intent Graph.

---

# 14. Structural Provenance

Each compiled piece must know where it came from.

Example:

```text
CSS Grid
↑
Pattern #17
↑
4 repeated regions
↑
gesture operation #103
```

That way later changes can be reconciled.

That makes the round-trip much more reliable.

The system does not need to try to guess everything again every time the user returns to Layout Mode.

---

# 15. Stable Compilation

The compiler must have a cost function.

Between two visually equivalent implementations, prioritise:

```text
preserve existing structure
minimal DOM changes
minimal wrappers
native CSS layout
intrinsic responsiveness
semantic structure
low CSS complexity
round-trip preservation
```

Consequence:

Moving a divider by 10px cannot rebuild half of the page.

---

# 16. Layout Canonicalization

Structures visually different during authoring can represent the same intent.

The engine must be able to normalise:

```text
nested rows
redundant wrappers
duplicated constraints
equivalent tracks
unnecessary groups
```

into a canonical representation.

That avoids structural degradation after hundreds of edits.

---

# 17. Spatial Components

Any region or set of regions can become a parameterised structure.

Example:

```text
CardGrid(
  columns = auto,
  minCardWidth = 260,
  gap = 24
)
```

But the user does not need to write that.

They select the layout and choose:

```text
Create reusable layout
```

Then they keep editing visually.

The system learns the structure as a spatial component.

---

# 18. Layout Variables

Frequent relationships can become variables.

Example:

```text
pageMargin = 32
sectionGap = 64
cardGap = 24
sidebarWidth = 280
```

Changing one instance visually can offer:

```text
Change this
Change all using cardGap
```

That connects layout directly to the design system without turning the canvas into a form.

---

# 19. Topological Editing

The most important innovation after the Layout Intent Graph:

the user must be able to manipulate **boundaries**, not only elements.

A divider shared between three regions is a real entity.

Dragging it changes all of them at once.

Removing it executes a merge.

Duplicating it creates tracks.

Bending it creates a new subdivision.

Selecting a vertex allows changing the connected topology.

The layout stops looking like a set of independent rectangles.

It comes to work as an **editable structural mesh**.

---

# 20. Layout Stress Testing

The editor itself must be able to test the structure automatically with:

short content; long content; large titles; different images; empty regions; different widths; different heights;
zoom; dynamic expansion.

The objective is not only to detect overflow.

It is to discover whether the structural intent stays valid.

When it finds a break:

```text
Layout becomes unstable at 684px.
```

The user drags the viewport to that point and fixes it visually.

---

# 21. Structural Suggestions

Suggestions must not be generic.

They must appear only when there is strong geometric evidence.

Example:

```text
These 6 regions form a repeated pattern.
Convert to adaptive grid?
```

or:

```text
These gaps differ by less than 2px.
Equalize?
```

or:

```text
This wrapper no longer affects layout.
Remove?
```

The system helps without taking control of the canvas.

---

# 22. Intent Inspector

The Inspector must not say primarily:

```text
display:grid
grid-template-columns...
align-items...
```

It must show:

```text
Behavior
Repeated layout

Columns
Adaptive

Minimum item width
260

Gap
24

Sizing
Fill

Narrow layout
Stack
```

CSS stays an output of the compiler, not the mental model required of the user.

---

# 23. Structural import

The technology must also work the other way round.

When importing existing HTML/CSS:

```text
DOM + CSS
      ↓
Structure analysis
      ↓
Topology
      ↓
Constraint recovery
      ↓
Layout Intent Graph
```

When the recovery is unambiguous, the layout becomes editable normally.

When there is loss of information:

```text
Imported structure
Recovered intent: 93%
```

and only the relevant ambiguities need to be resolved.

---

# 24. Layout Diff

Since the system has operations and structural intent, versions can be compared semantically.

Instead of:

```text
37 CSS properties changed
```

show:

```text
Sidebar reduced
280 → 240

Card layout
3 → 4 columns

Main
changed from Fixed to Fill

Mobile
navigation moved above content
```

That makes editing, history and collaboration much more understandable.

---

# 25. Final result

The experience should reach something like this:

```text
The user sees the layout mentally.

Draws regions.

Cuts the space.

Joins areas.

Moves boundaries.

Creates relationships.

Repeats patterns.

Drags the page's width.

Sculpts the responsive behaviour.

Inserts real content.

The system keeps a Layout Intent Graph.

The compiler finds the minimal structure able to preserve that intent.

The user leaves Layout Mode.

Nothing special remains at runtime.

The result is a normal web page.
```

The fundamental conceptual change is:

```text
BEFORE

Visual editor
→ coordinates
→ containers
→ CSS
```

```text
NEW

Spatial programming
→ intent
→ topology
→ relationships
→ constraints
→ patterns
→ responsive behavior
→ structural compilation
→ native web
```

The product stops being a pagebuilder with a sophisticated layout tool.

It becomes a **Spatial Programming Environment for the Web**.

The graphical interface stops representing code.

It becomes an alternative way of writing it.

The point I would treat as the absolute core is three things: **Layout Intent Graph + Gesture Algebra + Responsive
Continuum**. If these three are really implemented, the other features stop looking like "more editor tools" and come
to form a new system. The original principle that freeform is only authoring, never the runtime model, must remain
intact. Pasted text
⋮⋮⋮⋮⋮⋮⋮⋮
