import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Workspace packages export raw .ts (no build step), so vitest must transform
    // them rather than treat them as external node_modules.
    server: { deps: { inline: [/^@securepdf\//] } },
  },
})
