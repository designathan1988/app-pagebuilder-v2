// The archive reader's bounds (the audit's AUD-10): what the central directory declares is checked before anything is
// unpacked, and inflating stops the moment an entry passes the size it declared, so an archive that lies in its headers
// never fills the tab's memory; paths that leave the archive's folder, headers that point outside the file and formats
// it cannot read are refused, each reason in the catalogue's words.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { archiveOf } from '../testing/archive.ts';
import { ARCHIVE_LIMITS, ArchiveError, archiveReason, unzip, zip } from './zip.ts';

const MEGABYTE = 1024 * 1024;
const encoder = new TextEncoder();

// bytes no inflater packs (a fixed sequence, so a failure replays)
function noise(size: number): Uint8Array {
  const out = new Uint8Array(size);
  let x = 2463534242;
  for (let i = 0; i < size; i += 1) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = x & 0xff;
  }
  return out;
}

// how many bytes the browser's inflater produced, whoever read them
let produced = 0;
function countInflatedBytes(): void {
  const Real = globalThis.DecompressionStream;
  produced = 0;
  class Counting {
    readonly writable: WritableStream<BufferSource>;
    readonly readable: ReadableStream<Uint8Array>;
    constructor(format: CompressionFormat) {
      const real = new Real(format);
      this.writable = real.writable;
      this.readable = real.readable.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            produced += chunk.length;
            controller.enqueue(chunk);
          },
        }),
      );
    }
  }
  vi.stubGlobal('DecompressionStream', Counting);
}

async function refusal(bytes: Uint8Array, limits = ARCHIVE_LIMITS): Promise<ArchiveError> {
  try {
    await unzip(bytes, limits);
  } catch (error) {
    if (error instanceof ArchiveError) return error;
    throw error;
  }
  throw new Error('the archive was read');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading an archive', () => {
  it('reads what the editor writes and what a ZIP tool deflates', { timeout: 30_000 }, async () => {
    // a page as a site holds one, about 1 MB, which packs about six times smaller
    const page = encoder.encode(Array.from({ length: 30_000 }, (_, i) => `<li class="plan plan--${i % 7}"><a href="/p/${(i * 7919) % 10007}">${(i * 104729) % 99991}</a></li>`).join('\n'));
    const stored = await unzip(zip([{ path: 'index.html', bytes: page }], 0));
    expect(stored.get('index.html')).toEqual(page);
    const deflated = await unzip(await archiveOf([{ path: 'site/index.html', bytes: page }, { path: 'site/img/', bytes: new Uint8Array(), stored: true }]));
    expect(deflated.get('site/index.html')).toEqual(page);
    expect([...deflated.keys()]).toEqual(['site/index.html', 'site/img/']);
  });

  it('stops inflating an entry the moment it passes the size its header declared', { timeout: 30_000 }, async () => {
    countInflatedBytes();
    // 32 MB of zeros packed into about 32 KB, declaring 50 KB (under the ratio's grace)
    const lying = await archiveOf([{ path: 'bomb.bin', bytes: new Uint8Array(32 * MEGABYTE), declaredSize: 50 * 1024 }]);
    const error = await refusal(lying);
    expect(error.reason).toEqual({ key: 'archive.damaged', params: { path: 'bomb.bin' } });
    expect(produced).toBeGreaterThan(50 * 1024);
    expect(produced).toBeLessThan(4 * MEGABYTE);
  });

  it('refuses an honest archive bigger than the limits before unpacking anything', { timeout: 30_000 }, async () => {
    countInflatedBytes();
    const limits = { ...ARCHIVE_LIMITS, entryBytes: 700 * 1024, totalBytes: MEGABYTE, entries: 3 };
    const part = (path: string, size: number): { path: string; bytes: Uint8Array } => ({ path, bytes: noise(size) });
    const total = await refusal(await archiveOf([part('a.bin', 600 * 1024), part('b.bin', 600 * 1024)]), limits);
    expect(total.reason).toEqual({ key: 'archive.tooLarge', params: { megabytes: 1 } });
    expect(total.limit).toBe(true);
    const entry = await refusal(await archiveOf([part('a.bin', 800 * 1024)]), limits);
    expect(entry.reason).toEqual({ key: 'archive.entryTooLarge', params: { path: 'a.bin', megabytes: 0 } });
    const many = await refusal(await archiveOf(['a', 'b', 'c', 'd'].map((name) => part(name, 10))), limits);
    expect(many.reason).toEqual({ key: 'archive.tooManyEntries', params: { count: 3 } });
    expect(produced).toBe(0);
  });

  it('refuses an entry that unpacks to more than a hundred times its packed size, past a grace of 100 KB', { timeout: 30_000 }, async () => {
    countInflatedBytes();
    const ratio = await refusal(await archiveOf([{ path: 'zeros.bin', bytes: new Uint8Array(MEGABYTE) }]));
    expect(ratio.reason).toEqual({ key: 'archive.ratio', params: { path: 'zeros.bin', ratio: 100 } });
    expect(produced).toBe(0);
    const small = await unzip(await archiveOf([{ path: 'zeros.bin', bytes: new Uint8Array(90 * 1024) }]));
    expect(small.get('zeros.bin')?.length).toBe(90 * 1024);
  });

  it('refuses a path that leaves the archive’s folder', async () => {
    for (const path of ['../evil.html', 'site/../../evil.html', '/etc/passwd', 'C:/Windows/evil.dll', 'site\\..\\evil.html', 'a\u0000b']) {
      const error = await refusal(await archiveOf([{ path, bytes: encoder.encode('x'), stored: true }]));
      expect(error.reason, path).toEqual({ key: 'archive.unsafePath', params: { path } });
    }
  });

  it('refuses headers that point outside the file, ZIP64 and an unknown compression, and bytes that are no archive', async () => {
    const archive = await archiveOf([{ path: 'a.txt', bytes: encoder.encode('hello'), stored: true }]);
    const directory = archive.length - 22 - (46 + 'a.txt'.length);
    const outside = archive.slice();
    new DataView(outside.buffer).setUint32(directory + 42, 1_000_000, true);
    expect((await refusal(outside)).reason).toEqual({ key: 'archive.broken', params: {} });
    const zip64 = archive.slice();
    new DataView(zip64.buffer).setUint32(directory + 24, 0xffffffff, true);
    expect((await refusal(zip64)).reason).toEqual({ key: 'archive.unsupported', params: { path: 'a.txt' } });
    const lzma = archive.slice();
    new DataView(lzma.buffer).setUint16(directory + 10, 14, true);
    expect((await refusal(lzma)).reason).toEqual({ key: 'archive.unsupported', params: { path: 'a.txt' } });
    expect((await refusal(encoder.encode('not an archive at all, not even close'))).reason).toEqual({ key: 'archive.notZip', params: {} });
  });

  it('reads a reason back only when it is one of the reader’s, whole', () => {
    expect(archiveReason({ key: 'archive.damaged', params: { path: 'a.txt', extra: 1 } })).toEqual({ key: 'archive.damaged', params: { path: 'a.txt' } });
    expect(archiveReason({ key: 'archive.damaged', params: {} })).toBeNull();
    expect(archiveReason({ key: 'status.open.opened', params: {} })).toBeNull();
    expect(archiveReason('archive.broken')).toBeNull();
    expect(archiveReason({ key: 'archive.damaged', params: { path: { key: 'x' } } })).toBeNull();
  });
});
