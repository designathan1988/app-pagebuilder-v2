// The system clipboard (PRODUCT.md §5): the one reader of the browser's clipboard, and the keeper of the editor's
// own copy. A command that takes what the clipboard holds (an argument of type "clipboard" in the manifest:
// clipboard.paste, text.paste) runs once its door has read it here, with its content as data (ClipboardContent): its
// HTML as a tree of texts and elements (parsed into an inert document that runs nothing), its plain text, or the
// browser's refusal. The command decides what to make of it.
//
// The editor's own copy: what the last copy or cut wrote (the clipboard port's write, the app's element format),
// kept here so copying and pasting works inside the editor whatever the browser allows (the user's real-use audit,
// item 3.8: with the read permission denied, Ctrl+C and Ctrl+V still work); the system clipboard is the complement,
// what the editor reads when it holds something and what another tab or application reads.
import type { ClipboardContent, ClipboardNode } from '../generated/commands.ts';
import type { ClipboardWriter } from '../core/ports/clipboard.ts';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

// the texts and elements of a parsed document's body, each element with its tag, its href and its children
function nodesOf(parent: Node): ClipboardNode[] {
  const out: ClipboardNode[] = [];
  for (const child of parent.childNodes) {
    if (child.nodeType === TEXT_NODE) out.push(child.nodeValue ?? '');
    else if (child.nodeType === ELEMENT_NODE) {
      const element = child as Element;
      out.push({ tag: element.localName, href: element.getAttribute('href'), children: nodesOf(element.localName === 'template' ? (element as HTMLTemplateElement).content : element) });
    }
  }
  return out;
}

async function textOf(item: ClipboardItem, type: string): Promise<string | null> {
  if (!item.types.includes(type)) return null;
  const text = await (await item.getType(type)).text();
  return text === '' ? null : text;
}

// What the system clipboard holds now. The browser asks the person once whether the editor may read it; refused,
// the content says so. An empty clipboard, or one holding neither HTML nor text, holds nothing.
async function systemClipboard(): Promise<ClipboardContent> {
  let items: ClipboardItems;
  try {
    items = await navigator.clipboard.read();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') return { status: 'denied' };
    return { status: 'read', html: null, text: null, markup: null };
  }
  let html: string | null = null;
  let text: string | null = null;
  for (const item of items) {
    html ??= await textOf(item, 'text/html');
    text ??= await textOf(item, 'text/plain');
  }
  // the markup as it is, beside the tree: the HTML importer reads it (spec clipboard-paste-external), the tree serves
  // the text editing surface (core/text/inline.ts pastedRuns)
  return { status: 'read', html: html === null ? null : nodesOf(new DOMParser().parseFromString(html, 'text/html').body), text, markup: html };
}

// the text the editor's last copy or cut wrote; null until it writes one
let own: string | null = null;

// What a command that takes the clipboard runs with: what the system clipboard holds when it holds something (what
// the person last copied anywhere), else the editor's own copy; when it holds none either, the browser's refusal
// stands. Nothing in the editor's own copy is read back after a reload: the system clipboard carries it then.
export async function readClipboard(): Promise<ClipboardContent> {
  const read = await systemClipboard();
  if (read.status === 'read' && (read.text !== null || read.html !== null)) return read;
  if (own === null) return read;
  return { status: 'read', html: null, text: own, markup: null };
}

// The browser's side of the clipboard port (src/core/ports/clipboard.ts): what a command copies becomes the editor's
// own copy and is written to the system clipboard, as text and, when the command wrote one, as the exported markup
// beside it (one ClipboardItem, so another application pastes the markup while the editor's own paste reads the app
// format), with the CSS rules the markup uses in the item's `web text/css` part: Chrome turns a <style> element
// written with the html into inline styles on the elements, which the copied markup must not carry (spec
// clipboard-cut-system). A browser that refuses the write leaves the system clipboard as it was, the editor's own
// copy standing.
export const browserClipboard: ClipboardWriter = {
  write(content) {
    own = content.text;
    const html = content.html;
    const written =
      html === undefined
        ? navigator.clipboard.writeText(content.text)
        : navigator.clipboard.write([
            new ClipboardItem({
              'text/plain': new Blob([content.text], { type: 'text/plain' }),
              'text/html': new Blob([html], { type: 'text/html' }),
              ...(content.css === undefined ? {} : { 'web text/css': new Blob([content.css], { type: 'web text/css' }) }),
            }),
          ]);
    void written.catch(() => {
      // the browser refused the multi-part write (a permission): the text alone still reaches the system clipboard
      if (html !== undefined) void navigator.clipboard.writeText(content.text).catch(() => undefined);
    });
  },
};
