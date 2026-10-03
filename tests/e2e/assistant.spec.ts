import { test, expect } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';
import fs from 'node:fs';
import { createEditorBridge } from '../../companion/bridge.mjs';

const OPEN = 'workspace.setPanelOpen#toolbar-activity-bar-assistant';
const SETTINGS = 'assistant.setPreferences#assistant-preferences';
const SAVE = 'assistant.saveKey#assistant-save-key';
const REMOVE = 'assistant.deleteKey#assistant-delete-key';
test('the assistant stores a test key encrypted outside project data and removes it', runs(OPEN, SETTINGS, SAVE, REMOVE), async ({ page }) => {
  await openEditor(page);
  await runDoor(page, OPEN);
  await runDoor(page, SETTINGS);
  await expect(control(page, 'assistant.setModel#assistant-model').locator('input')).toHaveValue('claude-opus-5-5');
  const password = control(page, 'assistant.editKey#assistant-key').locator('input');
  await password.fill('test-only-not-a-service-key');
  await runDoor(page, SAVE);
  await expect(password).toHaveValue('');
  await expect(page.locator('[data-region="assistant-panel"]')).toContainText('Your key is saved on this device, outside the project.');
  const persisted = await page.evaluate(() => {
    const port = (window as unknown as { __builderTestPort: { document(): unknown; ui(): unknown } }).__builderTestPort;
    return JSON.stringify({ document: port.document(), local: { ...localStorage }, session: { ...sessionStorage } });
  });
  expect(persisted).not.toContain('test-only-not-a-service-key');
  const encrypted = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('assistant-credentials'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const value = await new Promise<unknown>((resolve, reject) => { const request = database.transaction('secrets').objectStore('secrets').get('credential'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    database.close();
    const stored = value as { iv: Uint8Array; encrypted: ArrayBuffer };
    return { nonce: stored.iv.length, encrypted: stored.encrypted.byteLength, plaintext: new TextDecoder().decode(stored.encrypted) };
  });
  expect(encrypted.nonce).toBe(12);
  expect(encrypted.encrypted).toBeGreaterThan(16);
  expect(encrypted.plaintext).not.toContain('test-only-not-a-service-key');
  await runDoor(page, REMOVE);
  await expect(page.locator('[data-region="assistant-panel"]')).toContainText('Add your own service key.');
});

test('streamed tool edits use one real undo entry, MCP reads the canvas, and Stop rolls back', runs(OPEN, SETTINGS, SAVE, 'assistant.connect#assistant-bridge-connect', 'assistant.send#assistant-send', 'assistant.cancel#assistant-cancel', 'history.undo#key-ctrl-z-in-global'), async ({ page }) => {
  page.on('console', message => { if (message.text().startsWith('Assistant turn failed:')) fs.appendFileSync('.cache/logs/assistant-stream-diagnostic.txt', `${message.text()}\n`); });
  await openEditor(page);
  await runDoor(page, 'workspace.setPanelOpen#toolbar-activity-bar-insert');
  await runDoor(page, 'element.insert#elements-tile', { args: { entry: 'button' } });
  const snapshot = () => page.evaluate(() => {
    const port = (window as unknown as { __builderTestPort: { document(): unknown; selection(): string[]; history(): { undoSteps: number } } }).__builderTestPort;
    return { document: port.document(), selection: port.selection(), history: port.history() };
  });
  const before = await snapshot();
  let requests = 0, cancelTurn = false;
  const bridge = await createEditorBridge({ origins: [new URL(page.url()).origin], onRequest: async (request, response) => {
    if (request.url !== '/provider/stream') return false;
    let body = ''; for await (const part of request) body += part;
    const proxy = JSON.parse(body) as { apiKey: string; body: string };
    expect(proxy.apiKey).toBe('test-only-not-a-service-key');
    const payload = JSON.parse(proxy.body) as { model: string };
    expect(payload.model).toBe('claude-opus-5-5');
    requests++;
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const emit = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    emit('message_start', { message: { usage: { input_tokens: 10 } } });
    if (requests % 2 === 1) {
      for (const [index, name, input] of [
        [0, 'element_rename', { target: before.selection[0], name: cancelTurn ? 'Temporary' : 'Send request' }],
        [1, 'element_setAttribute', { target: before.selection[0], attribute: 'title', value: cancelTurn ? 'Temporary title' : 'Created through the real tools' }],
      ] as const) {
        emit('content_block_start', { index, content_block: { type: 'tool_use', id: `call-${requests}-${index}`, name, input } });
        emit('content_block_stop', { index });
      }
      emit('message_delta', { delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 20 } });
    } else if (cancelTurn) {
      return true;
    } else {
      emit('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      emit('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'The button has been updated.' } });
      emit('content_block_stop', { index: 0 });
      emit('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } });
    }
    emit('message_stop', {}); response.end(); return true;
  } });
  try {
    await runDoor(page, OPEN); await runDoor(page, SETTINGS);
    await control(page, 'assistant.editKey#assistant-key').locator('input').fill('test-only-not-a-service-key');
    await runDoor(page, SAVE);
    await expect(page.locator('[data-region="assistant-panel"]')).toContainText('Your key is saved on this device');
    const chooser = page.waitForEvent('filechooser');
    await runDoor(page, 'assistant.connect#assistant-bridge-connect');
    await (await chooser).setFiles({ name: 'connection.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, url: bridge.url, token: bridge.token })) });
    await expect(page.locator('.assistant-connection')).toContainText('Companion connected');
    await runDoor(page, 'assistant.setPreferences#assistant-close-preferences');
    await control(page, 'assistant.update#assistant-input').locator('textarea').fill('Rename this button and add its tooltip.');
    await runDoor(page, 'assistant.send#assistant-send');
    await expect(page.locator('.assistant-chat__messages')).toContainText('The button has been updated.');
    await expect.poll(async () => (await snapshot()).history.undoSteps).toBe(before.history.undoSteps + 1);
    expect(JSON.stringify((await snapshot()).document)).toContain('Created through the real tools');
    const connected = bridge.sessions()[0];
    if (!connected) throw new Error('Missing authenticated browser session');
    const screenshot = await bridge.call(connected, 'builder_canvas_screenshot', {}) as { content: { type: string; data: string }[] };
    const image = screenshot.content.find(item => item.type === 'image');
    if (!image) throw new Error('Canvas screenshot was refused');
    const png = Buffer.from(image.data, 'base64');
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBeGreaterThan(300);
    fs.writeFileSync('.cache/logs/assistant-canvas-proof.png', png);
    await page.locator('[data-region="status-bar"]').click();
    await page.keyboard.press('Control+z');
    expect((await snapshot()).document).toEqual(before.document);
    cancelTurn = true;
    await control(page, 'assistant.update#assistant-input').locator('textarea').fill('Make another change.');
    await runDoor(page, 'assistant.send#assistant-send');
    await expect.poll(() => requests).toBe(4);
    await expect.poll(async () => JSON.stringify((await snapshot()).document)).toContain('Temporary title');
    const refused = await bridge.call(connected, 'element_rename', { target: before.selection[0], name: 'Unrelated edit' }) as { isError: boolean };
    expect(refused.isError).toBe(true);
    await runDoor(page, 'assistant.cancel#assistant-cancel');
    await expect.poll(async () => (await snapshot()).document).toEqual(before.document);
    expect((await snapshot()).history.undoSteps).toBe(before.history.undoSteps);
    await expect(page.locator('[data-region="status-bar"]')).toContainText('The assistant stopped.');
  } finally { await bridge.close(); }
});

// The assistant's vision path (plan G5, STG-14.3): a picture attached as the reference reaches the provider as an image
// block before the words (Anthropic's vision guide: an image reads best first), and the layout the provider answers
// with, through the Layout Composer's own tools, lands in the document as one undo step.
test('a reference picture reaches the provider first, and the layout it answers with is built in one undo step', runs(OPEN, SETTINGS, SAVE, 'assistant.connect#assistant-bridge-connect', 'assistant.attachReference#assistant-reference', 'assistant.send#assistant-send', 'history.undo#key-ctrl-z-in-global'), async ({ page }) => {
  page.on('console', message => { if (message.text().startsWith('Assistant turn failed:')) fs.appendFileSync('.cache/logs/assistant-vision-diagnostic.txt', `${message.text()}
`); });
  await openEditor(page);
  const snapshot = () => page.evaluate(() => {
    const port = (window as unknown as { __builderTestPort: { document(): unknown; history(): { undoSteps: number } } }).__builderTestPort;
    return { document: port.document() as { pages: { tree: { children: unknown[] } }[] }, history: port.history() };
  });
  const before = await snapshot();
  // a real picture: a part of the editor itself, as a person would attach a screenshot
  const picture = await page.screenshot({ clip: { x: 0, y: 0, width: 240, height: 160 } });
  const requests: { messages: { role: string; content: { type: string; [key: string]: unknown }[] }[]; tools: { name: string }[] }[] = [];
  const calls: readonly (readonly [string, Record<string, unknown>])[] = [
    ['layout_enter', {}],
    ['layout_stroke', { mode: 'draw', points: [{ x: 0, y: 0 }, { x: 1200, y: 120 }] }],
    ['layout_stroke', { mode: 'draw', points: [{ x: 0, y: 160 }, { x: 560, y: 600 }] }],
    ['layout_stroke', { mode: 'draw', points: [{ x: 640, y: 160 }, { x: 1200, y: 600 }] }],
    ['layout_leave', {}],
  ];
  const bridge = await createEditorBridge({ origins: [new URL(page.url()).origin], onRequest: async (request, response) => {
    if (request.url !== '/provider/stream') return false;
    let body = ''; for await (const part of request) body += part;
    const payload = JSON.parse((JSON.parse(body) as { body: string }).body) as (typeof requests)[number];
    requests.push(payload);
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const emit = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    emit('message_start', { message: { usage: { input_tokens: 10 } } });
    if (requests.length === 1) {
      calls.forEach(([name, input], index) => {
        emit('content_block_start', { index, content_block: { type: 'tool_use', id: `call-${index}`, name, input } });
        emit('content_block_stop', { index });
      });
      emit('message_delta', { delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 20 } });
    } else {
      emit('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      emit('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'The layout of the picture is built.' } });
      emit('content_block_stop', { index: 0 });
      emit('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } });
    }
    emit('message_stop', {}); response.end(); return true;
  } });
  try {
    await runDoor(page, OPEN); await runDoor(page, SETTINGS);
    await control(page, 'assistant.editKey#assistant-key').locator('input').fill('test-only-not-a-service-key');
    await runDoor(page, SAVE);
    const connection = page.waitForEvent('filechooser');
    await runDoor(page, 'assistant.connect#assistant-bridge-connect');
    await (await connection).setFiles({ name: 'connection.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, url: bridge.url, token: bridge.token })) });
    await expect(page.locator('.assistant-connection')).toContainText('Companion connected');
    await runDoor(page, 'assistant.setPreferences#assistant-close-preferences');
    const chooser = page.waitForEvent('filechooser');
    await runDoor(page, 'assistant.attachReference#assistant-reference');
    await (await chooser).setFiles({ name: 'wireframe.png', mimeType: 'image/png', buffer: picture });
    await expect(page.locator('.assistant-reference img')).toBeVisible();
    await control(page, 'assistant.update#assistant-input').locator('textarea').fill('Build this layout.');
    await runDoor(page, 'assistant.send#assistant-send');
    // the turn enters the Layout tool, whose panel takes the sidebar: the turn goes on, and the person opens the
    // assistant again to read its answer
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBe(2);
    await runDoor(page, OPEN);
    await expect(page.locator('.assistant-chat__messages')).toContainText('The layout of the picture is built.');
    // the first request: the picture's own bytes as a base64 image block, then the words; the composer's tools offered
    const asked = requests[0]?.messages.at(-1);
    expect(asked?.role).toBe('user');
    expect(asked?.content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: picture.toString('base64') } });
    expect(asked?.content[1]).toEqual({ type: 'text', text: 'Build this layout.' });
    expect(requests[0]?.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(['layout_enter', 'layout_stroke', 'layout_leave']));
    // the second: every tool's result, none refused
    const results = (requests[1]?.messages.at(-1)?.content ?? []).filter((block) => block.type === 'tool_result');
    expect(results.map((block) => [block.tool_use_id, block.is_error])).toEqual(calls.map((_, index) => [`call-${index}`, false]));
    // the page holds the regions the picture showed, and the whole turn is one step back
    const after = await snapshot();
    expect(after.history.undoSteps).toBe(before.history.undoSteps + 1);
    expect(after.document.pages[0]?.tree.children.length).toBeGreaterThanOrEqual((before.document.pages[0]?.tree.children.length ?? 0) + 3);
    await page.locator('[data-region="status-bar"]').click();
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await snapshot()).document).toEqual(before.document);
  } finally { await bridge.close(); }
});
