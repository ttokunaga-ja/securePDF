import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Workspace packages export raw .ts (no build step), so vitest must transform
    // them rather than treat them as external node_modules.
    server: { deps: { inline: [/^@securepdf\//] } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**', 'apps/*/src/**'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/testUtils.ts',
        'apps/web/src/main.tsx',
        'apps/web/src/vite-env.d.ts',
        'packages/codecs/**', // Milestone 5 stub
      ],
    },
    // Two runtimes: pure Node for the engine/CLI/Worker, happy-dom for the React app.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['packages/**/*.test.ts', 'apps/cli/**/*.test.ts', 'apps/worker/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'happy-dom',
          include: ['apps/web/**/*.test.{ts,tsx}'],
          setupFiles: ['./apps/web/vitest.setup.ts'],
        },
      },
    ],
  },
})
