import type { DocumentJson } from '../../core/document/model.ts';
import { dataUrl } from '../../core/files/files.ts';
import { fontFaceCss, fontFiles } from '../../core/files/fonts.ts';
import { canvasDocument, canvasFrame } from './coordinates.ts';

/** Capture the authored page at its current canvas width, excluding the editor and its preferences. */
export async function captureCanvasPng(document: DocumentJson): Promise<{ data: string; mimeType: 'image/png' }> {
  const frame = canvasFrame();
  const page = canvasDocument();
  if (!frame || !page?.body) throw new Error('assistant.canvasUnavailable');
  await page.fonts.ready;
  const width = Math.ceil(Math.max(frame.clientWidth, page.documentElement.scrollWidth));
  const height = Math.ceil(Math.max(frame.clientHeight, page.documentElement.scrollHeight));
  if (width <= 0 || height <= 0 || width * height > 32_000_000) throw new Error('assistant.canvasTooLarge');
  for (const image of page.querySelectorAll('img')) {
    try { await image.decode(); } catch { throw new Error('assistant.canvasResourceFailed'); }
    if (image.naturalWidth === 0) throw new Error('assistant.canvasResourceFailed');
  }
  const { toSvg } = await import('html-to-image');
  // The library otherwise leaves blank areas after a failed resource request. An invalid marker makes such
  // a capture fail explicitly; it is never rasterized or returned to a caller as a successful screenshot.
  const missing = 'data:image/png;base64,builder-resource-unavailable';
  const source = await toSvg(page.body, {
    width, height, pixelRatio: 1, includeQueryParams: true,
    fontEmbedCSS: fontFaceCss(fontFiles(document), file => dataUrl(file)),
    imagePlaceholder: missing,
    onImageErrorHandler: () => { throw new Error('assistant.canvasResourceFailed'); },
    filter: node => !['SCRIPT', 'NOSCRIPT'].includes(node.nodeName),
  });
  if (decodeURIComponent(source).includes(missing)) throw new Error('assistant.canvasResourceFailed');
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = window.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('assistant.canvasUnavailable');
  context.drawImage(image, 0, 0);
  const encoded = canvas.toDataURL('image/png');
  const data = encoded.slice(encoded.indexOf(',') + 1);
  if (!data || data.length > Math.ceil(5 * 1024 * 1024 * 4 / 3)) throw new Error('assistant.canvasTooLarge');
  return { data, mimeType: 'image/png' };
}
