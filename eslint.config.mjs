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
  // The call client in public/sonara-call.js. Named for the same reason as
  // every other entry here rather than switching to a wholesale browser preset:
  // a browser script gets no feedback before a customer loads it, so an
  // undefined global has to be an error at lint time or it is a runtime failure
  // in the middle of somebody's call.
  RTCPeerConnection: "readonly",
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
  fetch: "readonly",
  // Named because a file this config now covers reaches for it, in the same
  // spirit as browserGlobals above: each of these five was reported by a
  // no-undef error once scripts/**/*.mjs, tests/**/*.cjs and tests/**/*.mjs came
  // into scope, rather than added in case.
  //
  // AbortSignal: scripts/verify-production-supabase.mjs line 205.
  // TextDecoder: scripts/verify-tracked-text-encoding.mjs line 115.
  // WebSocket: tests/helpers/headless.cjs line 154.
  // setInterval and clearInterval: the same helper's poll loop.
  AbortSignal: "readonly",
  TextDecoder: "readonly",
  WebSocket: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly"
};

// The rules, in one place.
//
// This object used to be written out five times, once per config block below,
// and the five copies were identical. Adding a rule meant adding it five times
// and a rule added four times would have applied to whichever surface was
// missed, silently.
//
// ## Why the rules are named rather than extending a preset
//
// `no-dupe-keys` and the sixteen rules beside it are part of `eslint:recommended`,
// which this config does not extend. `@eslint/js`, the package that carries
// `js.configs.recommended`, is not a dependency of this project -- ESLint 10 does
// not bring it in, and `ls node_modules/.pnpm/eslint@10.7.0/node_modules/@eslint/`
// shows config-array, config-helpers, core and plugin-kit and no `js`. Extending
// the preset therefore means adding a dependency, which is a bigger decision than
// this, so the rules that matter here are named.
//
// The seventeen were run against the whole linted tree before being switched on:
// seven errors, every one of them `no-dupe-keys`, in
// lib/sonara-route-registry.cjs (six keys written twice, one with a different
// value that was silently overridden) and one test fixture. Both are fixed in the
// same commit as this change. Nothing else in the tree trips any of them, so
// turning them on is a guard against the next one rather than a cleanup.
//
// `no-unused-vars` stays a warning with `--max-warnings=0` behind it, which is
// how it was.
const correctnessRules = {
  "no-undef": "error",
  "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
  // A key written twice. The object keeps the last one, so the earlier value is
  // dead code that reads exactly like live code -- and deleting the later
  // "duplicate" silently changes the value. This is the rule that found real
  // defects in this repository.
  "no-dupe-keys": "error",
  "no-dupe-args": "error",
  "no-dupe-class-members": "error",
  "no-duplicate-case": "error",
  // Code after a return, a self-assignment, a condition that cannot vary: each
  // is a statement that looks like it does something.
  "no-unreachable": "error",
  "no-self-assign": "error",
  "no-constant-condition": "error",
  "no-sparse-arrays": "error",
  "no-fallthrough": "error",
  "no-cond-assign": "error",
  "no-empty-pattern": "error",
  // `!a in b` and `typeof x === "strnig"` are both quiet wrong answers.
  "no-unsafe-negation": "error",
  "no-compare-neg-zero": "error",
  "no-misleading-character-class": "error",
  "require-yield": "error",
  "valid-typeof": "error",
  "use-isnan": "error"
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
    rules: { ...correctnessRules }
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
    rules: { ...correctnessRules }
  },
  {
    files: ["public/sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: serviceWorkerGlobals
    },
    rules: { ...correctnessRules }
  },
  {
    files: ["public/**/*.js"],
    ignores: ["public/sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: browserGlobals
    },
    rules: { ...correctnessRules }
  },
  // The 184 files this command named and did not lint.
  //
  // `pnpm run lint` passes server.js, api, routes, lib, scripts, tests, public,
  // examples and tools. It visited 918 files and applied no rule at all to 184 of
  // them, because every block above matches an extension that those files do not
  // have: `scripts/**/*.cjs` is covered and `scripts/**/*.mjs` was not, and the
  // last block's `*.mjs` has no `**/` so it matches only the repository root.
  //
  // Measured with `eslint --print-config` on one file per directory and
  // extension: api/*.js 1, routes/*.cjs 46, lib/*.cjs 258, scripts/*.cjs 15,
  // tests/*.js 393, public/*.js 20 and server.js resolved to two rules; lib/*.js
  // 1, scripts/*.mjs 108, tests/*.cjs 11, tests/*.mjs 4, examples/*.js 2,
  // tools/*.js 57 and tools/*.mjs 1 resolved to none. A file in scripts/ carrying
  // both a duplicate object key and a call to an undefined function linted clean
  // and exited 0.
  //
  // The 108 unlinted files in scripts/ are the release-chain gates themselves --
  // every verify-* and report-* command. A green lint run over the checks that
  // are supposed to catch things, which never read them, is the shape this
  // repository keeps finding.
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...nodeGlobals, ...mochaGlobals }
    },
    rules: { ...correctnessRules }
  },
  {
    files: ["tests/**/*.cjs", "lib/**/*.js", "examples/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...nodeGlobals, ...mochaGlobals }
    },
    rules: { ...correctnessRules }
  },
  // tools/ -- the four sub-projects, now covered.
  //
  // They were left out when the blocks above were written, because linting them
  // surfaced ten problems and three needed answering before the config could be
  // green without burying them. Answered:
  //
  //   `fail(code, message, namespace)` in tools/aws-emulator/src/services/identity.js
  //     took a namespace from all ten of its call sites and dropped it, so every
  //     IAM and STS error went out under SQS's xmlns while the matching success
  //     went out under the right one. A real defect. queryErrorXml now takes a
  //     namespace, and tests/emulator.test.js asserts each envelope's xmlns.
  //   `handleSts(request, { store })` destructured a store it never used -- STS
  //     here is stateless. Destructure dropped; the dispatcher passes the context
  //     to both handlers regardless.
  //   `SERVERLESS_YML(name, region, typescript)` in
  //     tools/serverless-cli/src/scaffold.js ignored `typescript`, and that one is
  //     NOT a defect: with no build step and extension-less handler paths the
  //     manifest is identical for .js and .ts, which the section at the top of
  //     that file explains. Parameter removed rather than used.
  //
  // The remainder were this config's fault rather than the code's:
  // tools/songsmith/public is browser code being read as Node, and `region` in
  // identity.js is ignored on purpose with a comment saying why, so it is
  // `_region` now.
  {
    files: ["tools/**/*.js"],
    ignores: ["tools/**/public/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...nodeGlobals, ...mochaGlobals }
    },
    rules: { ...correctnessRules }
  },
  // A .mjs under tools/ is a module, like every other .mjs here. Reading it as
  // commonjs is a parse error on its first import, which is how this line earned
  // its own block rather than sharing the one above.
  {
    files: ["tools/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...nodeGlobals, ...mochaGlobals }
    },
    rules: { ...correctnessRules }
  },
  {
    files: ["tools/**/public/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: browserGlobals
    },
    rules: { ...correctnessRules }
  },
  {
    files: ["*.js", "*.cjs", "*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: nodeGlobals
    },
    rules: { ...correctnessRules }
  }
];
