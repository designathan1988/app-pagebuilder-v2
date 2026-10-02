// The authoring data of removable modules (src/modules/*): what a tool keeps on an element so it can be reopened later
// (the Layout Composer's intent on the container it composed, its marker on each element it wrote). It is inert for
// the rest of the application: the renderer, the export, the Layers and the inspector never read it, and a document
// whose module was removed still opens, renders and exports as before — the data simply stays, unread.
//  - It lives on a node as `authoring`, by the module's own namespace ("layout-composer"), absent while no module keeps
//    anything there.
//  - Each namespace's value is JSON. A module that is installed registers a validator for its namespace, which the
//    document validator calls (validate.ts), so a malformed record is refused on import and before any commit, as any
//    other invalid document is. A namespace no installed module claims is only checked to be JSON.
import type { JsonValue } from '../../generated/commands.ts';

export type Authoring = Readonly<Record<string, JsonValue>>;

// A validator says why a namespace's value is not one its module can read, or null when it is.
export type AuthoringValidator = (value: JsonValue) => string | null;

const validators = new Map<string, AuthoringValidator>();

// Registered once by each installed module (src/app/modules.ts); a module that is removed takes its validator with it.
export function registerAuthoringValidator(namespace: string, validator: AuthoringValidator): () => void {
  validators.set(namespace, validator);
  return () => {
    if (validators.get(namespace) === validator) validators.delete(namespace);
  };
}

const isJson = (value: unknown, depth = 0): value is JsonValue => {
  if (depth > 64) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((one) => isJson(one, depth + 1));
  if (typeof value === 'object') return Object.values(value as object).every((one) => isJson(one, depth + 1));
  return false;
};

// Why a node's authoring data is invalid, by the path under it, or nothing when it is valid.
export function authoringProblems(authoring: unknown): readonly { readonly path: string; readonly message: string }[] {
  if (typeof authoring !== 'object' || authoring === null || Array.isArray(authoring) || Object.keys(authoring).length === 0) {
    return [{ path: '', message: 'authoring is an object with at least one namespace, or absent' }];
  }
  const problems: { path: string; message: string }[] = [];
  for (const [namespace, value] of Object.entries(authoring)) {
    if (!isJson(value)) {
      problems.push({ path: `/${namespace}`, message: 'an authoring namespace holds JSON' });
      continue;
    }
    const why = validators.get(namespace)?.(value) ?? null;
    if (why !== null) problems.push({ path: `/${namespace}`, message: why });
  }
  return problems;
}
