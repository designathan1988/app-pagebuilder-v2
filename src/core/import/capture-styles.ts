import { parse, walk, generate } from 'css-tree';
interface CapturePage { readonly file: string; readonly tree?: { readonly attributes: Readonly<Record<string, unknown>> } }
/** The capture importer preserves one residual sheet per page; files remain the existing project-file owner. */
export function capturedPageStylePath(page: CapturePage): string {
  const linked = page.tree?.attributes.pageCaptureStyle;
  if (typeof linked === 'string' && linked) return linked;
  return page.file.replace(/\.html$/i, '') + '.capture.css';
}
export function capturedPageCss(document: { readonly files?: readonly { readonly path: string; readonly bytes: string }[] }, page: CapturePage): string {
  const file = document.files?.find(file => file.path === capturedPageStylePath(page));
  return file ? new TextDecoder().decode(Uint8Array.from(atob(file.bytes), char => char.charCodeAt(0))) : '';
}
/** Resolves relative sheet assets before handing the address to the existing file URL owner. */
export function captureAssetPath(page: CapturePage, address: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(address)) return address;
  const base = new URL(capturedPageStylePath(page), 'https://capture.invalid/');
  const value = new URL(address, base);
  return value.pathname.slice(1) + value.search + value.hash;
}
/** Existing class/file owners call this for residual CSS during their normal transactions. */
export function rewriteCapturedCss(bytes: string, sheet: string, classes: ReadonlyMap<string, string>, rewrite: (path: string) => string): string {
 const source = new TextDecoder().decode(Uint8Array.from(atob(bytes), char => char.charCodeAt(0)));
 const ast = parse(source);
 let changed = false;
 const relative = (target: string): string => {
   const from = rewrite(sheet).split('/').slice(0,-1), to = target.split('/');
   while (from[0] && from[0] === to[0]) {
     from.shift();
     to.shift();
   }
   return '../'.repeat(from.length) + to.join('/');
 };
 walk(ast, node => {
  if (node.type === 'ClassSelector') {
    const renamed = classes.get(node.name);
    if (renamed && renamed !== node.name) {
      node.name=renamed;
      changed=true;
    }
  }
  if (node.type === 'Url' && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(node.value)) {
   const url = new URL(node.value,new URL(sheet,'https://capture.invalid/'));
   const next = relative(rewrite(url.pathname.slice(1))) + url.search + url.hash;
   if (next !== node.value) {
     node.value=next;
     changed=true;
   }
  }
 });
 if (!changed) return bytes;
 let binary = '';
 for (const byte of new TextEncoder().encode(generate(ast))) binary += String.fromCharCode(byte);
 return btoa(binary);
}
