import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createTestIdentity } from './identity.js';
import { normalizeName } from './normalize.js';

// A fixed seed keeps the property tests deterministic: every run explores the
// same generated inputs.
fc.configureGlobal({ seed: 20261019 });

type Pair = [suite: string, name: string];

function hashOf(suite: string, name: string): string {
  const result = createTestIdentity({ suite, name });
  if (!result.ok) {
    throw new Error(`expected an identity, got ${result.reason}`);
  }
  return result.identity.hash;
}

function reasonOf(suite: string, name: string): string | undefined {
  const result = createTestIdentity({ suite, name });
  return result.ok ? undefined : result.reason;
}

describe('createTestIdentity', () => {
  // Computed independently (Python hashlib). These pin the identity scheme: if
  // one changes, every stored identity would change with it.
  it.each([
    [
      'checkout/cart.spec.ts',
      'applies discount codes',
      '1996e390a01cbd2c9f39f35f9bc776cc686312a0ece2accc574d568f6f089a5d',
    ],
    [
      '',
      'standalone test',
      '5a6ce7200f88b5dac9d008b7d9a589c0ccbe422b780a40a3bf02c3c2ecbd663e',
    ],
    [
      'tests.test_math',
      'test_add[1-2]',
      '377f198d3623adc44a2d7e432500581d40b9b5593b5e52a2ef81b512afe42561',
    ],
    [
      'Gro\u0308\u00DFe',
      ' pru\u0308ft  Cafe\u0301 \u2615 ',
      'f47c3d5a6c8cdb653f8683e621ce93d02522cf97ef3f046275ad3c62b6aabad8',
    ],
  ])('hashes (%j, %j) to the pinned value', (suite, name, expected) => {
    expect(hashOf(suite, name)).toBe(expected);
  });

  it('returns the normalized suite and name', () => {
    expect(
      createTestIdentity({ suite: ' Cart\tSuite ', name: 'Cafe\u0301\u202E' }),
    ).toEqual({
      ok: true,
      identity: {
        suite: 'Cart Suite',
        name: 'Caf\u00E9',
        hash: hashOf('Cart Suite', 'Caf\u00E9'),
      },
    });
  });

  it.each<[string, Pair, Pair]>([
    [
      'whitespace differences',
      ['Cart', 'applies  discount'],
      [' Cart', 'applies\tdiscount\n'],
    ],
    [
      'control characters',
      ['Cart', 'applies discount'],
      ['Ca\u0000rt', 'applies\u001B discount'],
    ],
    [
      'bidirectional formatting',
      ['Cart', 'isAdmin'],
      ['Cart\u200F', 'is\u202EAdmin\u2069'],
    ],
    [
      'canonical equivalence',
      ['Caf\u00E9', '\u00C5'],
      ['Cafe\u0301', '\u212B'],
    ],
    ['an unpaired surrogate and U+FFFD', ['', 'x\uFFFD'], ['', 'x\uDC00']],
  ])(
    'gives the same identity despite %s',
    (_description, [suiteA, nameA], [suiteB, nameB]) => {
      expect(hashOf(suiteA, nameA)).toBe(hashOf(suiteB, nameB));
    },
  );

  it.each<[string, Pair, Pair]>([
    ['case', ['Cart', 'applies discount'], ['cart', 'applies discount']],
    ['compatibility forms', ['', '\uFB01le'], ['', 'file']],
    ['zero-width spaces', ['', 'ab'], ['', 'a\u200Bb']],
    [
      'pytest parameters',
      ['tests.test_math', 'test_add[1-2]'],
      ['tests.test_math', 'test_add[2-1]'],
    ],
    [
      'a space inside parameters',
      ['', 'test_add[1-2]'],
      ['', 'test_add[1-2 ]'],
    ],
    ['Go subtests', ['pkg', 'TestParse/empty'], ['pkg', 'TestParse/empty#01']],
    ['punctuation', ['', 'it "works"'], ['', "it 'works'"]],
    ['a boundary moved into the name', ['a b', 'c'], ['a', 'b c']],
    ['a boundary moved into the suite', ['ab', 'c'], ['a', 'bc']],
    ['swapped suite and name', ['a', 'b'], ['b', 'a']],
    ['an empty suite', ['', 'a b'], ['a', 'b']],
    [
      'a NUL that cannot act as a separator',
      ['a\u0000b', 'c'],
      ['a', 'b\u0000c'],
    ],
  ])(
    'gives different identities for %s',
    (_description, [suiteA, nameA], [suiteB, nameB]) => {
      expect(hashOf(suiteA, nameA)).not.toBe(hashOf(suiteB, nameB));
    },
  );

  it.each([
    ['an empty name', ''],
    ['a whitespace-only name', ' \t\n\u3000'],
    ['a name of removed characters only', '\u0000\u202E\u200F'],
  ])('rejects %s', (_description, name) => {
    expect(reasonOf('Suite', name)).toBe('missing_name');
  });

  it('accepts an empty suite', () => {
    expect(reasonOf('', 'test')).toBeUndefined();
  });

  describe('length limits', () => {
    it.each([
      ['4,096 ASCII characters', 'a'.repeat(4096), undefined],
      ['4,097 ASCII characters', 'a'.repeat(4097), 'name_too_long'],
      [
        '4,096 astral characters (8,192 UTF-16 units)',
        '\u{1F600}'.repeat(4096),
        undefined,
      ],
      ['4,097 astral characters', '\u{1F600}'.repeat(4097), 'name_too_long'],
      [
        '8,192 code points that compose to 4,096',
        'e\u0301'.repeat(4096),
        undefined,
      ],
      [
        'a short name padded with whitespace',
        `a${' '.repeat(10_000)}b`,
        undefined,
      ],
    ])('measures the normalized name: %s', (_description, name, expected) => {
      expect(reasonOf('', name)).toBe(expected);
    });

    it('rejects a suite longer than 4,096 code points', () => {
      expect(reasonOf('s'.repeat(4097), 'test')).toBe('suite_too_long');
    });

    it('reports a missing name before any length problem', () => {
      expect(reasonOf('s'.repeat(5000), '')).toBe('missing_name');
      expect(reasonOf('s'.repeat(5000), 'n'.repeat(5000))).toBe(
        'name_too_long',
      );
    });
  });

  const trickyName = fc.string({
    unit: fc.oneof(
      fc.constantFrom(' ', '\t', '\u0000', '\u202E', 'e', '\u0301', '\uD800'),
      fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }),
    ),
    maxLength: 20,
  });

  it('depends only on the normalized suite and name', () => {
    fc.assert(
      fc.property(trickyName, trickyName, (suite, name) => {
        expect(createTestIdentity({ suite, name })).toEqual(
          createTestIdentity({
            suite: normalizeName(suite),
            name: normalizeName(name),
          }),
        );
      }),
    );
  });

  it('returns normalized values and a 64-character hexadecimal hash', () => {
    fc.assert(
      fc.property(trickyName, trickyName, (suite, name) => {
        const result = createTestIdentity({ suite, name });
        if (result.ok) {
          expect(result.identity.hash).toMatch(/^[0-9a-f]{64}$/);
          expect(normalizeName(result.identity.suite)).toBe(
            result.identity.suite,
          );
          expect(normalizeName(result.identity.name)).toBe(
            result.identity.name,
          );
          expect(result.identity.name).not.toBe('');
        }
      }),
    );
  });

  // A tiny alphabet makes equal pairs and shifted suite/name boundaries
  // (such as "a b" + "c" versus "a" + "b c") frequent.
  const smallName = fc.string({
    unit: fc.constantFrom('a', 'b', ' ', '\u0000'),
    maxLength: 4,
  });

  it('gives equal hashes exactly when the normalized suite and name are equal', () => {
    fc.assert(
      fc.property(
        smallName,
        smallName,
        smallName,
        smallName,
        (suiteA, nameA, suiteB, nameB) => {
          const a = createTestIdentity({ suite: suiteA, name: nameA });
          const b = createTestIdentity({ suite: suiteB, name: nameB });
          if (a.ok && b.ok) {
            const sameInput =
              a.identity.suite === b.identity.suite &&
              a.identity.name === b.identity.name;
            expect(a.identity.hash === b.identity.hash).toBe(sameInput);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});
