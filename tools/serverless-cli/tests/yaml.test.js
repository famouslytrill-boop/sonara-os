"use strict";

// The parser is the first place this tool could lie.
//
// Every later step -- what gets deployed, what a plan says will change -- is
// downstream of what this decided the file meant. So these tests are mostly
// about the readings it must REFUSE, not the ones it must accept: an accepted
// misreading is a wrong deployment reporting success, and a refusal is somebody
// reading a message and fixing their file.

const test = require("node:test");
const assert = require("node:assert/strict");

const { parse, YamlError } = require("../src/yaml.js");

function refusal(source) {
  try {
    parse(source);
  } catch (error) {
    if (error instanceof YamlError) return error;
    throw error;
  }
  return null;
}

test("reads a mapping of scalars with their types intact", () => {
  const doc = parse([
    "name: orders",
    "memory: 512",
    "timeout: 10.5",
    "enabled: true",
    "disabled: false",
    "nothing: null",
    "alsoNothing: ~",
    "blank:"
  ].join("\n"));
  assert.deepEqual(doc, {
    name: "orders",
    memory: 512,
    timeout: 10.5,
    enabled: true,
    disabled: false,
    nothing: null,
    alsoNothing: null,
    blank: null
  });
});

test("nests mappings by indentation", () => {
  const doc = parse([
    "functions:",
    "  checkout:",
    "    handler: handlers/checkout.handler",
    "    memory: 256"
  ].join("\n"));
  assert.deepEqual(doc, { functions: { checkout: { handler: "handlers/checkout.handler", memory: 256 } } });
});

test("reads a sequence of scalars and a sequence of mappings", () => {
  const doc = parse([
    "regions:",
    "  - eu-west-1",
    "  - us-east-1",
    "routes:",
    "  - path: /orders",
    "    method: GET",
    "  - path: /orders",
    "    method: POST"
  ].join("\n"));
  assert.deepEqual(doc.regions, ["eu-west-1", "us-east-1"]);
  assert.deepEqual(doc.routes, [
    { path: "/orders", method: "GET" },
    { path: "/orders", method: "POST" }
  ]);
});

test("reads flow collections on one line", () => {
  const doc = parse("methods: [GET, POST]\nlimits: {memory: 512, timeout: 10}");
  assert.deepEqual(doc.methods, ["GET", "POST"]);
  assert.deepEqual(doc.limits, { memory: 512, timeout: 10 });
});

test("keeps a colon that is part of a value rather than splitting on it", () => {
  const doc = parse("url: https://example.com/orders\nat: \"12:30\"");
  assert.equal(doc.url, "https://example.com/orders");
  assert.equal(doc.at, "12:30");
});

test("keeps a # that is inside a value rather than truncating there", () => {
  const doc = parse("tag: build#417   # this part is a comment");
  assert.equal(doc.tag, "build#417");
});

test("reads a literal block scalar with its newlines", () => {
  const doc = parse([
    "policy: |",
    "  first line",
    "  second line"
  ].join("\n"));
  assert.equal(doc.policy, "first line\nsecond line\n");
});

test("folds a folded block scalar and strips with a chomping indicator", () => {
  const doc = parse([
    "note: >-",
    "  one",
    "  two"
  ].join("\n"));
  assert.equal(doc.note, "one two");
});

test("unescapes a double-quoted string and leaves a single-quoted one alone", () => {
  const doc = parse('a: "line\\nbreak"\nb: \'no \\n escape\'');
  assert.equal(doc.a, "line\nbreak");
  assert.equal(doc.b, "no \\n escape");
});

// --- the refusals, which are the point ---------------------------------

test("refuses yes and no rather than picking a YAML version", () => {
  const error = refusal("tracing: yes");
  assert.ok(error, "`tracing: yes` was accepted, so some version's reading of it was chosen silently");
  assert.match(error.message, /different things in different YAML versions/);
  assert.match(error.hint, /Write true or false/);
  assert.equal(error.line, 1);
});

