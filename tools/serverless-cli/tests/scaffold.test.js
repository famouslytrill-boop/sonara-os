"use strict";

// A new project, checked by running it.
//
// The promise `init` makes is that the thing it writes works: init, dev, curl,
// an answer. So the test scaffolds a real project into a real directory, starts
// the real dev server against it and makes a real request. Asserting that the
// files exist would prove only that files exist -- and a scaffold whose
// serverless.yml does not parse, or whose handler names an export it does not
// have, would pass that happily.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { scaffold } = require("../src/scaffold.js");
const { parse } = require("../src/yaml.js");
const { buildApp } = require("../src/manifest.js");
const { buildTemplate } = require("../src/template.js");
const { serve } = require("../src/dev.js");

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sonara-init-"));
}

for (const typescript of [false, true]) {
  const label = typescript ? "TypeScript" : "JavaScript";

  test(`the ${label} project it writes actually answers a request`, async () => {
    const dir = scratch();
    try {
      scaffold({ directory: dir, name: "demo-app", region: "eu-west-1", typescript });

      // Through the same path the real command uses: parse the file it wrote,
      // validate it, and serve it.
      const app = buildApp(parse(fs.readFileSync(path.join(dir, "serverless.yml"), "utf8")));
      const server = await serve(app, { projectRoot: dir, port: 0 });
      try {
        const response = await fetch(`${server.url}/hello?name=you`);
        assert.equal(response.status, 200, `the scaffolded project answered ${response.status} on its own example route`);
        const body = await response.json();
        assert.equal(body.hello, "you", "the handler did not read the query string the way the README says it does");
        assert.equal(body.stage, "dev", "the environment declared in the generated serverless.yml did not reach the handler");
      } finally {
        await server.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test(`the ${label} project's serverless.yml describes a deployable stack`, () => {
    const dir = scratch();
    try {
      scaffold({ directory: dir, name: "demo-app", region: "eu-west-1", typescript });
      const app = buildApp(parse(fs.readFileSync(path.join(dir, "serverless.yml"), "utf8")));
      const template = buildTemplate(app);

      assert.ok(template.Resources.TableNotes, "the table the example declares is not in the template");
      assert.ok(template.Resources.FnHello, "the example function is not in the template");
      assert.ok(template.Resources.HttpApi, "the example declares routes but no API was created");

      // The grants the YAML asks for have to survive into the policy, or the
      // example deploys and then fails at runtime with AccessDenied.
      const write = JSON.stringify(template.Resources.RoleAddNote.Properties.Policies);
      assert.match(write, /dynamodb:PutItem/, "addNote was granted readwrite but cannot write");
      const read = JSON.stringify(template.Resources.RoleListNotes.Properties.Policies);
      assert.ok(!/dynamodb:PutItem/.test(read), "listNotes asked for read and was granted writes");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("the TypeScript project has no build step in the way", () => {
  const dir = scratch();
  try {
    scaffold({ directory: dir, name: "demo-app", typescript: true });
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));

    assert.equal(pkg.scripts.dev, "sonara-serverless dev",
      "dev runs something other than the tool, which means a build step somebody has to remember");
    assert.ok(!pkg.scripts.build, "the project has a build script, which the README says it does not need");
    assert.ok(!pkg.dependencies.typescript,
      "typescript is a runtime dependency, so it would be uploaded into the deployment package");
    assert.ok(pkg.devDependencies.typescript, "typescript is missing, so the editor cannot check the types");
    assert.ok(fs.existsSync(path.join(dir, "tsconfig.json")));
    assert.ok(fs.existsSync(path.join(dir, "handlers/hello.ts")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// This failed on the first attempt: ESM handlers were written into a package
// declaring "type": "commonjs", and Node refused them with "Unexpected token
// 'export'". Every file the scaffold writes has to agree about which kind of
// module the project is.
test("the TypeScript project is an ES module project, consistently", () => {
  const dir = scratch();
  try {
    scaffold({ directory: dir, name: "demo-app", typescript: true });
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    assert.equal(pkg.type, "module");
    for (const file of ["handlers/hello.ts", "handlers/notes.ts"]) {
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      assert.match(source, /^export /m, `${file} does not export the ES module way`);
      assert.ok(!/^exports\.|module\.exports/m.test(source),
        `${file} mixes CommonJS exports into an ES module project, which will not load`);
    }
    assert.ok(!fs.existsSync(path.join(dir, "handlers/notes.js")),
      "a CommonJS handler was written into an ES module project");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the JavaScript project is a CommonJS project, consistently", () => {
  const dir = scratch();
  try {
    scaffold({ directory: dir, name: "demo-app", typescript: false });
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).type, "commonjs");
    for (const file of ["handlers/hello.js", "handlers/notes.js"]) {
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      assert.ok(!/^export /m.test(source), `${file} uses ES module syntax in a CommonJS project`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the JavaScript project gets no TypeScript files it did not ask for", () => {
  const dir = scratch();
  try {
    scaffold({ directory: dir, name: "demo-app", typescript: false });
    assert.ok(!fs.existsSync(path.join(dir, "tsconfig.json")));
    assert.ok(fs.existsSync(path.join(dir, "handlers/hello.js")));
    assert.ok(!JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).devDependencies);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("refuses to overwrite an existing project, and writes nothing when it does", () => {
  const dir = scratch();
  try {
    fs.writeFileSync(path.join(dir, "serverless.yml"), "name: the-real-one\n");
    assert.throws(
      () => scaffold({ directory: dir, name: "demo-app" }),
      /already has serverless\.yml/,
      "init overwrote an application file, which is the one thing it must never do"
    );
    assert.equal(fs.readFileSync(path.join(dir, "serverless.yml"), "utf8"), "name: the-real-one\n");
    assert.ok(!fs.existsSync(path.join(dir, "handlers")),
      "some files were written before the refusal, leaving a half-scaffolded directory");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ignores an unrelated file already in the directory", () => {
  const dir = scratch();
  try {
    fs.writeFileSync(path.join(dir, "notes.txt"), "mine");
    const written = scaffold({ directory: dir, name: "demo-app" });
    assert.ok(written.includes("serverless.yml"));
    assert.equal(fs.readFileSync(path.join(dir, "notes.txt"), "utf8"), "mine");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the generated .gitignore keeps secrets out of version control", () => {
  const dir = scratch();
  try {
    scaffold({ directory: dir, name: "demo-app" });
    const ignored = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    assert.match(ignored, /^\.env$/m, "a new project would commit its .env file");
    assert.match(ignored, /node_modules/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the notes handler says what is wrong rather than throwing when unconfigured", async () => {
  const dir = scratch();
  try {
    scaffold({ directory: dir, name: "demo-app" });
    const yaml = fs.readFileSync(path.join(dir, "serverless.yml"), "utf8");
    // The table name is not set locally, which is the state anybody running
    // `dev` for the first time is in. A stack trace there would read as the
    // scaffold being broken.
    const app = buildApp(parse(yaml));
    const server = await serve(app, { projectRoot: dir, port: 0 });
    try {
      const response = await fetch(`${server.url}/notes`);
      assert.equal(response.status, 503, `an unconfigured table answered ${response.status} rather than saying so`);
      const body = await response.json();
      assert.match(body.message, /NOTES_TABLE is not set/);
      assert.ok(body.fix, "the handler said what was wrong but not what to do about it");
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
