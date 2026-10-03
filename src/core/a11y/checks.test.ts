// The Checks panel's form rule (the audit's AUD-22, WCAG technique H32): a form a visitor has no way to send is
// reported on the form; a button that says nothing sends the form it is in, as the export writes it.
import { describe, expect, it } from 'vitest';
import { manifest } from '../../manifest/runtime.ts';
import type { DocNode } from '../document/model.ts';
import { documentOf, node } from '../testing/handlers.ts';
import { checksOf } from './checks.ts';

const field = node('email', 'input', 'input');
const formOf = (children: DocNode[]): DocNode => node('form', 'form', 'form', { children });
const reported = (form: DocNode): boolean => {
  const document = documentOf({ pages: [{ id: 'p', name: 'Home', file: 'index.html', tree: node('page', 'page', 'body', { children: [form] }) }] });
  return checksOf(document, manifest.interactions.checks).some((issue) => issue.node === 'form' && issue.rule === 'checks.formSubmit');
};

describe('a form without a submit button', () => {
  it('is reported on the form, with what to do', () => {
    expect(reported(formOf([field]))).toBe(true);
    expect(reported(formOf([field, node('close', 'button', 'button', { attributes: { buttonType: 'button' } })]))).toBe(true);
  });

  it('is not reported when a button sends it, a submit input, or a button deeper inside', () => {
    expect(reported(formOf([field, node('send', 'button', 'button')]))).toBe(false);
    expect(reported(formOf([field, node('send', 'button', 'button', { attributes: { buttonType: 'submit' } })]))).toBe(false);
    expect(reported(formOf([field, node('send', 'input', 'input', { attributes: { inputType: 'submit' } })]))).toBe(false);
    expect(reported(formOf([node('row', 'div', 'div', { children: [field, node('send', 'button', 'button')] })]))).toBe(false);
  });
});
