import {test} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {codecOf} from '../style/codecs.ts';
import {cascadeOrder, compactDeclarations, mergeExclusiveRules, mergeCssLines, type Composite} from './clean.ts';
const manifest=JSON.parse(readFileSync(new URL('../../../manifest/properties.json',import.meta.url),'utf8')) as {composites: {shorthand:string;longhands:string[];codec:string}[]};
const composites:Composite[]=manifest.composites.map(c=>({...c,compose:codecOf(c.codec)?.compose}));
test('existing box codec composes four padding sides and preserves isolated overrides',()=>{
 assert.deepEqual(compactDeclarations(['padding-top: 80px;','padding-right: 64px;','padding-bottom: 80px;','padding-left: 64px;'],composites),['padding: 80px 64px;']);
 assert.deepEqual(compactDeclarations(['padding-top: 0px;'],composites),['padding-top: 0px;']);
});
test('all box compounds use shortest safe output',()=>{
 for(const stem of ['margin','inset']){const names=stem==='inset'?['top','right','bottom','left']:['top','right','bottom','left'].map(s=>`${stem}-${s}`);assert.deepEqual(compactDeclarations(names.map(n=>`${n}: 4px;`),composites),[`${stem}: 4px;`]);}
 assert.deepEqual(compactDeclarations(['row-gap: 4px;','column-gap: 8px;'],composites),['gap: 4px 8px;']);
 assert.deepEqual(compactDeclarations(['border-top-left-radius: 4px;','border-top-right-radius: 4px;','border-bottom-right-radius: 4px;','border-bottom-left-radius: 4px;'],composites),['border-radius: 4px;']);
 assert.deepEqual(compactDeclarations(['border-top-left-radius: 4px 8px;','border-top-right-radius: 4px 8px;','border-bottom-right-radius: 4px 8px;','border-bottom-left-radius: 4px 8px;'],composites),['border-radius: 4px / 8px;']);
});
test('no composition across logical conflict, css-wide mixture, custom substitution or unequal importance',()=>{
 const base=['padding-top: 4px;','padding-right: 4px;','padding-bottom: 4px;','padding-left: 4px;'];
 for(const input of [[...base,'padding-inline-start: 8px;'],base.map((x,i)=>i===0?x.replace('4px','inherit'):x),base.map((x,i)=>i===0?x.replace('4px','var(--space)'):x),base.map((x,i)=>i===0?x.replace(';',' !important;'):x)])assert.deepEqual(compactDeclarations(input,composites),input);
 assert.deepEqual(compactDeclarations(base.map(x=>x.replace(';',' !important;')),composites),['padding: 4px !important;']);
});
test('border never silently resets border-image and font never silently resets font-kerning',()=>{
 const input=['top','right','bottom','left'].flatMap(s=>[`border-${s}-width: 1px;`,`border-${s}-style: solid;`,`border-${s}-color: red;`]);
 assert.ok(!compactDeclarations(input,composites).some(l=>l.startsWith('border:')));
 const font=['font-style: italic;','font-variant: normal;','font-weight: 700;','font-stretch: normal;','font-size: 16px;','line-height: 1.5;','font-family: Arial;'];
 assert.deepEqual(compactDeclarations(font,composites),font);
});
test('complete border and font resets can be compacted without losing explicit reset values',()=>{
 const border=['top','right','bottom','left'].flatMap(s=>[`border-${s}-width: 1px;`,`border-${s}-style: solid;`,`border-${s}-color: red;`]);
 assert.deepEqual(compactDeclarations([...border,'border-image-source: none;','border-image-slice: 100%;','border-image-width: 1;','border-image-outset: 0;','border-image-repeat: stretch;'],composites),['border: 1px solid red;']);
 const resets=JSON.parse(readFileSync(new URL('./reset-rules.json',import.meta.url),'utf8')) as {font:Record<string,string>};
 const font=['font-style: italic;','font-variant: normal;','font-weight: 700;','font-stretch: normal;','font-size: 16px;','line-height: 1.5;','font-family: Arial;',...Object.entries(resets.font).map(([key,value])=>`${key}: ${value};`)];
 assert.deepEqual(compactDeclarations(font,composites),['font: italic 700 16px/1.5 Arial;']);
});
test('generated rules merge identical bodies without crossing media/state contexts or changing author CSS',()=>{
 const input=[{selector:'.hero',context:'',body:'color: red;',node:'a'},{selector:'.card',context:'',body:'color: red;',node:'b'},{selector:'.hero:hover',context:'',body:'color: blue;',node:'a'},{selector:'.card',context:'(max-width: 600px)',body:'color: red;',node:'b'}];
 const out=mergeExclusiveRules(input,new Set(['hero','card']));
 assert.equal(out.length,3);assert.equal(out[0]?.selector,'.hero, .card');assert.deepEqual(out[0]?.nodes,['a','b']);
 assert.equal(mergeExclusiveRules(input,new Set()).length,4);
});
test('merging refuses selectors sharing a class and different pseudo-class contexts',()=>{
 const input=[{selector:'.a',context:'',body:'color: red;',node:'a'},{selector:'.a',context:'',body:'color: blue;',node:'a'},{selector:'.b',context:'',body:'color: red;',node:'b'}];
 assert.equal(mergeExclusiveRules(input,new Set(['a','b'])).length,3);
 const pseudo=[{selector:'.a:hover',context:'',body:'color: red;',node:'a'},{selector:'.b:focus',context:'',body:'color: red;',node:'b'}];assert.equal(mergeExclusiveRules(pseudo,new Set(['a','b'])).length,2);
});
test('line provenance and nested media survive generated CSS coalescing',()=>{const lines=['.a {','  color: red;','}','@media (max-width: 600px) {','  .a {','    color: blue;','  }','}','.b {','  color: red;','}'].map(text=>({text,node:'node'}));const out=mergeCssLines(lines,new Set(['a','b']),['@media (max-width: 600px)']);assert.equal(out.map(l=>l.text).join('\n'),'.a, .b {\n  color: red;\n}\n@media (max-width: 600px) {\n  .a {\n    color: blue;\n  }\n}');});

