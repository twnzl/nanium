import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'browser',
    testTimeout: 60000,
    // all test files share the same test servers; requests of one file emit events that other files would receive
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: playwright(),
      // headless: true,
      // https://vitest.dev/config/browser/playwright
      instances: [
        { browser: 'chromium', headless: true },
      ],
    },
    include: [
      'src/tests/browser/**/*.{test,spec}.ts',
    ],
    exclude: [
      'node_modules/**',
      'src/tests/test-server/**',
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
//       'src/tests/browser/**/*.{test,spec}.ts',
//     ]
//   },
// });