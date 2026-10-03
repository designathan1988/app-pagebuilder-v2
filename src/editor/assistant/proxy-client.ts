export function companionFetch(base: string, token: string, fetcher: typeof fetch = fetch): typeof fetch {
  const endpoint = new URL('/provider/stream', base);
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1') throw new Error('Provider proxy must be loopback');
  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input), headers = new Headers(init?.headers);
    if (typeof init?.body !== 'string') throw new Error('Provider proxy expects a JSON request');
    return fetcher(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ url, apiKey: headers.get('x-api-key'), body: init.body }), ...(init.signal ? { signal: init.signal } : {}), redirect: 'error', cache: 'no-store' });
  };
}
