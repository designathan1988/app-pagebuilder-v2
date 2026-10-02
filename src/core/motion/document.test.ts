import { describe, expect, it } from 'vitest';
import type { DocumentJson, NodeId } from '../document/model.ts';
import { applyPatches } from '../history/transaction.ts';
import { documentOf, node } from '../testing/handlers.ts';
import { addressedMotionNodes, motionProblems, motionStandIns, releaseMotionTargets, renameTimelinePatches, timelineUses, treeUsesMotion, uniqueTimelineName } from './document.ts';
import { configText, motionConfig, siteUsesLottie, timelinesNeeded } from './export.ts';
import type { MotionInteraction, MotionTimeline } from './model.ts';

const interaction = (timeline: string, fields: Partial<MotionInteraction> = {}): MotionInteraction => ({ id: `m-${timeline}`, trigger: { kind: 'click' }, timeline, control: 'play', ...fields });
const fade = (name: string, extra: MotionTimeline['actions'] = []): MotionTimeline => ({
  id: `t-${name}`,
  name,
  markers: [],
  actions: [{ id: `a-${name}`, target: { kind: 'self' }, start: 0, duration: 600, effect: { kind: 'animate', tracks: [{ id: `k-${name}`, property: 'opacity', keyframes: [{ id: `f-${name}`, time: 0, value: '0' }] }] } }, ...extra],
});

function project(fields: Partial<DocumentJson> = {}, heroMotions: readonly MotionInteraction[] = [interaction('Intro')]): DocumentJson {
  return documentOf({
    pages: [
      {
        id: 'p',
        name: 'Home',
        file: 'index.html',
        tree: node('root', 'page', 'body', {
          name: 'Page',
          children: [
            node('hero', 'section', 'section', { name: 'Hero', motions: heroMotions, children: [node('intro', 'paragraph', 'p', { name: 'Intro', text: 'Hi' })] }),
            node('card', 'article', 'article', { name: 'Card', classes: ['card'], behaviours: [{ kind: 'parallax', amount: 0.3, axis: 'y' }] }),
          ],
        }),
      },
    ],
    motionTimelines: [
      fade('Intro', [{ id: 'pick', target: { kind: 'element', node: 'intro' as NodeId }, start: 600, duration: 0, effect: { kind: 'timeline', operation: 'play', timeline: 'Outro' } }]),
      fade('Outro'),
      fade('Unused'),
    ],
    ...fields,
  });
}

describe('the motion data of a document', () => {
  it('is valid as the model holds it', () => {
    expect(motionProblems(project())).toEqual([]);
  });

  it('refuses a timeline played that the project lacks, a picked element that is gone, a name made twice', () => {
    const broken = project({ motionTimelines: [fade('Intro', [{ id: 'pick', target: { kind: 'element', node: 'gone' as NodeId }, start: 0, duration: 0, effect: { kind: 'timeline', operation: 'play', timeline: 'Missing' } }]), fade('Intro')] });
    expect(motionProblems(broken).map((problem) => problem.path)).toEqual(['/motionTimelines/1/name', '/motionTimelines/0/actions/1/target', '/motionTimelines/0/actions/1/effect/timeline']);
    const orphan = project({ motionTimelines: [fade('Outro')] });
    expect(motionProblems(orphan).map((problem) => problem.path)).toEqual(['/pages/0/tree/children/0/motions/0/timeline']);
  });

  it('refuses an empty list where the model holds none, and a behaviour set twice', () => {
    const empty = project({ motionTimelines: [] });
    expect(motionProblems(empty)[0]?.path).toBe('/motionTimelines');
    const twice = documentOf({ pages: [{ id: 'p', name: 'Home', file: 'index.html', tree: node('root', 'page', 'body', { children: [node('x', 'div', 'div', { behaviours: [{ kind: 'marquee', amount: 60 }, { kind: 'marquee', amount: 30 }] })] }) }] });
    expect(motionProblems(twice).map((problem) => problem.path)).toEqual(['/pages/0/tree/children/0/behaviours/1/kind']);
  });

  it('counts what plays or controls a timeline', () => {
    expect(timelineUses(project(), 'Intro')).toEqual({ interactions: 1, actions: 0 });
    expect(timelineUses(project(), 'Outro')).toEqual({ interactions: 0, actions: 1 });
    expect(timelineUses(project(), 'Unused')).toEqual({ interactions: 0, actions: 0 });
  });

  it('names a new timeline once', () => {
    expect(uniqueTimelineName(project(), 'Intro')).toBe('Intro 2');
    expect(uniqueTimelineName(project(), 'Fresh')).toBe('Fresh');
    expect(uniqueTimelineName(project(), '   ')).toBe('Timeline');
  });

  it('renames a timeline with every interaction and action that names it', () => {
    const renamed = applyPatches(project(), renameTimelinePatches(project(), 'Outro', 'Farewell')).document;
    expect(renamed.motionTimelines?.map((one) => one.name)).toEqual(['Intro', 'Farewell', 'Unused']);
    expect(renamed.motionTimelines?.[0]?.actions[1]?.effect).toEqual({ kind: 'timeline', operation: 'play', timeline: 'Farewell' });
    const again = applyPatches(project(), renameTimelinePatches(project(), 'Intro', 'Welcome')).document;
    expect(again.pages[0]?.tree.children[0]?.motions?.[0]?.timeline).toBe('Welcome');
    expect(motionProblems(again)).toEqual([]);
  });

  it('lets an action that picked a leaving element go with it', () => {
    const released = applyPatches(project(), releaseMotionTargets(project(), new Set(['intro' as NodeId]))).document;
    expect(released.motionTimelines?.[0]?.actions.map((one) => one.id)).toEqual(['a-Intro']);
    expect(releaseMotionTargets(project(), new Set(['card' as NodeId]))).toEqual([]);
  });

  it('addresses the elements that hold motion and the elements an action picked', () => {
    expect([...addressedMotionNodes(project())].sort()).toEqual(['card', 'hero', 'intro']);
    expect(treeUsesMotion(project().pages[0]?.tree ?? node('x', 'div', 'div'))).toBe(true);
  });

  it('gives a scenario\'s motion objects stand-in ids and resolves a picked element by its path', () => {
    const expected: Record<string, unknown> = JSON.parse(JSON.stringify({ pages: [{ tree: { motions: [{ trigger: { kind: 'click' } }], children: [] } }], motionTimelines: [{ name: 'T', markers: [{ name: 'M', time: 0 }], actions: [{ target: { kind: 'element', node: '@/Page/Intro' }, effect: { kind: 'animate', tracks: [{ property: 'opacity', keyframes: [{ time: 0, value: '1' }] }] } }] }] }));
    let next = 0;
    motionStandIns(expected, () => `~${(next += 1)}`, (path) => (path === '/Page/Intro' ? 'intro' : null));
    const timelines = expected.motionTimelines as { id: string; markers: { id: string }[]; actions: { id: string; target: { node: string }; effect: { tracks: { id: string; keyframes: { id: string }[] }[] } }[] }[];
    expect(timelines[0]?.id).toMatch(/^~/);
    expect(timelines[0]?.markers[0]?.id).toMatch(/^~/);
    expect(timelines[0]?.actions[0]?.target.node).toBe('intro');
    expect(timelines[0]?.actions[0]?.effect.tracks[0]?.keyframes[0]?.id).toMatch(/^~/);
    expect(((expected.pages as { tree: { motions: { id: string }[] } }[])[0]?.tree.motions[0]?.id)).toMatch(/^~/);
  });
});

