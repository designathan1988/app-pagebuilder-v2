import { describe, expect, it } from 'vitest';
import { startOn } from './compose.ts';
import { config, fakePage } from './fake-page.ts';

describe('the behaviours', () => {
  it('scrolls the whole page smoothly from the body, and not when less motion is asked', () => {
    const page = fakePage('<main>Page</main>');
    const controller = startOn(page.win as unknown as Window, config({ behaviours: [{ selector: 'body', behaviour: { kind: 'smooth-scroll', amount: 0 } }] }), { mode: 'page' });
    expect(page.document.documentElement.style.getPropertyValue('scroll-behavior')).toBe('smooth');
    controller.dispose();
    expect(page.document.documentElement.style.getPropertyValue('scroll-behavior')).toBe('');
    page.reduceMotion(true);
    startOn(page.win as unknown as Window, config({ behaviours: [{ selector: 'body', behaviour: { kind: 'smooth-scroll', amount: 0 } }] }), { mode: 'page' });
    expect(page.document.documentElement.style.getPropertyValue('scroll-behavior')).toBe('');
  });

  it('moves a parallax element against the viewport\'s centre by its speed', () => {
    const page = fakePage('<div id="layer"></div>');
    const layer = page.document.querySelector('#layer') as HTMLElement;
    layer.getBoundingClientRect = () => ({ top: 650, height: 100, left: 0, width: 100, right: 100, bottom: 750, x: 0, y: 650, toJSON: () => ({}) }) as DOMRect;
    const controller = startOn(page.win as unknown as Window, config({ behaviours: [{ selector: '#layer', behaviour: { kind: 'parallax', amount: 0.5, axis: 'y' } }] }), { mode: 'page' });
    // its centre 700 against the viewport's 450: 250 px below, moved up by half of it
    expect(layer.style.getPropertyValue('translate')).toBe('0 -125px');
    controller.dispose();
    expect(layer.style.getPropertyValue('translate')).toBe('');
  });

  it('loops a marquee over a copy hidden from assistive technology and the keyboard, put back as it was', () => {
    const page = fakePage('<div id="ticker"><span>News</span><span>More</span></div>');
    const ticker = page.document.querySelector('#ticker') as HTMLElement;
    const spans = [...ticker.children];
    const controller = startOn(page.win as unknown as Window, config({ behaviours: [{ selector: '#ticker', behaviour: { kind: 'marquee', amount: 60, axis: 'x' } }] }), { mode: 'page' });
    const copy = ticker.querySelector('[aria-hidden="true"]');
    expect(copy?.hasAttribute('inert')).toBe(true);
    expect(copy?.textContent).toBe('NewsMore');
    expect(ticker.style.getPropertyValue('overflow')).toBe('hidden');
    controller.dispose();
    expect([...ticker.children]).toEqual(spans);
    expect(ticker.style.getPropertyValue('overflow')).toBe('');
  });

  it('makes an element follow the cursor, fixed and out of the pointer\'s way, given back when it stops', () => {
    const page = fakePage('<div id="dot" style="position: relative"></div>');
    const dot = page.document.querySelector('#dot') as HTMLElement;
    const controller = startOn(page.win as unknown as Window, config({ behaviours: [{ selector: '#dot', behaviour: { kind: 'cursor-follow', amount: 0 } }] }), { mode: 'page' });
    expect(dot.style.position).toBe('fixed');
    expect(dot.style.getPropertyValue('pointer-events')).toBe('none');
    page.win.dispatchEvent(new (page.win as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent('pointermove', { clientX: 300, clientY: 200 }) as never);
    page.tick(16);
    expect(dot.style.getPropertyValue('translate')).toBe('300px 200px');
    controller.dispose();
    expect(dot.style.position).toBe('relative');
    expect(dot.style.getPropertyValue('translate')).toBe('');
  });
});
