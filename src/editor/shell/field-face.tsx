// The compact resting face of a real field. The input keeps its full CSS value and its existing command wiring;
// this presentation separates the number, unit and origin without squeezing the editable value in paired rows.
import type { ReactNode } from 'react';
import { formatColor, parseColor } from '../../core/style/color.ts';
import { valueOrigin } from '../inspector/origin.ts';
import { layeredRules, useEditorState } from '../store.ts';
import { breakpointById, breakpointName } from '../../core/document/breakpoints.ts';
import { useT } from '../text.ts';

export function useFieldAppearance(properties: readonly string[], mixed = false) {
  const t = useT();
  const source = useEditorState((state) => {
    const origin = valueOrigin(state, properties, layeredRules(state));
    if (origin === null) return '';
    if (origin.kind === 'breakpoint') {
      const found = breakpointById(state.document, origin.breakpoint);
      return `${origin.kind}|${found === undefined ? origin.breakpoint : breakpointName(found, t)}`;
    }
    return origin.kind;
  });
  // the kind, then the breakpoint's name (which may hold any character)
  const cut = source.indexOf('|');
  const kind = cut < 0 ? source : source.slice(0, cut);
  const breakpoint = cut < 0 ? '' : source.slice(cut + 1);
  const label = kind === 'inherited' ? t('inspector.legend.inherited')
    : kind === 'breakpoint' ? breakpoint
    : null;
  return { kind: mixed ? 'mixed' : kind, label: mixed ? null : label };
}

export function compactFieldValue(text: string, numeric = false, colour = false): { value: string; unit: string } {
  // a colour's face (the audit's S-026: Background read rgba(0, 0, 0, 0)): its hex, a colour not fully opaque with its
  // opacity after it in the unit's place (#1A1A1A 50%), one fully clear the word transparent
  if (colour) {
    const parsed = parseColor(text);
    if (parsed !== null && parsed.a === 0) return { value: 'transparent', unit: '' };
    if (parsed !== null) return { value: formatColor({ ...parsed, a: 1 }).toUpperCase(), unit: parsed.a === 1 ? '' : `${Math.round(parsed.a * 100)}%` };
  }
  const token = /^var\((--[^,)]+)\)$/.exec(text.trim());
  if (token !== null) return { value: token[1] ?? text, unit: '' };
  const number = numeric ? /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i.exec(text.trim()) : null;
  return number === null ? { value: text, unit: '' } : { value: number[1] ?? text, unit: number[2] ?? '' };
}

export function FieldValueSlot({ children, value }: { readonly children: ReactNode; readonly value: string }) {
  return <span className="field__value-slot" title={value}>{children}<span className="field__rest-value" aria-hidden="true">{value}</span></span>;
}

export function FieldOriginBadge({ label }: { readonly label: string | null }) {
  return label === null ? null : <span className="field__origin-badge" aria-hidden="true">{label}</span>;
}
