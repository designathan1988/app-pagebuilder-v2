// The clipboard port (PRODUCT.md §5): the one way a command writes the system clipboard (clipboard.copy). A handler
// returns what to write in its outcome and stays pure; the store hands it to this port once the command has run. The
// editor's port writes the browser's clipboard (src/editor/clipboard.ts); tests pass one that records what it got, or
// none. What the clipboard holds is read by src/editor/clipboard.ts before a command that takes it runs.

export interface ClipboardWrite {
  // the text the clipboard holds as text/plain: the app's element format, readable back by clipboard.paste
  readonly text: string;
  // What the clipboard holds as text/html, when the command writes one: the exported markup of what was copied, for
  // another application (spec clipboard-cut-system), clean of editor attributes, node ids and inline styles. Chrome
  // rewrites a <style> element written with the html into inline styles on the element itself, so the markup travels
  // without one; the rules it uses go beside it, as `css`. Absent when there is no markup to write.
  readonly html?: string | undefined;
  // the CSS rules the markup uses, as the site's own writer writes them, in the item's own `web text/css` part (the
  // one place Chrome keeps a stylesheet as it is); absent when the copied elements set no styles
  readonly css?: string | undefined;
}

export interface ClipboardWriter {
  write(content: ClipboardWrite): void;
}
