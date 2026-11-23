import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    testTimeout: 60000,
    browser: {
      enabled: true,
      provider: playwright(),
      // headless: true,
      // https://vitest.dev/config/browser/playwright
      instances: [
        { browser: 'chromium' },
      ],
    },
    include: [
      '_src/tests/browser/**/*.{test,spec}.ts',
    ],
    exclude: [
      'node_modules/**',
      '_src/tests/test-server/**',
    ],
  },
})


// import { defineConfig } from 'vitest/config';

// export default defineConfig({
//   test: {
//     browser: {
//       enabled: true,
//       name: 'chromium', // or 'firefox', 'webkit'
//       provider: 'playwright',
//       headless: true, // set to false to see the browser
//     },
//     include: [
//       '_src/tests/browser/**/*.{test,spec}.ts',
//     ]
//   },
// });