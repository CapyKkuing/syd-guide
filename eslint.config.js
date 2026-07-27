import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "assets/**",
      "dist/**",
      "docs/**",
      ".tmp/**",
      ".wrangler/**",
      "node_modules/**",
      "public/**",
      "stitch_sydney_travel_guidebook_extracted/**"
    ]
  },
  {
    files: ["worker/**/*.ts", "test/**/*.ts", "vitest.worker.config.ts"],
    languageOptions: {
      ecmaVersion: 2024,
      globals: { ...globals.node, ...globals.worker },
      parser: tseslint.parser,
      parserOptions: { sourceType: "module" }
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off"
    }
  },
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts", "vitest.config.ts"],
    languageOptions: {
      ecmaVersion: 2024,
      globals: { ...globals.browser, ...globals.node },
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-undef": "off",
      "react-refresh/only-export-components": ["warn", { "allowConstantExport": true }]
    }
  },
  {
    files: ["eslint.config.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.node,
      sourceType: "module"
    },
    rules: js.configs.recommended.rules
  }
];