test("refuses a leading-zero number rather than choosing octal or decimal", () => {
  const error = refusal("timeout: 022");
  assert.ok(error, "`022` was accepted, and it is 18 in one YAML version and 22 in the other");
  assert.match(error.message, /octal in YAML 1\.1 and decimal in YAML 1\.2/);
});

test("refuses a tab used for indentation", () => {
  const error = refusal("functions:\n\tcheckout: a");
  assert.ok(error, "a tab indent was accepted, and a tab is any width the editor likes");
  assert.match(error.message, /indented with a tab/);
  assert.equal(error.line, 2);
});

test("refuses a duplicate key rather than silently keeping the last one", () => {
  const error = refusal("memory: 128\nmemory: 512");
  assert.ok(error, "the key was set twice and one of the two values vanished without a word");
  assert.match(error.message, /set twice/);
  assert.equal(error.line, 2);
});

test("refuses a duplicate key inside a flow mapping too", () => {
  const error = refusal("limits: {memory: 128, memory: 512}");
  assert.ok(error, "a flow mapping accepted the same key twice");
  assert.match(error.message, /set twice/);
});

test("refuses anchors and aliases", () => {
  const anchor = refusal("base: &defaults\n  memory: 512");
  assert.ok(anchor, "an anchor was accepted");
  assert.match(anchor.message, /Anchors and aliases are not read here/);
  const alias = refusal("checkout: *defaults");
  assert.ok(alias, "an alias was accepted");
});

test("refuses a merge key", () => {
  const error = refusal("checkout:\n  <<: base\n  memory: 512");
  assert.ok(error, "a merge key was accepted, and it pulls in keys nothing on the page shows");
  assert.match(error.message, /Merge keys are not read here/);
});

test("refuses a tag, including CloudFormation shorthand", () => {
  const error = refusal("bucket: !Ref UploadsBucket");
  assert.ok(error, "!Ref was accepted, so a tag this parser does not implement was treated as text");
  assert.match(error.message, /Tags are not read here/);
  assert.match(error.hint, /!Ref/);
});

test("refuses a second document rather than ignoring everything after it", () => {
  const error = refusal("a: 1\n---\nb: 2");
  assert.ok(error, "a second document was accepted, and its contents would never be read");
  assert.match(error.message, /more than one document/);
});

test("accepts a single leading --- because that is one document, not two", () => {
  const doc = parse("---\na: 1");
  assert.deepEqual(doc, { a: 1 });
});

test("refuses an unterminated quoted string", () => {
  assert.ok(refusal('name: "orders'), "an unterminated double quote was accepted");
  assert.ok(refusal("name: 'orders"), "an unterminated single quote was accepted");
});

test("refuses an escape it does not implement rather than dropping the backslash", () => {
  const error = refusal('a: "c:\\path"');
  assert.ok(error, "an unknown escape was accepted and the backslash silently vanished");
  assert.match(error.message, /is not an escape this reads/);
});

test("refuses a line that is neither a key nor a list item", () => {
  const error = refusal("functions:\n  just some words");
  assert.ok(error, "a line with no colon and no dash was accepted");
  assert.match(error.message, /not a "key: value" pair/);
});

test("refuses an over-indented line that belongs to no key", () => {
  const error = refusal("a: 1\nb: 2\n    c: 3");
  assert.ok(error, "a stray indented line was accepted, so whatever it configured was dropped");
  assert.match(error.message, /belongs to no key/);
});

test("every refusal carries a line number that points into the file", () => {
  const error = refusal(["# a comment", "", "name: orders", "memory: yes"].join("\n"));
  assert.ok(error);
  assert.equal(error.line, 4, "the line number counted stripped lines rather than the file's own");
});

test("reports nothing rather than an empty object for an empty file", () => {
  assert.equal(parse(""), null);
  assert.equal(parse("# only a comment\n"), null);
});
