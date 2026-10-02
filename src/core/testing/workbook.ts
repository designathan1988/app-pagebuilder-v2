// Spreadsheets for tests (core/data/readers.ts): an XLSX workbook written as a spreadsheet program writes one — the
// workbook, its relationships, shared strings, number formats and one XML part per sheet, packed in a ZIP whose
// entries are deflated (as Excel and LibreOffice pack them) or stored. The cells say what each holds, so a test reads
// what it wrote: shared and inline strings, numbers, booleans, dates by their format, formulas with or without the
// value they were saved with, error cells and holes in a row.
import { crc32 } from '../project/zip.ts';

export type WorkbookCell =
  | string
  | number
  | boolean
  | null
  | { readonly inline: string }
  // a date serial shown by the built-in date format (14) or by a custom one (dd/mm/yyyy)
  | { readonly date: number; readonly format: 'builtin' | 'custom' }
  | { readonly formula: string; readonly cached?: number | string }
  | { readonly error: string };

export interface WorkbookSheet {
  readonly name: string;
  readonly rows: readonly (readonly WorkbookCell[])[];
  // a sheet the workbook reads from outside the file (an external relationship)
  readonly external?: boolean;
}

export interface WorkbookOptions {
  readonly date1904?: boolean;
  // stored entries instead of deflated ones
  readonly stored?: boolean;
  // a document type declared at the top of the first sheet (which a safe reader refuses)
  readonly doctype?: boolean;
}

const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The reference of a cell: its column's letters and its row's number ("C7").
export function cellReference(column: number, row: number): string {
  let letters = '';
  for (let n = column + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return `${letters}${row + 1}`;
}

function sheetXml(sheet: WorkbookSheet, shared: Map<string, number>, doctype: boolean): string {
  const rows = sheet.rows.map((cells, r) => {
    const xml = cells
      .map((cell, c) => {
        const at = cellReference(c, r);
        if (cell === null) return '';
        if (typeof cell === 'string') {
          if (!shared.has(cell)) shared.set(cell, shared.size);
          return `<c r="${at}" t="s"><v>${shared.get(cell)}</v></c>`;
        }
        if (typeof cell === 'number') return `<c r="${at}"><v>${cell}</v></c>`;
        if (typeof cell === 'boolean') return `<c r="${at}" t="b"><v>${cell ? 1 : 0}</v></c>`;
        if ('inline' in cell) return `<c r="${at}" t="inlineStr"><is><t>${escape(cell.inline)}</t></is></c>`;
        if ('date' in cell) return `<c r="${at}" s="${cell.format === 'builtin' ? 1 : 2}"><v>${cell.date}</v></c>`;
        if ('error' in cell) return `<c r="${at}" t="e"><v>${escape(cell.error)}</v></c>`;
        const kind = typeof cell.cached === 'string' ? ' t="str"' : '';
        const value = cell.cached === undefined ? '' : `<v>${escape(String(cell.cached))}</v>`;
        return `<c r="${at}"${kind}><f>${escape(cell.formula)}</f>${value}</c>`;
      })
      .join('');
    return `<row r="${r + 1}">${xml}</row>`;
  });
  const head = doctype ? '<!DOCTYPE worksheet [<!ENTITY x "x">]>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${head}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

// The parts of the workbook, by their path in the archive.
export function workbookParts(sheets: readonly WorkbookSheet[], options: WorkbookOptions = {}): { readonly path: string; readonly text: string }[] {
  const shared = new Map<string, number>();
  const sheetParts = sheets.map((sheet, i) => ({ path: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(sheet, shared, options.doctype === true && i === 0) }));
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${options.date1904 === true ? '<workbookPr date1904="1"/>' : '<workbookPr/>'}<sheets>${sheets.map((sheet, i) => `<sheet name="${escape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
  const relationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map((sheet, i) => (sheet.external === true ? `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="https://example.com/sheet.xml" TargetMode="External"/>` : `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`))
    .join('')}</Relationships>`;
  const strings = [...shared.keys()];
  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((text) => `<si><t xml:space="preserve">${escape(text)}</t></si>`).join('')}</sst>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`;
  return [
    { path: '[Content_Types].xml', text: types },
    { path: 'xl/workbook.xml', text: workbook },
    { path: 'xl/_rels/workbook.xml.rels', text: relationships },
    { path: 'xl/sharedStrings.xml', text: sharedStrings },
    { path: 'xl/styles.xml', text: styles },
    ...sheetParts,
  ];
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes.slice().buffer]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// The workbook's bytes: a ZIP archive of its parts, deflated unless told to store them.
export async function workbook(sheets: readonly WorkbookSheet[], options: WorkbookOptions = {}): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const part of workbookParts(sheets, options)) {
    const name = encoder.encode(part.path);
    const raw = encoder.encode(part.text);
    const packed = options.stored === true ? raw : await deflate(raw);
    const method = options.stored === true ? 0 : 8;
    const crc = crc32(raw);
    const local = new Uint8Array(30 + name.length + packed.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(8, method, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, packed.length, true);
    l.setUint32(22, raw.length, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(packed, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(10, method, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, packed.length, true);
    c.setUint32(24, raw.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const directory = centrals.reduce((n, entry) => n + entry.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, centrals.length, true);
  e.setUint16(10, centrals.length, true);
  e.setUint32(12, directory, true);
  e.setUint32(16, offset, true);
  const archive = new Uint8Array(offset + directory + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    archive.set(part, at);
    at += part.length;
  }
  return archive;
}
