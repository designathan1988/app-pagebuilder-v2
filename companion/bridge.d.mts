import type { IncomingMessage, ServerResponse } from 'node:http';
export interface EditorBridge {
  readonly token: string;
  readonly url: string;
  sessions(): string[];
  call(session: string, method: string, args: unknown, signal?: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}
export function createEditorBridge(options: {
  origins: string[];
  port?: number;
  timeoutMs?: number;
  onRequest?: (request: IncomingMessage, response: ServerResponse) => boolean | Promise<boolean>;
}): Promise<EditorBridge>;
