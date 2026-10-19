import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      // List source files explicitly, so that untested files show up as 0%.
      include: ['packages/*/src/**/*.ts'],
    },
  },
});
