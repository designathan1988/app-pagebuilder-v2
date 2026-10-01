// @vitest-environment happy-dom
import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { expect, it, vi } from 'vitest';
import { publishOutsidePress } from '../input/pointer/views.ts';
import { useOutsideLayer } from './outside-layer.ts';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('a portal child protects its parent; outside presses dismiss both and cleanup removes them', () => {
  const parentClosed = vi.fn();
  const childClosed = vi.fn();
  function Nested() {
    const parent = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const child = useRef<HTMLDivElement>(null);
    useOutsideLayer(parent, true, parentClosed);
    useOutsideLayer(child, true, childClosed, trigger);
    return <><div ref={parent}><button ref={trigger} /></div>{createPortal(<div ref={child} data-child><button /></div>, document.body)}</>;
  }
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<Nested />));
  act(() => publishOutsidePress(document.querySelector('[data-child] button')));
  expect(parentClosed).not.toHaveBeenCalled();
  expect(childClosed).not.toHaveBeenCalled();
  act(() => publishOutsidePress(host.querySelector('button')));
  expect(parentClosed).not.toHaveBeenCalled();
  expect(childClosed).not.toHaveBeenCalled();
  act(() => publishOutsidePress(document.body));
  expect(parentClosed).toHaveBeenCalledTimes(1);
  expect(childClosed).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
  act(() => publishOutsidePress(document.body));
  expect(parentClosed).toHaveBeenCalledTimes(1);
  expect(childClosed).toHaveBeenCalledTimes(1);
  host.remove();
});
