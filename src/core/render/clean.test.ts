import {test} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {codecOf} from '../style/codecs.ts';
import {compactDeclarations, mergeExclusiveRules, mergeCssLines, type Composite} from './clean.ts';
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
test('line provenance and nested media survive generated CSS coalescing',()=>{const lines=['.a {','  color: red;','}','@media (max-width: 600px) {','  .a {','    color: blue;','  }','}','.b {','  color: red;','}'].map(text=>({text,node:'node'}));const out=mergeCssLines(lines,new Set(['a','b']));assert.equal(out.map(l=>l.text).join('\n'),'.a, .b {\n  color: red;\n}\n@media (max-width: 600px) {\n  .a {\n    color: blue;\n  }\n}');});
