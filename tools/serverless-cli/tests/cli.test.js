"use strict";

// The command line, driven the way somebody drives it.
//
// These run the real binary as a child process and read what it printed. That
// is slower than calling `run()` directly and it is the point: exit codes,
// stdout-versus-stderr and the shape of an error message are things a caller
// only finds out about by being one.
//
// The commands that talk to AWS are represented here only by what they do
// *before* they talk to AWS -- refusing a broken file, refusing when there are
// no credentials. Their AWS half has never run against a live account, which
// the README states rather than implies.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");

const BIN = path.join(__dirname, "..", "bin", "sonara-serverless.js");

function cli(args, { cwd = process.cwd(), env = {} } = {}) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [BIN, ...args],
      {
        cwd,
        env: {
          ...process.env,
          // Credentials must not leak in from whatever machine this runs on, or
          // "refuses without credentials" would pass or fail by accident.
          AWS_ACCESS_KEY_ID: "", AWS_SECRET_ACCESS_KEY: "", AWS_SESSION_TOKEN: "",
          HOME: cwd, NO_COLOR: "1",
          ...env
        }
      },
      (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr, all: `${stdout}${stderr}` })
    );
  });
}

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sonara-cli-"));
}

test("prints the commands, and exits 0 for help", async () => {
  const result = await cli(["help"]);
  assert.equal(result.code, 0);
  for (const command of ["init", "dev", "plan", "deploy", "login"]) {
    assert.match(result.stdout, new RegExp(`\\b${command}\\b`), `help does not mention ${command}`);
  }
});

test("exits non-zero for no command, so a script notices", async () => {
  const result = await cli([]);
  assert.equal(result.code, 0, "bare invocation should print help and succeed");
});

test("suggests the real command when one is misspelled", async () => {
  const result = await cli(["deply"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /no command called "deply"/);
  assert.match(result.stderr, /Did you mean "deploy"\?/);
});

test("init writes a project, and dev then runs it", async () => {
  const dir = scratch();
  try {
    const created = await cli(["init", "."], { cwd: dir });
    assert.equal(created.code, 0, created.all);
    assert.match(created.stdout, /Created/);
    assert.ok(fs.existsSync(path.join(dir, "serverless.yml")));

    // The proof that init worked is that the next command in the README works.
    const { parse } = require("../src/yaml.js");
    const { buildApp } = require("../src/manifest.js");
    const { serve } = require("../src/dev.js");
    const app = buildApp(parse(fs.readFileSync(path.join(dir, "serverless.yml"), "utf8")));
    const server = await serve(app, { projectRoot: dir, port: 0 });
    try {
      assert.equal((await fetch(`${server.url}/hello`)).status, 200);
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("init refuses to overwrite, and says nothing was written", async () => {
  const dir = scratch();
  try {
    await cli(["init", "."], { cwd: dir });
    const again = await cli(["init", "."], { cwd: dir });
    assert.equal(again.code, 1);
    assert.match(again.stderr, /already has/);
    assert.match(again.stderr, /Nothing has been written/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("says where to look when there is no serverless.yml", async () => {
  const dir = scratch();
  try {
    const result = await cli(["plan"], { cwd: dir });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /There is no serverless\.yml/);
    assert.match(result.stderr, /sonara-serverless init/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("points at the offending line when the YAML is wrong", async () => {
  const dir = scratch();
  try {
    fs.writeFileSync(path.join(dir, "serverless.yml"), [
      "name: broken-app",
      "region: eu-west-1",
      "tracing: yes",
      "functions:",
      "  a:",
      "    handler: a.handler"
    ].join("\n"));

    const result = await cli(["plan"], { cwd: dir });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /line 3/, "the error does not say which line");
    assert.match(result.stderr, /tracing: yes/, "the error does not show the offending line");
    assert.match(result.stderr, /Write true or false/, "the error does not say what to write instead");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("names the setting and suggests the real one when it is unknown", async () => {
  const dir = scratch();
  try {
    fs.writeFileSync(path.join(dir, "serverless.yml"), [
      "name: app", "region: eu-west-1", "memorySize: 1024",
      "functions:", "  a:", "    handler: a.handler"
    ].join("\n"));
    const result = await cli(["plan"], { cwd: dir });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Did you mean "memory"\?/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("says there are no credentials, and how to get some, rather than failing at AWS", async () => {
  const dir = scratch();
  try {
    await cli(["init", "."], { cwd: dir });
    const result = await cli(["plan"], { cwd: dir });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /No AWS credentials were found/);
    assert.match(result.stderr, /sonara-serverless login/, "the error does not say how to get credentials");
    assert.match(result.stderr, /Looked in:/, "the error does not say where it looked");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("login refuses without knowing the account and role, and says where to find them", async () => {
  const dir = scratch();
  try {
    const result = await cli(["login", "--region", "eu-west-1"], { cwd: dir });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /which account and role/);
    assert.match(result.stderr, /access portal/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("remove says it is not implemented rather than pretending", async () => {
  const dir = scratch();
  try {
    await cli(["init", "."], { cwd: dir });
    fs.mkdirSync(path.join(dir, ".sonara-serverless"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".sonara-serverless", "credentials.json"),
      JSON.stringify({ default: { accessKeyId: "AK", secretAccessKey: "SK" } }));

    const result = await cli(["remove"], { cwd: dir });
    assert.equal(result.code, 1, "remove exited 0 while doing nothing, which a script would read as success");
    assert.match(result.all, /Not implemented/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("errors go to stderr, so piping stdout does not swallow them", async () => {
  const dir = scratch();
  try {
    const result = await cli(["plan"], { cwd: dir });
    assert.match(result.stderr, /There is no serverless\.yml/);
    assert.ok(!/There is no serverless\.yml/.test(result.stdout),
      "the error was written to stdout, so `sonara-serverless plan > out` hides it");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("prints no colour codes when nothing is watching", async () => {
  const result = await cli(["help"]);
  assert.ok(!result.all.includes(String.fromCharCode(27)),
    "escape codes were written into output that is being piped, which fills a log with rubbish");
});

// --- argument parsing --------------------------------------------------

test("parses the flag shapes people actually type", () => {
  const { parseArgv } = require("../src/cli.js");
  assert.deepEqual(parseArgv(["init", "my-app", "--typescript"]), {
    args: ["init", "my-app"], options: { typescript: true }
  });
  assert.deepEqual(parseArgv(["dev", "--port", "4000"]).options, { port: "4000" });
  assert.deepEqual(parseArgv(["dev", "--port=4000"]).options, { port: "4000" });
  assert.deepEqual(parseArgv(["deploy", "--no-yes"]).options, { yes: false });
  // A flag immediately before another flag takes no value from it.
  assert.deepEqual(parseArgv(["deploy", "--yes", "--profile", "work"]).options, { yes: true, profile: "work" });
});
