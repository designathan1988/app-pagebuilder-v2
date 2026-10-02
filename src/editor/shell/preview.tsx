// The preview (DESIGN.md "Regions": preview-bar; spec preview-mode): while the editor previews (view/preview.ts), the
// preview bar replaces the top bar (its doors: the breakpoints, Exit preview, Export) and the page is shown as it is
// exported (core/export/export.ts previewPage), at the active breakpoint's width and at 100 %, in a frame of its own
// that runs it as a browser would (its scripts and embeds, its hover and details) and opens its links in a new tab:
// sandboxed, never the editing canvas. No selection, guides, handles, docks or rulers are drawn.
import { useEffect, useMemo } from 'react';
import { previewPage } from '../../core/export/export.ts';
import { siteScripts } from '../forms/script.ts';
import { openedPage } from '../../core/project/pages.ts';
import { viewportWidth } from '../view/breakpoints.ts';
import { MODEL_RULES, useEditorState } from '../store.ts';
import { useT } from '../text.ts';
import { Slots } from './slots.tsx';

export function PreviewBar() {
  return (
    <header className="preview-bar" data-region="preview-bar" data-key-context="preview">
      <Slots region="preview-bar" />
    </header>
  );
}

export function PreviewPage() {
  const t = useT();
  const document = useEditorState((s) => s.document);
  const width = useEditorState((s) => viewportWidth(s.ui));
  // the page the editor has open, never the project's first: previewing a second page must show that page (the
  // interface audit F03), and the memo re-runs when the open page changes
  const page = useEditorState((s) => openedPage(s));
  const html = useMemo(() => withKeyRelay(previewPage(document, MODEL_RULES, page, siteScripts)), [document, page]);
  // a key the page relays (KEY_RELAY) is pressed again on the preview bar, in the preview's key context, so the keymap
  // runs its door as if the editor had the focus
  useEffect(() => {
    const relay = (event: MessageEvent) => {
      // only the sandboxed preview page speaks from the opaque origin (the canvas frame shares the editor's)
      if (event.origin !== 'null' || event.source === null || event.source === window) return;
      const key = (event.data as { builderPreviewKey?: KeyboardEventInit } | null)?.builderPreviewKey;
      const bar = window.document.querySelector('[data-region="preview-bar"]');
      if (key === undefined || bar === null) return;
      bar.dispatchEvent(new KeyboardEvent('keydown', { ...key, bubbles: true, cancelable: true }));
    };
    window.addEventListener('message', relay);
    return () => window.removeEventListener('message', relay);
  }, []);
  return (
    <main className="preview-stage">
      <iframe className="preview__page" data-region="preview-page" title={t('preview.pageLabel')} srcDoc={html} sandbox="allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox" style={{ width }} />
    </main>
  );
}

// The page runs sandboxed in its own origin, so the editor hears none of its keys: once a visitor clicked in it, Escape
// (and Ctrl+Enter) no longer left the preview (the dogfooding pass). The preview's page alone — never the export —
// relays those two to the editor, unless the page uses Escape itself (a modal dialog open in it closes first).
const KEY_RELAY = `<script>addEventListener('keydown', function (e) {
  var leave = e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey));
  if (!leave || (e.key === 'Escape' && document.querySelector('dialog:modal'))) return;
  parent.postMessage({ builderPreviewKey: { key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey } }, '*');
}, true);</script>`;
const withKeyRelay = (html: string): string => (html.includes('</body>') ? html.replace('</body>', `${KEY_RELAY}</body>`) : html + KEY_RELAY);
