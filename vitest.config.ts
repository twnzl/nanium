import { defineConfig } from 'vitest/config'

// Root config (used e.g. by the VS Code test explorer): combines the node and the browser test projects.
export default defineConfig({
  test: {
    projects: [
      'vitest.node.config.ts',
      'vitest.browser.config.ts',
    ],
  },
})
