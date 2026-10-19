import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import n from 'eslint-plugin-n';
import tseslint from 'typescript-eslint';

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
      'n/no-deprecated-api': 'error',
      'n/no-unsupported-features/node-builtins': 'error',
      'n/prefer-node-protocol': 'error',
    },
  },
);