describe('the data the page\'s motion script is given', () => {
  const inputs = { selectorOf: (id: NodeId) => (id === 'root' ? null : `.${id}`), breakpoints: [{ id: 'desktop', width: 1440, base: true }, { id: 'phone', width: 390, base: false }], playedClassName: (name: string) => `anim-${name}` };

  it('writes the timelines something plays, with the ones those control, and leaves a library timeline out', () => {
    expect(timelinesNeeded(project()).map((one) => one.name)).toEqual(['Intro', 'Outro']);
    const config = motionConfig(project(), inputs);
    expect(Object.keys(config?.timelines ?? {})).toEqual(['Intro', 'Outro']);
    expect(config?.bindings).toEqual([{ selector: '.hero', interaction: { trigger: { kind: 'click' }, timeline: 'Intro', control: 'play' } }]);
    expect(config?.behaviours).toEqual([{ selector: '.card', behaviour: { kind: 'parallax', amount: 0.3, axis: 'y' } }]);
    // a picked element is written as the selector the page finds it by
    expect(config?.timelines.Intro?.actions[1]?.target).toEqual({ kind: 'selector', selector: '.intro' });
    expect(motionConfig(project(), { ...inputs, everyTimeline: true })?.timelines.Unused).toBeDefined();
  });

  it('binds an interaction applied to a class to every element of that class', () => {
    const scoped = project({}, [interaction('Intro', { scope: 'card' })]);
    expect(motionConfig(scoped, inputs)?.bindings[0]?.selector).toBe('.card');
  });

  it('writes nothing for a project without motion, and the Lottie data only when a played timeline uses it', () => {
    const none = documentOf({ pages: [{ id: 'p', name: 'Home', file: 'index.html', tree: node('root', 'page', 'body') }] });
    expect(motionConfig(none, inputs)).toBeNull();
    expect(siteUsesLottie(project())).toBe(false);
    const bytes = Buffer.from(JSON.stringify({ v: '5.7.0', fr: 30, ip: 0, op: 60, layers: [] })).toString('base64');
    const lottie = project({
      files: [{ path: 'img/hero.json', type: 'application/json', bytes }],
      motionTimelines: [fade('Intro', [{ id: 'l', target: { kind: 'self' }, start: 0, duration: 0, effect: { kind: 'lottie', file: 'img/hero.json', operation: 'play', loop: true, speed: 1 } }])],
    });
    expect(siteUsesLottie(lottie)).toBe(true);
    expect(motionConfig(lottie, inputs)?.lottie['img/hero.json']).toEqual({ v: '5.7.0', fr: 30, ip: 0, op: 60, layers: [] });
  });

  it('writes JSON that can stand inside a script element', () => {
    const config = motionConfig(project({ motionTimelines: [fade('Intro', [{ id: 't', target: { kind: 'self' }, start: 0, duration: 0, effect: { kind: 'text', value: '</script><b> ' } }])] }), inputs);
    const text = configText(config ?? (() => { throw new Error('no config'); })());
    expect(text).not.toContain('</script');
    expect(text).not.toContain(' ');
    expect(JSON.parse(text).timelines.Intro.actions[1].effect.value).toBe('</script><b> ');
  });
});
