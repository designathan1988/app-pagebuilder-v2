// ZIP archives (PRODUCT.md §5): the one writer of the archives the editor hands out (File › Save project's
// project.zip; the export's ZIP). Standard ZIP (APPNOTE 6.3): each entry stored without compression, its name in
// UTF-8 (general purpose flag 11), its CRC-32 and its modification time; the same entries at the same time always
// give the same bytes. Pure: no DOM, no clock (the caller passes the time, from the clock port). And the one reader of
// the archives the person chooses (a project, an imported site, a spreadsheet), within declared bounds (`unzip`).
import type { MessageId } from '../../generated/ids.ts';

export interface ZipEntry {
  // the entry's path inside the archive, with "/" between folders
  readonly path: string;
  readonly bytes: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// A time in milliseconds as MS-DOS date and time fields (2-second resolution, from 1980), in UTC so the same moment
// gives the same bytes wherever the archive is written.
function dosTime(ms: number): { readonly time: number; readonly date: number } {
  const at = new Date(Math.max(ms, Date.UTC(1980, 0, 1)));
  return {
    time: (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | Math.floor(at.getUTCSeconds() / 2),
    date: ((at.getUTCFullYear() - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate(),
  };
}

const UTF8_NAMES = 0x0800;
const VERSION = 20;

// The archive of these entries, in their order, each modified at `modified` (milliseconds since the epoch).
export function zip(entries: readonly ZipEntry[], modified: number): Uint8Array {
  const encoder = new TextEncoder();
  const { time, date } = dosTime(modified);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, VERSION, true);
    l.setUint16(6, UTF8_NAMES, true);
    l.setUint16(8, 0, true);
    l.setUint16(10, time, true);
    l.setUint16(12, date, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, entry.bytes.length, true);
    l.setUint32(22, entry.bytes.length, true);
    l.setUint16(26, name.length, true);
    l.setUint16(28, 0, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, VERSION, true);
    c.setUint16(6, VERSION, true);
    c.setUint16(8, UTF8_NAMES, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, entry.bytes.length, true);
    c.setUint32(24, entry.bytes.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local, entry.bytes);
    centrals.push(central);
    offset += local.length + entry.bytes.length;
  }
  const directorySize = centrals.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// Whether bytes start as a ZIP archive does (a local file header).
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

// The bounds an archive the person chose is read within (the audit's AUD-10: every entry was inflated whole, whatever
// its header declared, so a few kilobytes could ask the tab for gigabytes). Two layers, as zip-bomb defences do: what
// the central directory declares is checked before anything is unpacked (the entries, each entry's size, their total,
// and how many times its packed size an entry unpacks to, above a grace size, Apache POI's 0.01 inflate ratio and
// 100 KB grace), and inflating counts the bytes as they come and stops the moment an entry passes what it declared,
// so an archive that lies in its headers is refused before it is unpacked.
export interface ArchiveLimits {
  readonly entries: number;
  readonly entryBytes: number;
  readonly totalBytes: number;
  // how many times its packed size an entry may unpack to, once it is past `graceBytes`
  readonly ratio: number;
  readonly graceBytes: number;
}

const MEGABYTE = 1024 * 1024;
export const ARCHIVE_LIMITS: ArchiveLimits = { entries: 10_000, entryBytes: 128 * MEGABYTE, totalBytes: 256 * MEGABYTE, ratio: 100, graceBytes: 100 * 1024 };

// Why an archive cannot be read, in the catalogue's words: a message whose parameters are words and numbers, which the
// caller puts in its refusal (and which travels as data, a command's argument).
export interface ArchiveReason {
  readonly key: MessageId;
  readonly params: Readonly<Record<string, string | number>>;
}
const reason = (key: MessageId, params: Readonly<Record<string, string | number>> = {}): ArchiveReason => ({ key, params });

// An archive that cannot be read, and why; `limit` when it is bigger than the bounds allow, so a caller can say "too
// large" in its own words.
export class ArchiveError extends Error {
  constructor(
    readonly reason: ArchiveReason,
    readonly limit = false,
  ) {
    super(reason.key);
  }
}

// The parameters each reason takes: a reason handed over as data (File › Open's text, an imported file's problem, both
// command arguments any caller can write) is read back only when it is one of these, whole.
const REASONS: Readonly<Record<string, readonly string[]>> = {
  'archive.broken': [],
  'archive.damaged': ['path'],
  'archive.entryTooLarge': ['path', 'megabytes'],
  'archive.noDocument': ['file'],
  'archive.notZip': [],
  'archive.ratio': ['path', 'ratio'],
  'archive.tooLarge': ['megabytes'],
  'archive.tooManyEntries': ['count'],
  'archive.unsafePath': ['path'],
  'archive.unsupported': ['path'],
};

export function archiveReason(value: unknown): ArchiveReason | null {
  if (value === null || typeof value !== 'object') return null;
  const { key, params } = value as { readonly key?: unknown; readonly params?: unknown };
  const names = typeof key === 'string' ? REASONS[key] : undefined;
  if (names === undefined || params === null || typeof params !== 'object') return null;
  const given = params as Readonly<Record<string, unknown>>;
  if (names.some((name) => typeof given[name] !== 'string' && typeof given[name] !== 'number')) return null;
  return reason(key as MessageId, Object.fromEntries(names.map((name) => [name, given[name] as string | number])));
}

const megabytes = (bytes: number): number => Math.floor(bytes / MEGABYTE);
const unsupported = (path: string): ArchiveError => new ArchiveError(reason('archive.unsupported', { path }));
const damaged = (path: string): ArchiveError => new ArchiveError(reason('archive.damaged', { path }));
const broken = (): ArchiveError => new ArchiveError(reason('archive.broken'));

// a path that would land outside the folder the archive is unpacked into (zip slip): absolute, a drive, a step up, a
// backslash (APPNOTE 4.4.17: a ZIP's separator is "/"), or a NUL
function unsafePath(path: string): boolean {
  return path === '' || path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.includes('\\') || path.includes('\u0000') || path.split('/').includes('..');
}

// An entry's deflated bytes, inflated chunk by chunk: refused the moment they pass the size the entry declared (which
// the bounds already checked), so nothing past it is ever held.
async function inflate(raw: Uint8Array, path: string, declared: number): Promise<Uint8Array> {
  const reader = new Blob([raw.slice().buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > declared) {
        await reader.cancel();
        throw damaged(path);
      }
      chunks.push(value);
    }
  } catch (error) {
    // a deflate stream that is broken, cut short or followed by more data (the Compression Streams standard's TypeError)
    throw error instanceof ArchiveError ? error : damaged(path);
  }
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

// Every entry of an archive by its path, read through its central directory, stored or deflated (as any ZIP tool
// writes it), within the limits; it throws an ArchiveError naming the problem on an archive it cannot read (no
// directory, a header pointing outside the file, an unknown compression or ZIP64, a size or a CRC-32 that does not
// match, a path outside its folder) or that is bigger than the limits allow.
export async function unzip(bytes: Uint8Array, limits: ArchiveLimits = ARCHIVE_LIMITS): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ArchiveError(reason('archive.notZip'));
  const count = view.getUint16(end + 10, true);
  if (count > limits.entries) throw new ArchiveError(reason('archive.tooManyEntries', { count: limits.entries }), true);
  const decoder = new TextDecoder();
  // the central directory first, whole: every entry's place, sizes and path, checked before anything is unpacked
  const listed: { path: string; method: number; crc: number; packed: number; size: number; start: number }[] = [];
  let total = 0;
  let at = view.getUint32(end + 16, true);
  for (let n = 0; n < count; n += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw broken();
    const nameLength = view.getUint16(at + 28, true);
    if (at + 46 + nameLength > bytes.length) throw broken();
    const path = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const packed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const local = view.getUint32(at + 42, true);
    if (unsafePath(path)) throw new ArchiveError(reason('archive.unsafePath', { path }));
    if (packed === 0xffffffff || size === 0xffffffff || local === 0xffffffff || (method !== 0 && method !== 8)) throw unsupported(path);
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) throw broken();
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + packed > bytes.length) throw broken();
    if (size > limits.entryBytes) throw new ArchiveError(reason('archive.entryTooLarge', { path, megabytes: megabytes(limits.entryBytes) }), true);
    total += size;
    if (total > limits.totalBytes) throw new ArchiveError(reason('archive.tooLarge', { megabytes: megabytes(limits.totalBytes) }), true);
    if (size > limits.graceBytes && size > packed * limits.ratio) throw new ArchiveError(reason('archive.ratio', { path, ratio: limits.ratio }), true);
    if (method === 0 && packed !== size) throw damaged(path);
    listed.push({ path, method, crc, packed, size, start });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  const entries = new Map<string, Uint8Array>();
  for (const { path, method, crc, packed, size, start } of listed) {
    const raw = bytes.subarray(start, start + packed);
    const data = method === 0 ? raw : await inflate(raw, path, size);
    if (data.length !== size || crc32(data) !== crc) throw damaged(path);
    entries.set(path, data);
  }
  return entries;
}