// The audit's AUD-02, on Marina's export: two sections with the same side padding at 834 and 390. The export wrote one
// element at a time (its base rule, then its media rules), and merging the second section's media rules up into the
// first's put them before the second section's own base rule, which then won at 834 and 390.
const MEDIA = ['@media (max-width: 1180px)', '@media (max-width: 834px)', '@media (max-width: 390px)'];
const element = (name: string, node: string, base: string, media: Readonly<Record<string, string>>) => [
  `.${name} {`,
  `  ${base}`,
  '}',
  ...Object.entries(media).flatMap(([query, body]) => [`${query} {`, `  .${name} {`, `    ${body}`, '  }', '}']),
].map((text) => ({ text, node }));

test('the merged stylesheet keeps every element base rule before the breakpoint rules (AUD-02)', () => {
  const lines = [
    ...element('hero', 'a', 'padding-inline: 64px;', { '@media (max-width: 834px)': 'padding-inline: 32px;', '@media (max-width: 390px)': 'padding-inline: 20px;' }),
    // the plans section's base rule holds one more declaration, so it is not merged, while its breakpoint rules are the
    // hero's and are
    ...element('plans', 'b', 'padding-inline: 64px; gap: 24px;', { '@media (max-width: 834px)': 'padding-inline: 32px;', '@media (max-width: 390px)': 'padding-inline: 20px;' }),
  ];
  const text = mergeCssLines(lines, new Set(['hero', 'plans']), MEDIA).map((line) => line.text).join('\n');
  assert.equal(
    text,
    [
      '.hero {',
      '  padding-inline: 64px;',
      '}',
      '.plans {',
      '  padding-inline: 64px; gap: 24px;',
      '}',
      '@media (max-width: 834px) {',
      '  .hero, .plans {',
      '    padding-inline: 32px;',
      '  }',
      '}',
      '@media (max-width: 390px) {',
      '  .hero, .plans {',
      '    padding-inline: 20px;',
      '  }',
      '}',
    ].join('\n'),
  );
});

test('the breakpoint blocks follow the cascade, widest first, whichever element names one first', () => {
  // the first element holds only a phone rule, the second a tablet one: the tablet block still comes first, or it would
  // win over the phone rule at 390
  const lines = [
    ...element('a', 'a', 'color: red;', { '@media (max-width: 390px)': 'color: blue;' }),
    ...element('b', 'b', 'color: red;', { '@media (max-width: 834px)': 'color: green;' }),
  ];
  const ordered = cascadeOrder(lines, MEDIA).map((line) => line.text);
  assert.deepEqual(ordered, ['.a {', '  color: red;', '}', '.b {', '  color: red;', '}', '@media (max-width: 834px) {', '  .b {', '    color: green;', '  }', '}', '@media (max-width: 390px) {', '  .a {', '    color: blue;', '  }', '}']);
  // the lines keep the element they were written for; the block lines belong to none
  const nodes = cascadeOrder(lines, MEDIA).map((line) => line.node);
  assert.deepEqual(nodes, ['a', 'a', 'a', 'b', 'b', 'b', null, 'b', 'b', 'b', null, null, 'a', 'a', 'a', null]);
});

test('lines no element was written for stay after the element rules, in their order', () => {
  const lines = [
    ...element('a', 'a', 'color: red;', {}),
    ...['@keyframes spin {', '  to { rotate: 1turn; }', '}', '@media (prefers-reduced-motion: reduce) {', '  .a {', '    animation: none;', '  }', '}'].map((text) => ({ text, node: null })),
    ...element('b', 'b', 'color: red;', {}),
  ];
  assert.deepEqual(
    cascadeOrder(lines, MEDIA).map((line) => line.text),
    ['.a {', '  color: red;', '}', '.b {', '  color: red;', '}', '@keyframes spin {', '  to { rotate: 1turn; }', '}', '@media (prefers-reduced-motion: reduce) {', '  .a {', '    animation: none;', '  }', '}'],
  );
});

test('a media query the breakpoints do not name is refused, never placed by guess', () => {
  const lines = element('a', 'a', 'color: red;', { '@media (min-width: 2000px)': 'color: blue;' });
  assert.throws(() => cascadeOrder(lines, MEDIA), /a media query the breakpoints do not name/);
});
