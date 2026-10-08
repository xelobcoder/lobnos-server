import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
     resolve: {
          // Legacy .js files in src are never compiled (no allowJs); prefer the .ts module like the built server does.
          extensions: ['.ts', '.mts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
     },
     test: {
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [
               ...configDefaults.exclude,
               'dist/**',
               // These use the node:test runner; run them with `npm run test:email`.
               'src/models/application/email/tests/**',
          ],
     },
});
