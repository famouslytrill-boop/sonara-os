import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["dist/**", "**/dist/**", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        document: "readonly",
        HTMLElement: "readonly",
        localStorage: "readonly",
        process: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
