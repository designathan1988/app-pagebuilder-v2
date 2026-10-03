// The headings the exported stylesheet parts its rules by (spec html-import, Problems 9): the person's classes under
// one, the elements' own rules under the other. The export writes them (core/export/export.ts) and the import reads
// them back (core/import/import.ts): a class one element alone uses and lists last reads like the class the export
// makes for an element's own styles, and only the heading tells them apart.
export const CLASSES_HEADING = '/* Classes */';
export const ELEMENTS_HEADING = '/* Elements */';

// Whether a line of a stylesheet's text (counted from 1, as the stylesheet reader counts) sits under its classes
// heading: after that heading and before the elements heading, if any. Never for a text without the classes heading (a
// sheet written elsewhere, or edited without it).
export function underClassesHeading(text: string): (line: number) => boolean {
  const lines = text.split('\n');
  const classes = lines.findIndex((line) => line.trim() === CLASSES_HEADING);
  if (classes < 0) return () => false;
  const elements = lines.findIndex((line, i) => i > classes && line.trim() === ELEMENTS_HEADING);
  return (line) => line > classes + 1 && (elements < 0 || line < elements + 1);
}
