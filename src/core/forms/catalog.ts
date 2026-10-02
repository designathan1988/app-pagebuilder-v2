import type { MaskConfig, Preset, RuleCode } from './types.ts';
export const presetCatalogue: readonly { readonly id: Preset; readonly example: string; readonly inputMode: string; readonly autocomplete: string; readonly mask: MaskConfig }[] = [
  { id: 'cpf', example: '529.982.247-25', inputMode: 'numeric', autocomplete: 'off', mask: { kind: 'preset', preset: 'cpf' } },
  { id: 'cnpj', example: '12.ABC.345/01DE-35', inputMode: 'text', autocomplete: 'off', mask: { kind: 'preset', preset: 'cnpj' } },
  { id: 'cpf-cnpj', example: '529.982.247-25', inputMode: 'text', autocomplete: 'off', mask: { kind: 'preset', preset: 'cpf-cnpj' } },
  { id: 'cep', example: '01310-100', inputMode: 'numeric', autocomplete: 'postal-code', mask: { kind: 'preset', preset: 'cep' } },
  { id: 'phone-br', example: '(11) 98888-7777', inputMode: 'tel', autocomplete: 'tel-national', mask: { kind: 'preset', preset: 'phone-br' } },
  { id: 'phone-international', example: '+14155552671', inputMode: 'tel', autocomplete: 'tel', mask: { kind: 'preset', preset: 'phone-international' } },
  { id: 'rg', example: '12345678X', inputMode: 'text', autocomplete: 'off', mask: { kind: 'preset', preset: 'rg' } },
  { id: 'pis', example: '120.44567.89-1', inputMode: 'numeric', autocomplete: 'off', mask: { kind: 'preset', preset: 'pis' } },
  { id: 'voter', example: '0123 4567 0191', inputMode: 'numeric', autocomplete: 'off', mask: { kind: 'preset', preset: 'voter' } },
  { id: 'plate', example: 'ABC1D23', inputMode: 'text', autocomplete: 'off', mask: { kind: 'preset', preset: 'plate' } },
  { id: 'card', example: '4111 1111 1111 1111', inputMode: 'numeric', autocomplete: 'cc-number', mask: { kind: 'preset', preset: 'card' } },
  { id: 'expiry', example: '12/30', inputMode: 'numeric', autocomplete: 'cc-exp', mask: { kind: 'preset', preset: 'expiry' } },
  { id: 'cvv', example: '123', inputMode: 'numeric', autocomplete: 'cc-csc', mask: { kind: 'preset', preset: 'cvv' } },
  { id: 'email', example: 'hello@example.org', inputMode: 'email', autocomplete: 'email', mask: { kind: 'preset', preset: 'email' } },
  { id: 'url', example: 'https://example.org', inputMode: 'url', autocomplete: 'url', mask: { kind: 'preset', preset: 'url' } },
  { id: 'date-br', example: '29/02/2024', inputMode: 'numeric', autocomplete: 'off', mask: { kind: 'preset', preset: 'date-br' } },
  { id: 'time', example: '14:30', inputMode: 'numeric', autocomplete: 'off', mask: { kind: 'preset', preset: 'time' } },
  { id: 'currency', example: 'R$ 1.234,56', inputMode: 'decimal', autocomplete: 'off', mask: { kind: 'preset', preset: 'currency', currency: 'BRL', locale: 'pt-BR' } },
  { id: 'measurement', example: '12,5 kg', inputMode: 'decimal', autocomplete: 'off', mask: { kind: 'preset', preset: 'measurement', suffix: 'kg' } },
];

/** Move these entries into the existing locale catalogues at integration; use their keys in the settings doors. */
export const validationMessageKeys: Readonly<Record<RuleCode, string>> = {
  required: 'forms.validation.required', type: 'forms.validation.type', pattern: 'forms.validation.pattern', tooShort: 'forms.validation.tooShort', tooLong: 'forms.validation.tooLong',
  minimum: 'forms.validation.minimum', maximum: 'forms.validation.maximum', step: 'forms.validation.step', preset: 'forms.validation.preset', equalTo: 'forms.validation.equalTo',
  password: 'forms.validation.password', allowed: 'forms.validation.allowed', dateMinimum: 'forms.validation.dateMinimum', dateMaximum: 'forms.validation.dateMaximum', fileType: 'forms.validation.fileType', fileSize: 'forms.validation.fileSize', configuration: 'forms.validation.configuration',
};
