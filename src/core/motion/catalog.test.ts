import { describe, expect, it } from 'vitest';
import { manifest } from '../../manifest/runtime.ts';
import { EFFECTS, EFFECT_KINDS, TARGET_KINDS, TRIGGER_KINDS, TRIGGERS, applicableTriggers, defaultEffect, defaultTrigger, targetOf } from './catalog.ts';
import { RUNTIME_BEHAVIOURS } from './model.ts';
import { readInteraction, readTimeline } from './read.ts';

// the values a motion command's argument offers in the manifest
const offered = (command: string, argument: string): readonly string[] => {
  const found = manifest.commands.find((one) => one.id === command);
  return (found?.args as Record<string, { readonly values: readonly string[] }> | undefined)?.[argument]?.values ?? [];
};

let counter = 0;
const id = () => `id-${(counter += 1)}`;

describe('the motion catalogue and the manifest name the same things', () => {
  it('offers every trigger the catalogue describes, and only those', () => {
    expect([...offered('motion.add', 'trigger')].sort()).toEqual([...TRIGGER_KINDS].sort());
    expect(TRIGGER_KINDS).toHaveLength(43);
  });

  it('offers every action the catalogue describes, and only those', () => {
    expect([...offered('motion.addAction', 'kind')].sort()).toEqual([...EFFECT_KINDS].sort());
    expect(EFFECT_KINDS).toHaveLength(24);
  });

  it('offers the runtime behaviours the model stores', () => {
    expect([...offered('motion.removeBehaviour', 'behaviour')].sort()).toEqual([...RUNTIME_BEHAVIOURS].sort());
  });
});

describe('every default of the catalogue is a valid value', () => {
  it('makes, for every trigger, an interaction the strict reader takes', () => {
    for (const kind of TRIGGER_KINDS) {
      const spec = TRIGGERS[kind];
      const read = readInteraction({ id: 'm', trigger: defaultTrigger(kind, 'desktop'), timeline: 'Hero click', control: spec.continuous ? 'scrub' : 'play', ...(spec.paired ? { leave: 'reverse' } : {}) });
      expect(read.ok, `${kind}: ${read.ok ? '' : JSON.stringify(read.issues)}`).toBe(true);
    }
  });

  it('makes, for every action, an action the strict reader takes inside a timeline', () => {
    const actions = EFFECT_KINDS.map((kind) => ({ id: id(), target: { kind: 'self' }, start: 0, duration: EFFECTS[kind].duration, effect: defaultEffect(kind, id) }));
    const read = readTimeline({ id: 't', name: 'Every action', actions, markers: [] });
    expect(read.ok, read.ok ? '' : JSON.stringify(read.issues)).toBe(true);
  });

  it('starts an animation and split text keying nothing, as a new CSS animation does', () => {
    expect(defaultEffect('animate', id)).toEqual({ kind: 'animate', tracks: [] });
    expect(defaultEffect('split-text', id)).toEqual({ kind: 'split-text', by: 'word', tracks: [] });
  });

  it('gives every parameter of a trigger a default, a long press half a second', () => {
    expect(defaultTrigger('long-press', 'desktop')).toEqual({ kind: 'long-press', milliseconds: 500 });
    expect(defaultTrigger('breakpoint', 'tablet')).toEqual({ kind: 'breakpoint', breakpoint: 'tablet' });
    expect(defaultTrigger('key', 'desktop')).toEqual({ kind: 'key', key: 'Enter' });
    expect(defaultTrigger('click', 'desktop')).toEqual({ kind: 'click' });
  });
});

describe('where a trigger applies', () => {
  it('offers form triggers on a form, media triggers on media, dialog triggers on a dialog', () => {
    expect(applicableTriggers({ tag: 'section' })).not.toContain('form-submit');
    expect(applicableTriggers({ tag: 'form' })).toEqual(expect.arrayContaining(['form-submit', 'form-invalid', 'input', 'change', 'click']));
    expect(applicableTriggers({ tag: 'video' })).toEqual(expect.arrayContaining(['media-play', 'media-time']));
    expect(applicableTriggers({ tag: 'p' })).not.toContain('media-play');
    expect(applicableTriggers({ tag: 'dialog' })).toEqual(expect.arrayContaining(['dialog-open', 'dialog-close']));
    expect(applicableTriggers({ tag: 'details' })).toContain('details-open');
    expect(applicableTriggers({ tag: null })).not.toContain('input');
  });
});

describe('a target from its field', () => {
  it('names a class, a component or a picked element by its value, and the relative kinds by themselves', () => {
    expect(targetOf('children', null)).toEqual({ kind: 'children' });
    expect(targetOf('class', ' card ')).toEqual({ kind: 'class', className: 'card' });
    expect(targetOf('descendants', 'item')).toEqual({ kind: 'descendants', className: 'item' });
    expect(targetOf('component', 'Card')).toEqual({ kind: 'component', component: 'Card' });
    expect(targetOf('element', 'n-1')).toEqual({ kind: 'element', node: 'n-1' });
    expect(targetOf('class', '')).toBeNull();
    expect(TARGET_KINDS).toHaveLength(11);
  });
});
