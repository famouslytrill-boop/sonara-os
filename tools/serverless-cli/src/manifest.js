"use strict";

// The one file, and what it is allowed to say.
//
// `yaml.js` decided what the text means. This decides whether what it means is
// a deployable application, and it is deliberately strict in one direction:
// **an unknown key is an error, not something to ignore.**
//
// That is the opposite of what most configuration loaders do, and the reason is
// the same reason the parser refuses `yes`. A tool that ignores `memorySize:`
// because it expected `memory:` deploys a function with the default 128MB and
// prints nothing. The author reads their own file, sees the setting they wrote,
// and has no way to discover it was never read. Every minute spent debugging
// that is a minute the tool caused. Refusing costs one line of output and ends
// there -- and because the refusal knows the valid keys, it can say "did you
// mean memory?" rather than only "no".
//
// ## The shape
//
//     name: orders-api            required, [a-z0-9-], names the stack
//     region: eu-west-1           required
//     runtime: nodejs22.x         optional, the default for every function
//     memory: 512                 optional, the default for every function
//     timeout: 10                 optional, the default for every function
//     environment:                optional, merged into every function
//       TABLE: orders
//
//     functions:
//       checkout:
//         handler: handlers/checkout.handler
//         memory: 1024            overrides the top-level default
//         events:
//           - http: POST /checkout
//           - schedule: rate(5 minutes)
//
//     resources:
//       orders:
//         type: table             a DynamoDB table
//         key: id
//       uploads:
//         type: bucket            an S3 bucket
//       jobs:
//         type: queue             an SQS queue
//
// Three resource types, not thirty. Each one is a thing this tool can create,
// grant a function access to, and describe in a plan honestly. A `type: anything`
// escape hatch would mean the plan could no longer say what would change, which
// is the feature people actually came for.

const PERMISSION_LEVELS = Object.freeze(["read", "write", "readwrite"]);
const RESOURCE_TYPES = Object.freeze(["table", "bucket", "queue"]);

// The runtimes this tool sets up a working project for. Anything else is
// refused rather than passed through: passing an unknown string to Lambda gets
// a deploy-time error from AWS long after the plan said it was fine.
const RUNTIMES = Object.freeze(["nodejs22.x", "nodejs20.x", "nodejs18.x"]);

const DEFAULTS = Object.freeze({
  runtime: "nodejs22.x",
  memory: 512,
  timeout: 10
});

const TOP_LEVEL_KEYS = Object.freeze(["name", "region", "runtime", "memory", "timeout", "environment", "functions", "resources"]);
const FUNCTION_KEYS = Object.freeze(["handler", "runtime", "memory", "timeout", "environment", "events", "uses", "description"]);
const RESOURCE_KEYS = Object.freeze(["type", "key", "sort", "versioned", "visibilityTimeout"]);

const HTTP_METHODS = Object.freeze(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

class ManifestError extends Error {
  constructor(message, where, hint) {
    super(message);
    this.name = "ManifestError";
    this.where = where || "";
    this.hint = hint || "";
  }
}

function fail(message, where, hint) {
  throw new ManifestError(message, where, hint);
}

// Levenshtein, small and bounded. Used only to turn "no such key" into "did you
// mean memory?", which is the difference between a message that ends the
// problem and one that starts a search.
function distance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    for (let j = 1; j < cols; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[cols - 1];
}

function nearest(word, candidates) {
  let best = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const score = distance(word.toLowerCase(), candidate.toLowerCase());
    if (score < bestScore) { bestScore = score; best = candidate; }
  }
  // A containment relationship beats raw edit distance. "memorySize" is four
  // edits from "memory", which a distance threshold rejects -- but it is one of
  // the likeliest things somebody actually types, because it is what a
  // neighbouring tool calls the same setting. Checked before the threshold so
  // the suggestion survives.
  const lower = word.toLowerCase();
  for (const candidate of candidates) {
    const other = candidate.toLowerCase();
    if (lower !== other && (lower.startsWith(other) || other.startsWith(lower))) return candidate;
  }

  // Otherwise, only suggest when it is close enough to be a typo rather than a
  // guess dressed up as help.
  return bestScore <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
}

