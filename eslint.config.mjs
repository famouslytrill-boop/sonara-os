const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  FormData: "readonly",
  alert: "readonly",
  history: "readonly",
  location: "readonly",
  fetch: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  IntersectionObserver: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  Event: "readonly",
  CustomEvent: "readonly",
  HTMLElement: "readonly"
};

const serviceWorkerGlobals = {
  self: "readonly",
  caches: "readonly",
  clients: "readonly",
  registration: "readonly",
  skipWaiting: "readonly",
  fetch: "readonly",
  Request: "readonly",
  Response: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  Promise: "readonly"
};

const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  Buffer: "readonly",
  require: "readonly",
  module: "readonly",
  exports: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  fetch: "readonly"
};

const mochaGlobals = {
  describe: "readonly",
  it: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  before: "readonly",
  after: "readonly"
};

export default [
  {
    ignores: [
      "node_modules/**",
      ".vercel/**",
      "coverage/**",
      "dist/**",
      "build/**",
      "frontend/.next/**",
      "frontend/node_modules/**",
      "my-app/.next/**",
      "my-app/node_modules/**",
      "sonara-industries/**/node_modules/**",
      "**/*.tsbuildinfo"
    ]
  },
  {
    files: ["server.js", "api/**/*.js", "routes/**/*.cjs", "lib/**/*.cjs", "scripts/**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: nodeGlobals
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...nodeGlobals,
        ...mochaGlobals
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["public/sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: serviceWorkerGlobals
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["public/**/*.js"],
    ignores: ["public/sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: browserGlobals
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["*.js", "*.cjs", "*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: nodeGlobals
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  }
];
