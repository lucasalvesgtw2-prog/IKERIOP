import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/core/errors.js';
import {
  escapeForDisplay,
  forEmbedField,
  normalizeUserText,
  truncateForDisplay,
  validateTextField,
} from '../../src/core/text.js';

const ZWSP = '\u200B';
/** Right-to-left override: makes the text after it render in reverse. */
const RLO = '\u202E';
const BOM = '\uFEFF';
const CONTROL = '\u0007';

describe('normalizeUserText', () => {
  it('trims and collapses runs of spaces', () => {
    expect(normalizeUserText('  Steam    Account  ')).toBe('Steam Account');
  });

  it('normalises line endings and collapses excessive blank lines', () => {
    expect(normalizeUserText('a\r\nb\n\n\n\nc')).toBe('a\nb\n\nc');
  });

  it('collapses newlines for a single-line field', () => {
    expect(normalizeUserText('Steam\nAccount', { singleLine: true })).toBe('Steam Account');
  });

  it('strips zero-width and bidi-control characters', () => {
    expect(normalizeUserText(`Ste${ZWSP}am${RLO}Account`)).toBe('SteamAccount');
    expect(normalizeUserText(`${BOM}price`)).toBe('price');
  });

  it('strips control characters but keeps tabs as whitespace', () => {
    expect(normalizeUserText(`a${CONTROL}bc`)).toBe('abc');
    expect(normalizeUserText('a\tb')).toBe('a b');
  });
});

describe('escapeForDisplay', () => {
  it('neutralises markdown so user text cannot imitate the bot', () => {
    // A seller must not be able to render a convincing bold "Payment address"
    // line inside the summary embed the bot authored.
    const escaped = escapeForDisplay('**Payment address:** `bc1qattacker`');
    expect(escaped).not.toContain('**Payment');
    expect(escaped).toContain('\\*\\*');
    expect(escaped).toContain('\\`');
  });

  it('escapes every markdown control character', () => {
    for (const char of ['*', '_', '~', '`', '>', '|', '#', '-', '+', '[', ']', '(', ')', '\\']) {
      expect(escapeForDisplay(char), char).toBe(`\\${char}`);
    }
  });

  it('defuses @everyone and @here', () => {
    expect(escapeForDisplay('@everyone')).not.toBe('@everyone');
    expect(escapeForDisplay('@everyone')).toContain('everyone');
    expect(escapeForDisplay('@here')).not.toBe('@here');
  });

  it('defuses user, role and channel mentions', () => {
    for (const mention of ['<@123456789012345678>', '<@!123>', '<@&456>', '<#789>']) {
      expect(escapeForDisplay(mention), mention).not.toBe(mention);
    }
  });

  it('leaves ordinary text alone', () => {
    expect(escapeForDisplay('Level 50 gaming account')).toBe('Level 50 gaming account');
  });
});

describe('truncateForDisplay', () => {
  it('leaves short text unchanged', () => {
    expect(truncateForDisplay('abc', 10)).toBe('abc');
  });

  it('marks truncated text', () => {
    const result = truncateForDisplay('x'.repeat(50), 10);
    expect(result).toHaveLength(10);
    expect(result.endsWith('…')).toBe(true);
  });

  it('never exceeds the embed field limit', () => {
    expect(forEmbedField('x'.repeat(5_000)).length).toBeLessThanOrEqual(1_024);
  });
});

describe('validateTextField', () => {
  const rules = { label: 'Item / Service', minLength: 2, maxLength: 10 };

  it('returns the normalised value', () => {
    expect(validateTextField('  Steam  ', rules)).toBe('Steam');
  });

  it('rejects an empty required field', () => {
    expect(() => validateTextField('   ', rules)).toThrow(ValidationError);
  });

  it('accepts an empty optional field as an empty string', () => {
    expect(validateTextField('  ', { label: 'Terms', maxLength: 10, required: false })).toBe('');
  });

  it('rejects text that is too short or too long', () => {
    expect(() => validateTextField('a', rules)).toThrow(ValidationError);
    expect(() => validateTextField('x'.repeat(11), rules)).toThrow(ValidationError);
  });

  it('measures length after stripping invisible padding', () => {
    // Zero-width padding must not be able to satisfy a minimum length.
    expect(() => validateTextField(`a${ZWSP.repeat(20)}`, rules)).toThrow(ValidationError);
  });

  it('rejects a field made only of invisible characters', () => {
    expect(() => validateTextField(ZWSP.repeat(5), rules)).toThrow(ValidationError);
  });

  it('names the field in the message shown to the user', () => {
    try {
      validateTextField('', rules);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ValidationError).userMessage).toContain('Item / Service');
    }
  });
});
