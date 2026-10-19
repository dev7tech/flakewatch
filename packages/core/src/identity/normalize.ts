/**
 * Characters removed during normalization: control characters (category Cc)
 * that are not whitespace, and bidirectional formatting characters.
 */
const REMOVED_CHARACTERS =
  /[[\p{Cc}--\p{White_Space}]\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gv;

const WHITESPACE_RUN = /\p{White_Space}+/gv;

const EDGE_SPACES = /^ +| +$/g;

/**
 * Normalizes a suite name, test name or variant label (normalization version 1,
 * architecture §5.1), so that the same logical name always yields the same
 * test identity. The steps run in this order:
 *
 * 1. Replace unpaired UTF-16 surrogates with U+FFFD, so the value has exactly
 *    one UTF-8 encoding.
 * 2. Remove control characters (Unicode category Cc) that are not whitespace,
 *    and the bidirectional formatting characters U+061C, U+200E, U+200F,
 *    U+202A–U+202E and U+2066–U+2069.
 * 3. Replace every run of whitespace (Unicode White_Space, which includes tab,
 *    line breaks and no-break space) with one space, then trim spaces at both
 *    ends.
 * 4. Apply Unicode NFC. This runs last because step 2 can bring a base
 *    character and a combining mark together.
 *
 * Case and all other characters are preserved. Changing these rules changes
 * identities, so it requires a new normalization version and a data migration.
 */
export function normalizeName(value: string): string {
  return value
    .toWellFormed()
    .replace(REMOVED_CHARACTERS, '')
    .replace(WHITESPACE_RUN, ' ')
    .replace(EDGE_SPACES, '')
    .normalize('NFC');
}
