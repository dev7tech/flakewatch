import { createHash } from 'node:crypto';

import { normalizeName } from './normalize.js';

/**
 * Longest normalized suite or test name, in Unicode code points, for which an
 * identity is computed. Longer names are rejected rather than truncated, so
 * that two different names can never share an identity.
 */
const MAX_NAME_LENGTH = 4096;

export interface TestIdentity {
  /** Normalized suite name. May be empty. */
  readonly suite: string;
  /** Normalized test name. Never empty. */
  readonly name: string;
  /** Lowercase hexadecimal SHA-256 identity hash. */
  readonly hash: string;
}

export type TestIdentityResult =
  | { readonly ok: true; readonly identity: TestIdentity }
  | {
      readonly ok: false;
      readonly reason: 'missing_name' | 'name_too_long' | 'suite_too_long';
    };

/**
 * Computes the identity of a test from its raw suite and test names
 * (architecture §5.1). The hash is SHA-256 over the UTF-8 encoding of
 * `"v1" NUL suite NUL name`, using the normalized names. Normalization removes
 * every NUL, so the encoding is unambiguous.
 *
 * Returns a reason instead of an identity when the normalized name is empty or
 * when either normalized value is longer than 4,096 code points.
 */
export function createTestIdentity(raw: {
  suite: string;
  name: string;
}): TestIdentityResult {
  const suite = normalizeName(raw.suite);
  const name = normalizeName(raw.name);

  if (name === '') {
    return { ok: false, reason: 'missing_name' };
  }
  if (exceedsMaxLength(name)) {
    return { ok: false, reason: 'name_too_long' };
  }
  if (exceedsMaxLength(suite)) {
    return { ok: false, reason: 'suite_too_long' };
  }

  const hash = createHash('sha256')
    .update(`v1\u0000${suite}\u0000${name}`, 'utf8')
    .digest('hex');
  return { ok: true, identity: { suite, name, hash } };
}

function exceedsMaxLength(value: string): boolean {
  // The UTF-16 length is an upper bound on the number of code points.
  if (value.length <= MAX_NAME_LENGTH) {
    return false;
  }
  // Normalized values are well-formed, so counting every UTF-16 unit except
  // low surrogates counts code points.
  let codePoints = 0;
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit < 0xdc00 || unit > 0xdfff) {
      codePoints++;
    }
  }
  return codePoints > MAX_NAME_LENGTH;
}
