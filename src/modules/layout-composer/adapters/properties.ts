// The compiler names what it declares by role (minWidth, gridTemplateColumns); the manifest names the properties the
// editor edits (min-width, grid-template-columns). This reads the roles from the manifest's own list, so no CSS
// property identifier is written by hand and a role the manifest does not edit refuses compilation.
export function propertyVocabulary(properties: readonly { readonly id: string }[]): Readonly<Record<string, string>> {
  return Object.fromEntries(properties.map((property) => [property.id.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()), property.id]));
}
