import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import n from 'eslint-plugin-n';
import tseslint from 'typescript-eslint';

// Invisible and direction-changing characters (Trojan Source). In code they
// must be written as \u escapes so that reviewers can see them.
const INVISIBLE =
  '/[\\u061C\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2069\\uFEFF]/';
const INVISIBLE_MESSAGE =
  'Write invisible or bidirectional characters as \\u escapes, not literally.';

export default defineConfig(
  // Fixtures are byte-exact test inputs written for other toolchains.
  globalIgnores(['**/dist/', '**/coverage/', 'fixtures/']),

  js.configs.recommended,

  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // As in the strict preset, except that numbers may be interpolated.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowAny: false,
          allowBoolean: false,
          allowNever: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
        },
      ],
    },
  },

  {
    plugins: { n },
    languageOptions: {
      // Declaring Node.js globals lets n check APIs such as `process.*`
      // against the Node.js versions in the nearest package.json `engines`.
      globals: n.configs['flat/recommended-module'].languageOptions.globals,
    },
    rules: {
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
      'no-irregular-whitespace': [
        'error',
        { skipStrings: false, skipTemplates: false, skipRegExps: false },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[raw=${INVISIBLE}]`, message: INVISIBLE_MESSAGE },
        {
          selector: `TemplateElement[value.raw=${INVISIBLE}]`,
          message: INVISIBLE_MESSAGE,
        },
      ],
      'n/no-deprecated-api': 'error',
      'n/no-unsupported-features/node-builtins': 'error',
      'n/prefer-node-protocol': 'error',
    },
  },
);
