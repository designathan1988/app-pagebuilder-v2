// The address a person types in Open a web address (src/editor/import/capture.ts captureAddress, spec capture-url).
import { describe, expect, it } from 'vitest';
import { captureAddress } from './capture.ts';

describe('a web address to capture', () => {
  it('reads a bare host as https, and this machine as http', () => {
    expect(captureAddress('example.com')).toBe('https://example.com/');
    expect(captureAddress('localhost:8080/about')).toBe('http://localhost:8080/about');
    expect(captureAddress('127.0.0.1:5421/')).toBe('http://127.0.0.1:5421/');
    expect(captureAddress('http://example.com/a')).toBe('http://example.com/a');
  });
  it('is none for a text that is no web address', () => {
    expect(captureAddress('not an address')).toBeNull();
    expect(captureAddress('ftp://example.com')).toBeNull();
    expect(captureAddress('')).toBeNull();
  });
});
