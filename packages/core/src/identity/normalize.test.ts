import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { normalizeName } from './normalize.js';

// A fixed seed keeps the property tests deterministic: every run explores the
// same generated inputs.
fc.configureGlobal({ seed: 20261019 });

const WHITESPACE = [
  ' ',
  '\t',
  '\n',
  '\r',
  '\u000B',
  '\u000C',
  '\u0085',
  '\u00A0',
  '\u1680',
  '\u2003',
  '\u2028',
  '\u2029',
  '\u202F',
  '\u3000',
];

const REMOVED = [
  '\u0000',
  '\u0007',
  '\u001B',
  '\u007F',
  '\u0080',
  '\u009F',
  '\u061C',
  '\u200E',
  '\u200F',
  '\u202A',
  '\u202E',
  '\u2066',
  '\u2069',
];

/** Characters that exercise every normalization step, plus any code point. */
const trickyCharacter = fc.oneof(
  fc.constantFrom(...WHITESPACE),
  fc.constantFrom(...REMOVED),
  // Invisible characters that normalization deliberately keeps.
  fc.constantFrom('\u200B', '\u200C', '\u200D', '\uFEFF'),
  // Bases and combining marks that NFC composes.
  fc.constantFrom(
    'e',
    'A',
    '\u0301',
    '\u0308',
    '\u00E9',
    '\u212B',
    '\u1100',
    '\u1161',
  ),
  // Unpaired surrogates.
  fc.constantFrom('\uD800', '\uDBFF', '\uDC00'),
  fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }),
);
const trickyName = fc.string({ unit: trickyCharacter, maxLength: 30 });

/** Word characters: no whitespace or removed characters. */
const wordCharacter = fc.constantFrom(
  'a',
  'Z',
  '7',
  '_',
  '-',
  '[',
  ']',
  '/',
  '›',
  '#',
  ':',
  '.',
  '\u00E9',
  '\u00DF',
  '\u4E2D',
  '\u{1F600}',
  '\u0301',
  '\u200D',
);
const word = fc.string({ unit: wordCharacter, minLength: 1, maxLength: 8 });
const whitespaceRun = fc.string({
  unit: fc.constantFrom(...WHITESPACE),
  minLength: 1,
  maxLength: 4,
});

describe('normalizeName', () => {
  it.each([
    ['an ordinary name', 'applies discount codes', 'applies discount codes'],
    ['an empty name', '', ''],
    [
      'repeated spaces and tabs',
      'applies   discount\tcodes',
      'applies discount codes',
    ],
    ['leading and trailing whitespace', ' \t name \n', 'name'],
    ['line breaks', 'line one\r\nline two\n', 'line one line two'],
    ['Unicode whitespace', 'a\u00A0b\u3000c\u2028d\u0085e', 'a b c d e'],
    ['whitespace only', ' \t\r\n\u3000', ''],
    ['a NUL byte', 'nul\u0000byte', 'nulbyte'],
    ['an ANSI color sequence', '\u001B[31mred\u001B[0m', '[31mred[0m'],
    [
      'bidirectional overrides',
      'isAdmin\u202E\u2066 // check',
      'isAdmin // check',
    ],
    ['removed characters only', '\u0000\u202E\u200F', ''],
    ['a decomposed accent', 'Cafe\u0301', 'Caf\u00E9'],
    ['a canonical singleton', '\u212B', '\u00C5'],
    ['Hangul jamo', '\u1100\u1161', '\uAC00'],
    ['a combining mark exposed by removal', 'e\u200E\u0301', '\u00E9'],
    ['an unpaired surrogate', 'x\uD800y', 'x\uFFFDy'],
    ['whitespace around a removed character', 'a \u0000 b', 'a b'],
    ['removed characters next to the edges', ' \u202E name \u0000 ', 'name'],
  ])('normalizes %s', (_description, input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });

  it.each([
    ['case', 'Applies Discount Codes'],
    ['compatibility ligatures', '\uFB01le'],
    ['full-width letters', '\uFF21\uFF22'],
    ['superscripts', 'x\u00B2'],
    ['zero-width spaces', 'a\u200Bb'],
    ['a leading byte-order mark, which is not White_Space', '\uFEFFname'],
    ['emoji ZWJ sequences', '\u{1F469}\u200D\u{1F4BB} works'],
    [
      'punctuation',
      `it "works" with 'quotes', <tags> & {braces} | :: # % \\ /`,
    ],
    ['pytest parameters', 'test_add[1-2]'],
    ['JUnit display names', '[1] input=foo, expected=bar'],
    ['Go subtests', 'TestParse/empty_input#01'],
    [
      'Jest and Playwright titles',
      'chromium › cart.spec.ts:12:3 › applies discount',
    ],
  ])('preserves %s', (_description, input) => {
    expect(normalizeName(input)).toBe(input);
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(trickyName, (value) => {
        const once = normalizeName(value);
        expect(normalizeName(once)).toBe(once);
      }),
    );
  });

  it('produces well-formed NFC text with single interior spaces only', () => {
    fc.assert(
      fc.property(trickyName, (value) => {
        const result = normalizeName(value);
        expect(result.isWellFormed()).toBe(true);
        expect(result.normalize('NFC')).toBe(result);
        expect(result).not.toMatch(/\p{Cc}/v);
        expect(result).not.toMatch(
          /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/v,
        );
        expect(result).not.toMatch(/[\p{White_Space}--[ ]]| {2}|^ | $/v);
      }),
    );
  });

  it('maps canonically equivalent text to the same value', () => {
    fc.assert(
      fc.property(trickyName, (value) => {
        const expected = normalizeName(value);
        expect(normalizeName(value.normalize('NFD'))).toBe(expected);
        expect(normalizeName(value.normalize('NFC'))).toBe(expected);
      }),
    );
  });

  it('ignores removed characters inserted anywhere', () => {
    fc.assert(
      fc.property(
        trickyName,
        fc.nat(),
        fc.constantFrom(...REMOVED),
        (value, position, removed) => {
          const codePoints = Array.from(normalizeName(value));
          codePoints.splice(position % (codePoints.length + 1), 0, removed);
          expect(normalizeName(codePoints.join(''))).toBe(normalizeName(value));
        },
      ),
    );
  });

  it('treats any whitespace around and between words as a single space', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(whitespaceRun, word), { minLength: 1, maxLength: 5 }),
        whitespaceRun,
        (pairs, trailing) => {
          const spaced =
            pairs.map(([space, text]) => space + text).join('') + trailing;
          const words = pairs.map(([, text]) => text);
          expect(normalizeName(spaced)).toBe(normalizeName(words.join(' ')));
        },
      ),
    );
  });

  it('treats a separator as one space if it has whitespace, and as nothing otherwise', () => {
    const separator = fc.string({
      unit: fc.constantFrom(...WHITESPACE, ...REMOVED),
      minLength: 1,
      maxLength: 4,
    });
    fc.assert(
      fc.property(
        fc.array(fc.tuple(separator, word), { minLength: 1, maxLength: 5 }),
        (pairs) => {
          const raw = pairs.map(([gap, text]) => gap + text).join('');
          const expected = pairs
            .map(
              ([gap, text], index) =>
                (index > 0 && /\p{White_Space}/v.test(gap) ? ' ' : '') + text,
            )
            .join('');
          expect(normalizeName(raw)).toBe(normalizeName(expected));
        },
      ),
    );
  });
});
