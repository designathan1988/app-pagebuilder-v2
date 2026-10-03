import {test} from 'vitest';
import assert from 'node:assert/strict';
import {semanticName, stableClass, batchNames, pageLanguage, buttonKind} from './names.ts';
test('semantic roles translated to code language, custom names retained',()=>{assert.equal(semanticName('Título 3','h2','en'),'title');assert.equal(semanticName('Seção','section','en'),'section');assert.equal(semanticName('Hero','section','pt-BR'),'destaque');assert.equal(semanticName('Pricing Pro','div','en'),'pricing-pro');});
test('class identity stable across page order and genuinely different variants',()=>{const a=stableClass('hero__title','a','index.html',new Set());assert.equal(a,'hero__title');assert.equal(stableClass('hero__title','a','about.html',new Set()),a);assert.equal(stableClass('hero__title','different','about.html',new Set(['hero__title'])),'hero__title-2');});
test('batch names validate entire request and expand deterministic indices',()=>{assert.deepEqual(batchNames(['A','B'],'Item {n}: {name}',3),['Item 3: A','Item 4: B']);assert.throws(()=>batchNames(['A'],' ',1));assert.throws(()=>batchNames(['A'],'Item {n}',0));});
test('language and button defaults preserve author intent and form association',()=>{assert.equal(pageLanguage('fr','pt-BR'),'fr');assert.equal(pageLanguage(undefined,'pt-BR'),'pt-BR');assert.equal(pageLanguage(undefined,undefined),'en');assert.equal(buttonKind(undefined,false,false),'button');assert.equal(buttonKind(undefined,true,false),'submit');assert.equal(buttonKind('reset',true,false),'reset');assert.equal(buttonKind(undefined,false,true),'submit');});

// A project whose code language is Portuguese takes the editor's Portuguese names, and its modifiers' words.
test('the code language chooses the words, roles and modifiers alike (spec export-bem-css 5)', async () => {
  const { manifest } = await import('../../manifest/runtime.ts');
  const { rulesFromManifest } = await import('../document/validate.ts');
  const { namingFor, roleWord, variantModifier } = await import('./names.ts');
  const rules = rulesFromManifest(manifest.elements, manifest.properties, manifest.html);
  const portuguese = namingFor('pt-BR', 'pt-BR', rules);
  const english = namingFor('pt-BR', 'en', rules);
  const grid = { name: 'Grade', type: 'div', tag: 'div', declarations: { display: 'grid' } };
  assert.equal(roleWord(grid, portuguese), 'grade');
  assert.equal(roleWord(grid, english), 'grid');
  // a name the person typed in the project's language is kept only when that is the code language
  const typed = { name: 'Planos', type: 'section', tag: 'section', declarations: {} };
  assert.equal(roleWord(typed, portuguese), 'planos');
  assert.equal(roleWord(typed, english), 'section');
  const first = { tag: 'article', declarations: { 'padding-top': '24px' } };
  const dark = { tag: 'article', declarations: { 'padding-top': '24px', 'background-color': '#14213d' } };
  assert.equal(variantModifier(dark, first, 'pt-BR', () => true), 'escuro');
  assert.equal(variantModifier(dark, first, 'en', () => true), 'dark');
  // every word taken: the last one numbered
  assert.equal(variantModifier(dark, first, 'en', (word) => word === 'alt-2'), 'alt-2');
});
