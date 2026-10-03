// npm run assistant:check — the assistant's vision path against the real provider (plan G5, STG-14.2 and STG-14.3), run
// by the person with their own key in the environment (ANTHROPIC_API_KEY; ASSISTANT_MODEL to choose a model, else the
// editor's default). Never typed by anyone else, never written anywhere: the key goes only in the request's header.
// It sends a wireframe picture (a header band over two columns) before the words, with the Layout Composer's tools as
// the editor offers them (src/editor/assistant/catalogue.ts), through the editor's own provider client
// (src/editor/assistant/provider.ts), and checks that the answer lays the picture out through those tools: every call
// names an offered tool with arguments the tool takes, the composer is entered and left, and three regions or more
// are drawn. The answer, without the key, goes to .cache/logs/assistant/real-check.json.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { toolCatalogue, toolName, validateArguments, type ManifestCommand } from '../../src/editor/assistant/catalogue.ts';
import { imageBlock, streamReply, type ContentBlock } from '../../src/editor/assistant/provider.ts';

const MODEL = process.env.ASSISTANT_MODEL ?? 'claude-opus-5-5';
const OUT = path.join('.cache', 'logs', 'assistant');

// A PNG of the wireframe, 1200 × 800: a dark band at the top, two light columns below (PNG: signature, IHDR, IDAT of
// filtered rows deflated, IEND, each chunk with its CRC).
export function wireframe(): Uint8Array {
  const width = 1200;
  const height = 800;
  const shade = (x: number, y: number): number => {
    if (y < 120) return 60;
    if (y >= 160 && y < 640 && ((x >= 40 && x < 560) || (x >= 640 && x < 1160))) return 220;
    return 250;
  };
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const at = y * (width * 3 + 1);
    rows[at] = 0;
    for (let x = 0; x < width; x += 1) rows.fill(shade(x, y), at + 1 + x * 3, at + 4 + x * 3);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of bytes) c = (crcTable[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

async function main(): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (apiKey.trim() === '') {
    console.log('Set ANTHROPIC_API_KEY to your own key in this terminal, then run npm run assistant:check again.');
    return 2;
  }
  const commands = (JSON.parse(fs.readFileSync('manifest/commands/layout-composer.json', 'utf8')) as { commands: ManifestCommand[] }).commands;
  const words = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8')) as Record<string, string>;
  const tools = toolCatalogue(commands, (key) => words[key] ?? key);
  const picture = wireframe();
  const question = 'Lay out this wireframe on the open page with the Layout Composer tools: enter the composer on the page, '
    + 'draw each region of the picture with layout_stroke in mode draw (points in the page\'s pixels, 1200 wide), then leave.';
  const reply = await streamReply(
    { model: MODEL, apiKey, maxTokens: 4096 },
    [{ role: 'user', content: [imageBlock(picture, 'image/png'), { type: 'text', text: question }] }],
    tools,
    () => undefined,
    AbortSignal.timeout(120_000),
  );
  const calls = reply.content.filter((block): block is ContentBlock & { name: string; input: unknown } => block.type === 'tool_use');
  const problems: string[] = [];
  for (const call of calls) {
    const command = commands.find((one) => toolName(one.id) === call.name);
    if (command === undefined) problems.push(`${call.name}: not an offered tool`);
    else problems.push(...validateArguments(command, call.input).map((issue) => `${call.name}: ${issue}`));
  }
  const names = calls.map((call) => call.name);
  if (!names.includes('layout_enter')) problems.push('the composer is never entered (layout_enter)');
  if (names.filter((name) => name === 'layout_stroke').length < 3) problems.push('fewer than three regions drawn (layout_stroke)');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'real-check.json'), JSON.stringify({ model: MODEL, stopReason: reply.stopReason, inputTokens: reply.inputTokens, outputTokens: reply.outputTokens, calls: calls.map((call) => ({ name: call.name, input: call.input })), problems }, null, 2));
  console.log(`${MODEL}: ${calls.length} tool calls (${names.join(', ')}), ${reply.inputTokens} input and ${reply.outputTokens} output tokens`);
  if (problems.length > 0) {
    console.log(`The check fails:\n- ${problems.join('\n- ')}`);
    return 1;
  }
  console.log('The check passes: the picture was laid out through the Layout Composer\'s tools.');
  return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().then((code) => process.exit(code), (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
