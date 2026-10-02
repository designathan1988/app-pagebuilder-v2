// A local Companion for the scenarios of the assistant (spec assistant-chat; the scenario setup's `companion`): the
// real authenticated bridge of companion/bridge.mjs, whose model is played here, so a scenario runs the assistant's
// doors as a person does — connecting with the connection file, sending, stopping — without any service or key.
//  - The model answers "Done." at once; a request whose text says [hold] is held open until the editor stops the turn
//    (the request closes), so Stop has a running turn to stop.
//  - The connection file is handed to the chooser Connect to Companion opens (the file input of the assistant panel).
import type { Page } from '../../tests/support/test.ts';
import { createEditorBridge } from '../../companion/bridge.mjs';

export const COMPANION_KEY = 'test-only-not-a-service-key';
const ASSISTANT_PANEL = '[data-region="assistant-panel"]';

export interface Companion {
  readonly connection: string;
  close(): Promise<void>;
}

export async function startCompanion(page: Page): Promise<Companion> {
  const bridge: Awaited<ReturnType<typeof createEditorBridge>> = await createEditorBridge({
    origins: [new URL(page.url()).origin],
    onRequest: async (request, response) => {
      // Use this editor for external tools: the session it names must be one the bridge holds, as companion/main.mjs
      // answers it
      if (request.url === '/session/select') {
        let text = '';
        for await (const part of request) text += String(part);
        const session = (JSON.parse(text) as { session?: unknown }).session;
        const known = typeof session === 'string' && bridge.sessions().includes(session);
        response.writeHead(known ? 200 : 409, { 'content-type': 'application/json' });
        response.end(known ? JSON.stringify({ selected: session }) : '');
        return true;
      }
      if (request.url !== '/provider/stream') return false;
      let body = '';
      for await (const part of request) body += String(part);
      const held = body.includes('[hold]');
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      const emit = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      emit('message_start', { message: { usage: { input_tokens: 1 } } });
      // a held turn ends only when the editor stops it (the request closes)
      if (held) return new Promise<boolean>((resolve) => request.once('close', () => resolve(true)));
      emit('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      emit('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'Done.' } });
      emit('content_block_stop', { index: 0 });
      emit('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } });
      emit('message_stop', {});
      response.end();
      return true;
    },
  });
  const connection = JSON.stringify({ version: 1, url: bridge.url, token: bridge.token });
  // the chooser Connect to Companion opens takes the connection file; any other chooser is the scenario's own
  page.on('filechooser', async (chooser) => {
    const isConnection = await chooser.element().evaluate((input, panel) => (input as HTMLInputElement).closest(panel) !== null && (input as HTMLInputElement).accept.includes('json'), ASSISTANT_PANEL);
    if (isConnection) await chooser.setFiles({ name: 'connection.json', mimeType: 'application/json', buffer: Buffer.from(connection) });
  });
  page.once('close', () => void bridge.close());
  return { connection, close: () => bridge.close() };
}
