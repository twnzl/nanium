import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    rules: {
      "eqeqeq": "off",
      // Disable the base rule for TypeScript files
      "no-unused-vars": "off",
      "no-undef": "off",
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/member-ordering": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/dot-notation": "off",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/only-throw-error": "off",
      "prefer-arrow/prefer-arrow-functions": "off",
      "jsdoc/newline-after-description": "off",
      "max-len": "off",
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^(_|h)',
          varsIgnorePattern: '^(_|h)',
          destructuredArrayIgnorePattern: '^(_|h)',
          caughtErrors: 'all'
        },
      ],
    },
    "ignores": [
      "**/node_modules/**",
      "vitest.config.*",
    ]
  },
  // StencilJS-specific configuration
  {
    files: ["**/*.tsx", "**/src/**/*.ts"],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^(_|h)',
          varsIgnorePattern: '^(_|h)',
          destructuredArrayIgnorePattern: '^(_|h)',
          caughtErrors: 'all',
          ignoreRestSiblings: true
        },
      ],
    },
  }
]);