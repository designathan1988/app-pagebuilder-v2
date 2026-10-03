import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { createFormsEngine } from '../../core/forms/engine.ts';
import { formsRuntimeSource, installFormsRuntime } from './runtime.ts';
import type { FieldConfig, FormConfig } from '../../core/forms/types.ts';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
});
function setup(fieldConfig: FieldConfig = {}, formConfig: FormConfig = { destination: 'native' }, markup = '<input name="value" aria-describedby="hint"><span id="hint">Help</span>') {
  const window = new Window({ url: 'https://example.org/contact' });
  for (const name of ['Event', 'CustomEvent', 'FormData', 'AbortController']) vi.stubGlobal(name, (window as unknown as Record<string, unknown>)[name]);
  window.document.body.innerHTML = `<form>${markup}<button type="submit" name="action" value="send">Send</button></form><p id="success">Sent</p><p id="error">Failed</p>`;
  const document = window.document as unknown as Document;
  const form = required(document.querySelector('form'));
  const field = required(form.querySelector('input'));
  field.setAttribute('data-form-field', JSON.stringify(fieldConfig));
  form.setAttribute('data-form-submit', JSON.stringify(formConfig));
  const install = () => {
    const dispose = installFormsRuntime(document, createFormsEngine(() => Date.UTC(2026, 9, 1)));
    cleanups.push(dispose);
    return dispose;
  };
  const type = (text: string) => {
    field.value = text;
    field.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
  };
  const submit = () => {
    const event = new window.SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: form.querySelector('button') as never });
    form.dispatchEvent(event as unknown as Event);
    return event;
  };
  return { window, document, form, field, install, type, submit };
}
describe('forms runtime on real DOM controls', () => {
  it('masks input, validates at blur, links accessible errors and clears a corrected error', () => {
    const page = setup({ mask: { kind: 'preset', preset: 'cpf' }, when: 'blur', messages: { en: { preset: 'Enter a valid CPF' } } });
    const dispose = page.install();
    page.type('52998224726');
    expect(page.field.value).toBe('529.982.247-26');
    expect(page.field.hasAttribute('aria-invalid')).toBe(false);
    page.field.dispatchEvent(new page.window.Event('blur') as unknown as Event);
    expect(page.field.getAttribute('aria-invalid')).toBe('true');
    const errorId = required(required(page.field.getAttribute('aria-describedby')).split(' ')[1]);
    expect(page.document.getElementById(errorId)?.textContent).toBe('Enter a valid CPF');
    page.type('52998224725');
    expect(page.field.getAttribute('aria-invalid')).toBe('false');
    expect(page.document.getElementById(errorId)?.hidden).toBe(true);
    dispose();
    expect(page.field.getAttribute('aria-describedby')).toBe('hint');
    expect(page.document.getElementById(errorId)).toBeNull();
    expect(page.form.noValidate).toBe(false);
  });
  it('does not change composing text until composition completes', () => {
    const page = setup({ mask: { kind: 'uppercase' }, when: 'input' });
    page.install();
    page.field.dispatchEvent(new page.window.Event('compositionstart') as unknown as Event);
    page.type('ação');
    expect(page.field.value).toBe('ação');
    page.field.dispatchEvent(new page.window.Event('compositionend') as unknown as Event);
    expect(page.field.value).toBe('AÇÃO');
  });
  it('rejects submission, focuses first failure and preserves native required validation', () => {
    const page = setup({ when: 'submit' }, { destination: 'native' }, '<input name="value" required><input name="other" required>');
    page.install();
    const event = page.submit();
    expect(event.defaultPrevented).toBe(true);
    expect(page.document.activeElement).toBe(page.field);
    expect(page.field.getAttribute('aria-invalid')).toBe('true');
    expect(page.field.validationMessage.length).toBeGreaterThan(0);
  });
  it('rechecks a touched confirmation when its source changes', () => {
    const page = setup({ rules: { equalTo: 'original' }, when: 'input', messages: { en: { equalTo: 'Must match' } } }, { destination: 'native' }, '<input name="confirmation"><input name="original" data-form-field="{}">');
    page.install();
    const original = required(page.form.querySelector<HTMLInputElement>('[name="original"]'));
    original.value = 'one';
    page.type('one');
    page.field.dispatchEvent(new page.window.Event('blur') as unknown as Event);
    expect(page.field.getAttribute('aria-invalid')).toBe('false');
    original.value = 'two';
    original.dispatchEvent(new page.window.Event('input', { bubbles: true }) as unknown as Event);
    expect(page.field.validationMessage).toBe('Must match');
  });
  it('writes custom messages as text, never HTML', () => {
    const page = setup({ rules: { required: true }, messages: { en: { required: '<img src=x onerror=alert(1)>' } } });
    page.install();
    page.submit();
    expect(page.form.querySelector('img')).toBeNull();
    expect(page.form.textContent).toContain('<img src=x onerror=alert(1)>');
  });
  it('does not install malformed configuration or submit through it', () => {
    const page = setup();
    page.field.setAttribute('data-form-field', '{"rules":{"allowed":123}}');
    page.form.setAttribute('data-form-submit', '{"destination":"bogus"}');
    expect(() => page.install()).not.toThrow();
    expect(page.field.validationMessage).toBe('Invalid form configuration');
    expect(page.submit().defaultPrevented).toBe(true);
  });
  it('rejects script URLs before issuing a network request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const page = setup({}, { destination: 'webhook', endpoint: 'javascript:alert(1)', errorId: 'error' });
    page.install();
    page.type('hello');
    page.submit();
    await vi.waitFor(() => expect(page.document.getElementById('error')?.hidden).toBe(false));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('submits JSON, keeps repeated names, shows editable success and restores controls', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetch);
    const page = setup({}, { destination: 'endpoint', endpoint: 'https://api.example.org/forms', method: 'POST', encoding: 'json', successId: 'success', errorId: 'error' }, '<input name="value"><input name="choice" value="a"><input name="choice" value="b">');
    page.install();
    page.type('hello');
    expect(page.submit().defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(page.form.hasAttribute('aria-busy')).toBe(false));
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toMatchObject({ value: 'hello', choice: ['a', 'b'] });
    expect(page.document.getElementById('success')?.hidden).toBe(false);
    expect(page.document.getElementById('error')?.hidden).toBe(true);
    expect(page.form.querySelector('button')?.disabled).toBe(false);
  });
  it('shows submission errors, allows retry and blocks duplicate requests', async () => {
    let finish: ((value: { ok: boolean; status: number }) => void) | undefined;
    const fetch = vi.fn().mockImplementation(() => new Promise((resolve) => {
      finish = resolve;
    }));
    vi.stubGlobal('fetch', fetch);
    const page = setup({}, { destination: 'webhook', endpoint: '/api/forms', method: 'POST', errorId: 'error' });
    page.install();
    page.type('x');
    page.submit();
    page.submit();
    expect(fetch).toHaveBeenCalledOnce();
    expect(page.form.getAttribute('aria-busy')).toBe('true');
    finish?.({ ok: false, status: 503 });
    await vi.waitFor(() => expect(page.form.hasAttribute('aria-busy')).toBe(false));
    expect(page.document.getElementById('error')?.hidden).toBe(false);
    page.submit();
    expect(fetch).toHaveBeenCalledTimes(2);
    finish?.({ ok: true, status: 200 });
  });
  it('honeypot prevents a network request and leaves the page in its success state', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const page = setup({}, { destination: 'endpoint', endpoint: '/api/forms', honeypot: 'website', successId: 'success' });
    page.install();
    required(page.form.querySelector<HTMLInputElement>('[name="website"]')).value = 'spam';
    page.submit();
    expect(fetch).not.toHaveBeenCalled();
    expect(page.document.getElementById('success')?.hidden).toBe(false);
  });
  it('serializes raw mask values without changing displayed values or losing duplicate fields', () => {
    const page = setup({ mask: { kind: 'preset', preset: 'cpf', submit: 'raw' } });
    page.install();
    page.type('52998224725');
    const data = new page.window.FormData();
    data.append('value', page.field.value);
    data.append('value', 'other');
    const event = new page.window.Event('formdata');
    Object.defineProperty(event, 'formData', { value: data });
    page.form.dispatchEvent(event as unknown as Event);
    expect(data.getAll('value')).toEqual(['52998224725', 'other']);
    expect(page.field.value).toBe('529.982.247-25');
  });
  it('looks up postal addresses only when opted in and preserves concurrent user edits', async () => {
    let finish: ((value: unknown) => void) | undefined;
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => new Promise((resolve) => {
      finish = resolve;
    }) });
    vi.stubGlobal('fetch', fetch);
    const page = setup({ mask: { kind: 'preset', preset: 'cep' }, address: { endpoint: 'https://example.org/postal/{cep}', fields: { street: 'street', city: 'city' } } }, { destination: 'native' }, '<input name="value"><input name="street"><input name="city">');
    page.install();
    page.type('01310100');
    page.field.dispatchEvent(new page.window.Event('blur') as unknown as Event);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    required(page.form.querySelector<HTMLInputElement>('[name="street"]')).value = 'User street';
    finish?.({ street: 'Provider street', city: 'São Paulo' });
    await vi.waitFor(() => expect(required(page.form.querySelector<HTMLInputElement>('[name="city"]')).value).toBe('São Paulo'));
    expect(required(page.form.querySelector<HTMLInputElement>('[name="street"]')).value).toBe('User street');
  });
  it('generates runnable JavaScript without imports or external libraries', () => {
    const page = setup({ mask: { kind: 'uppercase' } });
    expect(() => new Function('document', formsRuntimeSource())(page.document)).not.toThrow();
    page.type('export');
    expect(page.field.value).toBe('EXPORT');
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Required DOM test element is missing');
  return value;
}
