module.exports = [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".vercel/**",
      ".next/**",
      "coverage/**",
      "app/**",
      "backups/**",
      "components/**",
      "frontend/**",
      "lib/**",
      "my-app/**",
      "src/**",
      "sonara-industries/**",
      "*.bak",
      "*.patch"
    ]
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Request: "readonly"
      }
    }
  },
  {
    files: ["public-sw.js", "public/**/*.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        URL: "readonly"
      }
    }
  },
  {
    files: ["test/**/*.js", "tests/**/*.js"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        before: "readonly",
        after: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly"
      }
    }
  }
];
