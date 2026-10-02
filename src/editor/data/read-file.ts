// The one reader of a data file a person hands over (door.tsx, a door whose adapter reads "data"; spec content-data,
// "import"): the browser reads the file's bytes, the core reads its sheets (core/data/readers.ts), and the command
// receives them as JSON — the async rule's payload, read before the dispatch, never the document. A spreadsheet's XML
// is read here, by the browser's DOMParser: the core has no DOM.
import { readDataFileSafely, type XmlElement, type XmlReader } from '../../core/data/readers.ts';

// The browser's XML parser as the core's port: an element tree of local names, attributes and text. A document the
// parser refuses (its <parsererror>) throws, which the reader turns into a refusal naming the file.
export const domXml: XmlReader = (source) => {
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0 || document.documentElement === null) throw new Error('the XML cannot be read');
  const convert = (element: Element): XmlElement => ({
    name: element.localName,
    attributes: Object.fromEntries([...element.attributes].map((attribute) => [attribute.name, attribute.value])),
    text: element.textContent ?? '',
    children: [...element.children].map(convert),
  });
  return convert(document.documentElement);
};

// The file as the preview command takes it: its sheets, or the problem that stops its reading, as JSON text.
export async function readPickedDataFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return JSON.stringify(await readDataFileSafely(file.name, bytes, domXml));
}
