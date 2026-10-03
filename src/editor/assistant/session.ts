import { runTurn, type ChatPorts, type TurnResult } from './chat.ts';
import type { CredentialVault } from './credentials.ts';
import { imageBlock, type ChatMessage, type ProviderSettings } from './provider.ts';
export interface SessionState { busy: boolean; error: 'assistant.cancelled' | 'assistant.failed' | 'assistant.modelUnavailable' | null; history: readonly ChatMessage[] }
export interface SessionPorts extends ChatPorts {
  // Production supplies editorTools.reserve to hold the real store lease before credential/network awaits.
  reserve?: () => () => void;
  vault: CredentialVault;
  settings(): Omit<ProviderSettings, 'apiKey'>;
  onState(state: SessionState): void;
}
export interface ReferenceImage { bytes: Uint8Array; mime: Parameters<typeof imageBlock>[1] }
// Conversation state only. Document changes belong exclusively to the injected store transaction.
export function createAssistantSession(ports: SessionPorts) {
  let messages: readonly ChatMessage[] = [], active: AbortController | null = null;
  const publish = (error: SessionState['error'] = null) => ports.onState({ busy: active !== null, error, history: messages });
  return {
    busy: () => active !== null,
    history: () => messages,
    clear() {
      if (active) throw new Error('Assistant is busy');
      messages = [];
      publish();
    },
    cancel() { active?.abort(new Error('Assistant cancelled')); },
    async send(text: string, reference?: ReferenceImage): Promise<TurnResult> {
      if (active) throw new Error('Assistant is busy');
      if (!text.trim() && !reference) throw new Error('Assistant input is empty');
      const controller = new AbortController();
      active = controller;
      publish();
      let release: (() => void) | undefined;
      try {
        release = ports.reserve?.();
        const apiKey = await ports.vault.read();
        controller.signal.throwIfAborted();
        if (!apiKey) throw new Error('Assistant API key is required');
        // the reference image before the words: the provider reads an image best when it comes first (Anthropic's
        // vision guide, platform.claude.com/docs/en/build-with-claude/vision)
        const content = [...(reference ? [imageBlock(reference.bytes, reference.mime)] : []), { type: 'text', text: text.trim() }];
        const result = await runTurn({ ...ports.settings(), apiKey }, [...messages, { role: 'user', content }], ports, controller.signal);
        controller.signal.throwIfAborted();
        messages = result.messages;
        active = null;
        publish();
        return result;
      } catch (error) {
        active = null;
        const unavailable = error instanceof Error && error.message === 'assistant.modelUnavailable';
        publish(controller.signal.aborted ? 'assistant.cancelled' : unavailable ? 'assistant.modelUnavailable' : 'assistant.failed');
        throw error;
      } finally { release?.(); }
    },
    dispose() {
      active?.abort(new Error('Assistant cancelled'));
      ports.vault.close();
    },
  };
}