function rejectUnknownKeys(object, allowed, where) {
  for (const key of Object.keys(object)) {
    if (allowed.includes(key)) continue;
    const suggestion = nearest(key, allowed);
    fail(
      `${where} has a setting called "${key}", which this does not read.`,
      where,
      suggestion
        ? `Did you mean "${suggestion}"? If this were ignored instead of refused, you would have no way to find out it never took effect.`
        : `Settings that can go here: ${allowed.join(", ")}.`
    );
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// A whole number in a range, or a refusal naming the range. `Number(null)` is 0
// and `null >= 1` is true, so an absent value has to be checked before the
// bounds rather than after.
function wholeNumber(value, { where, key, min, max }) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${where}: "${key}" must be a number, and this is ${JSON.stringify(value)}.`, where);
  }
  if (!Number.isInteger(value)) {
    fail(`${where}: "${key}" must be a whole number, and this is ${value}.`, where);
  }
  if (value < min || value > max) {
    fail(`${where}: "${key}" must be between ${min} and ${max}, and this is ${value}.`, where,
      `AWS rejects anything outside that range, so this would fail at deploy time rather than here.`);
  }
  return value;
}

function readEnvironment(value, where) {
  if (value === null || value === undefined) return {};
  if (!isPlainObject(value)) {
    fail(`${where}: "environment" must be a block of NAME: value pairs.`, where);
  }
  const out = {};
  for (const [name, raw] of Object.entries(value)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      fail(`${where}: "${name}" is not a usable environment variable name.`, where,
        "Names may contain letters, digits and underscores, and may not start with a digit.");
    }
    if (raw === null || raw === undefined) {
      // Absent is not empty. An environment variable set to nothing is almost
      // always a value the author meant to fill in and did not.
      fail(`${where}: the environment variable "${name}" has no value.`, where,
        `Give it a value, or delete the line. Deploying it as "" would look deliberate later.`);
    }
    if (isPlainObject(raw) || Array.isArray(raw)) {
      fail(`${where}: the environment variable "${name}" must be a single value.`, where);
    }
    out[name] = String(raw);
  }
  return out;
}

// `- http: POST /checkout` and `- schedule: rate(5 minutes)`.
function readEvents(value, where) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) {
    fail(`${where}: "events" must be a list, each item starting with "- ".`, where);
  }

  return value.map((entry, index) => {
    const at = `${where}, event ${index + 1}`;
    if (!isPlainObject(entry)) {
      fail(`${at} is not a "- http: ..." or "- schedule: ..." item.`, at);
    }
    const keys = Object.keys(entry);
    if (keys.length !== 1) {
      fail(`${at} names ${keys.length} things, and each event is one.`, at,
        `Write each event as its own "- " item.`);
    }
    const [kind] = keys;
    const raw = entry[kind];

    if (kind === "http") {
      const text = String(raw || "").trim();
      const match = text.match(/^([A-Za-z]+)\s+(\/\S*)$/);
      if (!match) {
        fail(`${at}: "${text}" is not a method and a path.`, at, `Write it as "GET /orders".`);
      }
      const method = match[1].toUpperCase();
      if (!HTTP_METHODS.includes(method)) {
        fail(`${at}: "${match[1]}" is not an HTTP method.`, at, `One of: ${HTTP_METHODS.join(", ")}.`);
      }
      return { kind: "http", method, path: match[2] };
    }

    if (kind === "schedule") {
      const text = String(raw || "").trim();
      // Checked here rather than at deploy time. EventBridge rejects a bad
      // expression, and finding out after half a stack has been created is the
      // worst moment to learn it.
      if (!/^rate\(\d+\s+(minute|minutes|hour|hours|day|days)\)$/.test(text) && !/^cron\(.+\)$/.test(text)) {
        fail(`${at}: "${text}" is not a schedule AWS accepts.`, at,
          `Write "rate(5 minutes)" or a "cron(...)" expression.`);
      }
      return { kind: "schedule", expression: text };
    }

    const suggestion = nearest(kind, ["http", "schedule"]);
    fail(`${at}: "${kind}" is not a kind of event this creates.`, at,
      suggestion ? `Did you mean "${suggestion}"?` : `Events can be "http" or "schedule".`);
    return null;
  });
}

// `uses: { orders: readwrite }` -- which resources this function may touch, and
// how. Named rather than inferred: a function that can write to every table in
// the stack because the tool guessed is how a bug in one handler becomes data
// loss in an unrelated table.
function readUses(value, where, resourceNames) {
  if (value === null || value === undefined) return {};
  if (!isPlainObject(value)) {
    fail(`${where}: "uses" must be a block of resource: permission pairs.`, where,
      `For example:\n  uses:\n    orders: readwrite`);
  }
  const out = {};
  for (const [resource, level] of Object.entries(value)) {
    if (!resourceNames.includes(resource)) {
      const suggestion = nearest(resource, resourceNames);
      fail(`${where}: "${resource}" is not a resource in this file.`, where,
        resourceNames.length === 0
          ? "This file declares no resources yet, so there is nothing to grant access to."
          : suggestion
            ? `Did you mean "${suggestion}"? Declared resources: ${resourceNames.join(", ")}.`
            : `Declared resources: ${resourceNames.join(", ")}.`);
    }
    const text = String(level || "").trim();
    if (!PERMISSION_LEVELS.includes(text)) {
      fail(`${where}: "${text}" is not a permission level for "${resource}".`, where,
        `One of: ${PERMISSION_LEVELS.join(", ")}.`);
    }
    out[resource] = text;
  }
  return out;
}

function readResources(value) {
  if (value === null || value === undefined) return [];
  if (!isPlainObject(value)) {
    fail(`"resources" must be a block of named resources.`, "resources");
  }

  return Object.entries(value).map(([name, body]) => {
    const where = `resource "${name}"`;
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      fail(`${where} is not a usable name.`, where,
        "Use lower-case letters, digits and hyphens, starting with a letter.");
    }
    if (!isPlainObject(body)) {
      fail(`${where} has no settings under it.`, where, `At least: type: ${RESOURCE_TYPES.join(" | ")}.`);
    }
    rejectUnknownKeys(body, RESOURCE_KEYS, where);

    const type = String(body.type || "").trim();
    if (!RESOURCE_TYPES.includes(type)) {
      const suggestion = nearest(type, RESOURCE_TYPES);
      fail(`${where} has type "${type || "(none)"}", which this does not create.`, where,
        suggestion
          ? `Did you mean "${suggestion}"?`
          : `This creates: ${RESOURCE_TYPES.join(", ")}. Anything else has to be created outside this file.`);
    }

    if (type === "table") {
      const key = String(body.key || "").trim();
      if (!key) {
        fail(`${where} is a table with no "key".`, where,
          `A DynamoDB table needs a partition key: write "key: id".`);
      }
      return { name, type, key, sort: body.sort ? String(body.sort) : null };
    }
    if (type === "bucket") {
      if (body.versioned !== null && body.versioned !== undefined && typeof body.versioned !== "boolean") {
        fail(`${where}: "versioned" must be true or false.`, where);
      }
      return { name, type, versioned: body.versioned === true };
    }
    return {
      name,
      type,
      visibilityTimeout: wholeNumber(body.visibilityTimeout, { where, key: "visibilityTimeout", min: 0, max: 43200 }) ?? 30
    };
  });
}

/**
 * Turn a parsed YAML document into a validated application.
 *
 * Throws ManifestError, whose message names the place in the file and whose
 * hint says what to write instead. Never returns a partially-understood app:
 * an unknown setting stops this rather than being dropped.
 */
function buildApp(document, { source = "serverless.yml" } = {}) {
  if (document === null || document === undefined) {
    fail(`${source} is empty.`, source, "It needs at least a name, a region and one function.");
  }
  if (!isPlainObject(document)) {
    fail(`${source} does not describe an application.`, source,
      `The file should start with "name:" at the left margin.`);
  }

  rejectUnknownKeys(document, TOP_LEVEL_KEYS, source);

  const name = String(document.name || "").trim();
  if (!name) fail(`This file has no "name".`, source, `The name is used for the stack: write "name: orders-api".`);
  if (!/^[a-z][a-z0-9-]{0,60}$/.test(name)) {
    fail(`"${name}" is not a usable application name.`, source,
      "Use lower-case letters, digits and hyphens, starting with a letter. It becomes the CloudFormation stack name.");
  }

  const region = String(document.region || "").trim();
  if (!region) {
    fail(`This file has no "region".`, source,
      `Write the region to deploy into, for example "region: eu-west-1". There is deliberately no default: deploying to the wrong side of the world silently is worse than being asked.`);
  }
  if (!/^[a-z]{2}(-[a-z]+)+-\d$/.test(region)) {
    fail(`"${region}" is not shaped like an AWS region.`, source, `For example "eu-west-1" or "us-east-1".`);
  }

  const defaultRuntime = document.runtime === null || document.runtime === undefined
    ? DEFAULTS.runtime
    : String(document.runtime).trim();
  if (!RUNTIMES.includes(defaultRuntime)) {
    fail(`"${defaultRuntime}" is not a runtime this sets up.`, source,
      `One of: ${RUNTIMES.join(", ")}. This tool is built around Node.js; another runtime would deploy but nothing here would run it locally.`);
  }

  const defaultMemory = wholeNumber(document.memory, { where: source, key: "memory", min: 128, max: 10240 }) ?? DEFAULTS.memory;
  const defaultTimeout = wholeNumber(document.timeout, { where: source, key: "timeout", min: 1, max: 900 }) ?? DEFAULTS.timeout;
  const sharedEnvironment = readEnvironment(document.environment, source);

  const resources = readResources(document.resources);
  const resourceNames = resources.map((resource) => resource.name);

  if (!isPlainObject(document.functions) || Object.keys(document.functions).length === 0) {
    fail(`This file declares no functions.`, source,
      `Add one:\n  functions:\n    hello:\n      handler: handlers/hello.handler`);
  }

  const functions = Object.entries(document.functions).map(([functionName, body]) => {
    const where = `function "${functionName}"`;
    if (!/^[a-z][a-zA-Z0-9-]{0,60}$/.test(functionName)) {
      fail(`${where} is not a usable name.`, where,
        "Start with a lower-case letter, then letters, digits or hyphens.");
    }
    if (!isPlainObject(body)) {
      fail(`${where} has no settings under it.`, where, `At least: handler: handlers/${functionName}.handler`);
    }
    rejectUnknownKeys(body, FUNCTION_KEYS, where);

    const handler = String(body.handler || "").trim();
    if (!handler) fail(`${where} has no "handler".`, where, `Write "handler: handlers/${functionName}.handler".`);
    // file.export -- checked here so a typo is a message rather than an
    // "Unable to import module" in a log nobody is watching.
    const handlerMatch = handler.match(/^([A-Za-z0-9_\-./]+)\.([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (!handlerMatch) {
      fail(`${where}: "${handler}" is not a file and an exported name.`, where,
        `Write it as "path/to/file.exportedName", for example "handlers/${functionName}.handler".`);
    }
    if (handlerMatch[1].startsWith("/") || handler.includes("..")) {
      fail(`${where}: "${handler}" points outside the project.`, where,
        "A handler path is relative to this file's directory.");
    }

    const runtime = body.runtime === null || body.runtime === undefined ? defaultRuntime : String(body.runtime).trim();
    if (!RUNTIMES.includes(runtime)) {
      fail(`${where}: "${runtime}" is not a runtime this sets up.`, where, `One of: ${RUNTIMES.join(", ")}.`);
    }

    return {
      name: functionName,
      handler,
      handlerFile: handlerMatch[1],
      handlerExport: handlerMatch[2],
      runtime,
      memory: wholeNumber(body.memory, { where, key: "memory", min: 128, max: 10240 }) ?? defaultMemory,
      timeout: wholeNumber(body.timeout, { where, key: "timeout", min: 1, max: 900 }) ?? defaultTimeout,
      description: body.description ? String(body.description) : "",
      // Function-level wins over shared, which is the only order that lets a
      // shared default be overridden at all.
      environment: { ...sharedEnvironment, ...readEnvironment(body.environment, where) },
      events: readEvents(body.events, where),
      uses: readUses(body.uses, where, resourceNames)
    };
  });

  // Two functions cannot answer the same method and path. CloudFormation would
  // accept it and one route would silently win.
  const seenRoutes = new Map();
  for (const fn of functions) {
    for (const event of fn.events) {
      if (event.kind !== "http") continue;
      const route = `${event.method} ${event.path}`;
      if (seenRoutes.has(route)) {
        fail(`Two functions answer "${route}": "${seenRoutes.get(route)}" and "${fn.name}".`, `function "${fn.name}"`,
          "Only one of them would ever receive a request, and which one is not something you get to choose.");
      }
      seenRoutes.set(route, fn.name);
    }
  }

  return {
    name,
    region,
    stackName: name,
    defaults: { runtime: defaultRuntime, memory: defaultMemory, timeout: defaultTimeout },
    environment: sharedEnvironment,
    functions,
    resources,
    // Whether anything is reachable over HTTP decides whether an API is created
    // at all -- an empty API costs nothing but shows up in a plan as a resource
    // nobody asked for.
    hasHttp: functions.some((fn) => fn.events.some((event) => event.kind === "http"))
  };
}

module.exports = {
  buildApp,
  ManifestError,
  DEFAULTS,
  RUNTIMES,
  RESOURCE_TYPES,
  PERMISSION_LEVELS,
  HTTP_METHODS,
  TOP_LEVEL_KEYS,
  FUNCTION_KEYS,
  RESOURCE_KEYS
};
