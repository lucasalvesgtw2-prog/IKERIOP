import { ValidationError } from './errors.js';

/**
 * Handling of user-supplied text.
 *
 * Deal details are written by one party and read by the other inside an embed
 * the bot authored. Text that renders as bot formatting is therefore a
 * spoofing surface: a seller could otherwise write something that looks like
 * an instruction from the middleman — a different payment address, say.
 * Everything a user types is escaped before it is rendered.
 */

/** Characters that change how Discord renders a message. */
const MARKDOWN_PATTERN = /([\\*_~`>|#\-+[\]()])/g;

/**
 * Zero-width and bidi-control characters. Being invisible, they are used to
 * hide text or to reverse its apparent reading order.
 */
const INVISIBLE_PATTERN = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/**
 * C0/C1 control characters, except tab and newline. Matching control
 * characters is the entire point of this pattern, so the lint rule that warns
 * about them is disabled here deliberately.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/** A zero-width space, used to defuse a mention without deleting characters. */
const ZWSP = '\u200B';

export interface TextFieldRules {
  /** Field name used in the message shown to the user. */
  label: string;
  minLength?: number;
  maxLength: number;
  required?: boolean;
  /** Collapse newlines into spaces — for single-line fields. */
  singleLine?: boolean;
}

/**
 * Normalises raw modal input: strips invisible and control characters,
 * normalises line endings, collapses runs of blank lines, and trims.
 *
 * This does NOT escape markdown. Storage keeps what the user actually wrote so
 * staff can read the real text; escaping happens at render time.
 */
export function normalizeUserText(raw: string, options: { singleLine?: boolean } = {}): string {
  let value = raw
    .replace(INVISIBLE_PATTERN, '')
    .replace(CONTROL_PATTERN, '')
    .replace(/\r\n?/g, '\n');

  value = options.singleLine ? value.replace(/\s*\n+\s*/g, ' ') : value.replace(/\n{3,}/g, '\n\n');

  return value.replace(/[ \t]+/g, ' ').trim();
}

/** Normalises and length-checks one modal field. */
export function validateTextField(raw: string, rules: TextFieldRules): string {
  const value = normalizeUserText(raw, { singleLine: rules.singleLine ?? false });

  if (value.length === 0) {
    if (rules.required === false) return '';
    throw new ValidationError(`${rules.label} is empty`, `**${rules.label}** cannot be empty.`);
  }

  if (rules.minLength !== undefined && value.length < rules.minLength) {
    throw new ValidationError(
      `${rules.label} is too short`,
      `**${rules.label}** must be at least ${rules.minLength} characters.`,
    );
  }

  if (value.length > rules.maxLength) {
    throw new ValidationError(
      `${rules.label} is too long`,
      `**${rules.label}** must be at most ${rules.maxLength} characters.`,
    );
  }

  return value;
}

/**
 * Escapes text for display.
 *
 * Markdown is neutralised so user text cannot imitate the bot's own
 * formatting, and mentions are defused so a deal description cannot ping a
 * role. Embeds do not ping on their own, but these values also reach message
 * content and staff-facing output.
 */
export function escapeForDisplay(value: string): string {
  return value
    .replace(MARKDOWN_PATTERN, '\\$1')
    .replace(/@(everyone|here)/g, `@${ZWSP}$1`)
    .replace(/<(@[!&]?|#)(\d+)>/g, `<${ZWSP}$1$2>`);
}

/** Truncates for a context with a hard limit, marking that it was cut. */
export function truncateForDisplay(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

/** Escapes and truncates in one step, for an embed field. */
export function forEmbedField(value: string, maxLength = 1_024): string {
  return truncateForDisplay(escapeForDisplay(value), maxLength);
}
