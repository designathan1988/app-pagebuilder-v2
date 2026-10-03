// The real-provider check's picture is a PNG the provider can read: its signature, a 1200 × 800 header, and pixels the
// browser decodes as the wireframe (a dark band over two light columns).
import { describe, expect, it } from 'vitest';
import { wireframe } from './real-check.ts';

describe('the assistant check\'s wireframe', () => {
  it('is a 1200 × 800 PNG, small enough for an image block', () => {
    const png = Buffer.from(wireframe());
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 800]);
    expect(png.length).toBeLessThan(5 * 1024 * 1024);
  });
});
