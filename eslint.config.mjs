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
  HTMLElement: "readonly",
  // Named one at a time rather than pulling the whole browser set in, so this
  // list stays a record of what the scripts in public/ actually reach for.
  // CSS.supports is how sonara-scroll.js asks whether the browser drives the
  // progress bar itself; Image is how it preloads a frame.
  CSS: "readonly",
  Image: "readonly",
  // The frame extractor and the zip container. TextEncoder and Blob are how a
  // frame becomes bytes; CompressionStream is the browser's deflate, which is
  // the only reason the zip can be built on the customer's own machine;
  // MediaRecorder and URL round-trip the video. `module` and `self` are there
  // because sonara-zip-core.js and sonara-frame-plan.js are loaded by both the
  // browser and lib/ -- one implementation of a binary format rather than two.
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  Blob: "readonly",
  Response: "readonly",
  CompressionStream: "readonly",
  MediaRecorder: "readonly",
  // The notification permission flow in public/sonara-push.js. Named here
  // rather than switching this file to a wholesale `browser` preset, for the
  // reason every other entry above is named: a browser script gets no feedback
  // before a customer loads it, so an undefined global has to be an error here
  // or it is a runtime failure nobody sees.
  Notification: "readonly",
  module: "writable",
  self: "readonly"
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
  Headers: "readonly",
  Request: "readonly",
  Response: "readonly",
  FormData: "readonly",
  Blob: "readonly",
  AbortController: "readonly",
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
