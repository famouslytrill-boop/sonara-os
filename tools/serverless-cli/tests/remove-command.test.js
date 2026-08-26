"use strict";

// The remove command itself, wired up.
//
// `removal.test.js` checks the summary and `aws.test.js` checks the calls. What
// neither can catch is the two of them being connected wrongly -- a command
// that renders a perfect summary of a stack it never read, or that deletes
// before it asks.
//
// So this drives `run(["remove"])` with a fake `fetch` and stdin that is not a
// terminal, and asserts on what was actually sent to AWS. The key assertion is
// a negative one: **no DeleteStack request may be made** when nobody confirmed.
// That is the whole safety property of the command, and it is invisible in the
// output either way.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { run } = require("../src/cli.js");
const { scaffold } = require("../src/scaffold.js");

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-remove-"));
  scaffold({ directory: dir, name: "orders-api", region: "eu-west-1" });
  return dir;
}

const STACK_EXISTS = `<r><Stacks><member><StackStatus>CREATE_COMPLETE</StackStatus></member></Stacks></r>`;
const RESOURCES = `<r><StackResourceSummaries>
  <member><LogicalResourceId>FnHello</LogicalResourceId><PhysicalResourceId>orders-api-FnHello-A</PhysicalResourceId><ResourceType>AWS::Lambda::Function</ResourceType></member>
  <member><LogicalResourceId>TableNotes</LogicalResourceId><PhysicalResourceId>orders-api-TableNotes-B</PhysicalResourceId><ResourceType>AWS::DynamoDB::Table</ResourceType></member>
</StackResourceSummaries></r>`;

// Runs the command with AWS faked and stdout captured. stdin is deliberately
// left as it is: under the test runner it is not a TTY, which is the state a CI
// run is in and the state the refusal has to hold for.
async function runRemove(dir, { answers, argv = ["remove", "--path", dir] } = {}) {
  const sent = [];
  const savedFetch = global.fetch;
  const savedWrite = process.stdout.write.bind(process.stdout);
  const savedErrWrite = process.stderr.write.bind(process.stderr);
  let printed = "";

  global.fetch = async (url, options = {}) => {
    const action = (String(options.body || "").match(/Action=([A-Za-z]+)/) || [])[1] || "";
    sent.push(action);
    const body = answers[action];
    if (body === undefined) throw new Error(`the test did not expect a call to ${action}`);
    return { ok: true, status: 200, text: async () => body, json: async () => ({}) };
  };
  process.stdout.write = (text) => { printed += text; return true; };
  process.stderr.write = (text) => { printed += text; return true; };

  try {
    const code = await run([...argv, "--profile", "test-only"]);
    return { code, sent, printed };
  } finally {
    global.fetch = savedFetch;
    process.stdout.write = savedWrite;
    process.stderr.write = savedErrWrite;
  }
}

// Credentials, without touching the real home directory.
function withCredentials(run_) {
  const saved = { ...process.env };
  process.env.AWS_ACCESS_KEY_ID = "AKIDEXAMPLE";
  process.env.AWS_SECRET_ACCESS_KEY = "secret";
  delete process.env.AWS_SESSION_TOKEN;
  try {
    return run_();
  } finally {
    process.env = saved;
  }
}

test("deletes nothing when nobody confirmed", async () => {
  const dir = scratch();
  try {
    const result = await withCredentials(() => runRemove(dir, {
      answers: { DescribeStacks: STACK_EXISTS, ListStackResources: RESOURCES }
    }));

    assert.ok(
      !result.sent.includes("DeleteStack"),
      "remove called DeleteStack without a confirmation, in a shell where nobody could have given one"
    );
    assert.equal(result.code, 1, "an unconfirmed remove exited 0, which a script would read as done");
    assert.match(result.printed, /Nothing was deleted/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reads the stack before saying anything about it", async () => {
  const dir = scratch();
  try {
    const result = await withCredentials(() => runRemove(dir, {
      answers: { DescribeStacks: STACK_EXISTS, ListStackResources: RESOURCES }
    }));
    assert.ok(result.sent.includes("ListStackResources"),
      "the summary was rendered without ever asking what is in the stack");
    assert.ok(
      result.sent.indexOf("ListStackResources") < (result.sent.indexOf("DeleteStack") + 1 || Infinity),
      "the stack was read after the delete rather than before it"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("names what survives, with its real AWS name", async () => {
  const dir = scratch();
  try {
    const result = await withCredentials(() => runRemove(dir, {
      answers: { DescribeStacks: STACK_EXISTS, ListStackResources: RESOURCES }
    }));
    assert.match(result.printed, /KEPT/);
    assert.match(result.printed, /orders-api-TableNotes-B/,
      "the surviving table was not named, so nobody could find it to clean up");
    assert.match(result.printed, /FnHello/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("says there is nothing to remove rather than trying", async () => {
  const dir = scratch();
  try {
    const result = await withCredentials(() => runRemove(dir, {
      answers: {
        DescribeStacks: "<ErrorResponse><Error><Code>ValidationError</Code><Message>Stack with id orders-api does not exist</Message></Error></ErrorResponse>"
      }
    }));
    // The fake answers 200 for everything, so a "does not exist" body reaching
    // describeStack still resolves to exists:false through the same path a real
    // 400 would take.
    assert.equal(result.code, 0);
    assert.ok(!result.sent.includes("DeleteStack"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("--yes is refused when something in the stack is unclassified", async () => {
  const dir = scratch();
  try {
    const result = await withCredentials(() => runRemove(dir, {
      argv: ["remove", "--path", dir, "--yes"],
      answers: {
        DescribeStacks: STACK_EXISTS,
        ListStackResources: `<r><StackResourceSummaries><member><LogicalResourceId>Mystery</LogicalResourceId><ResourceType>AWS::Kinesis::Stream</ResourceType></member></StackResourceSummaries></r>`
      }
    }));
    assert.ok(
      !result.sent.includes("DeleteStack"),
      "--yes deleted a stack containing a resource nobody could say would survive"
    );
    assert.match(result.printed, /--yes is not honoured here/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// This test was weaker than its name to begin with, and a probe proved it.
// Removing the early return after a failed read left it passing, because the
// confirmation prompt caught the request anyway -- so it was really testing the
// confirmation, not the failed-read guard.
//
// The two assertions below are the ones that separate them. A failed read must
// not produce a sentence *describing* the stack, and with --yes there is no
// confirmation left to save it: an empty list read as real would sail straight
// into DeleteStack.
test("does not describe a stack it failed to read", async () => {
  const dir = scratch();
  const restore = fakeAws({
    DescribeStacks: STACK_EXISTS,
    ListStackResources: { fail: true }
  });
  try {
    const printed = restore.capture();
    const code = await withCredentials(() => run(["remove", "--path", dir, "--profile", "test-only"]));
    assert.equal(code, 1);
    assert.ok(
      !/no resources in it/.test(printed()),
      "a failed read produced the sentence for a genuinely empty stack, which reads as safe to delete"
    );
    assert.ok(
      !/These are deleted/.test(printed()),
      "a failed read rendered a summary of contents nobody had seen"
    );
  } finally {
    restore.done();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("--yes does not delete a stack whose contents could not be read", async () => {
  const dir = scratch();
  const restore = fakeAws({
    DescribeStacks: STACK_EXISTS,
    ListStackResources: { fail: true }
  });
  try {
    restore.capture();
    const code = await withCredentials(() => run(["remove", "--path", dir, "--yes", "--profile", "test-only"]));
    assert.equal(code, 1);
    assert.ok(
      !restore.sent.includes("DeleteStack"),
      "with --yes there is no confirmation to fall back on, and a stack nobody could read was deleted anyway"
    );
  } finally {
    restore.done();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A small harness so the two tests above can fail one call and answer another.
function fakeAws(answers) {
  const sent = [];
  const savedFetch = global.fetch;
  const savedOut = process.stdout.write.bind(process.stdout);
  const savedErr = process.stderr.write.bind(process.stderr);
  let printed = "";

  global.fetch = async (url, options = {}) => {
    const action = (String(options.body || "").match(/Action=([A-Za-z]+)/) || [])[1] || "";
    sent.push(action);
    const answer = answers[action];
    if (answer === undefined) throw new Error(`the test did not expect a call to ${action}`);
    if (answer && answer.fail) {
      return {
        ok: false, status: 500,
        text: async () => "<ErrorResponse><Error><Code>InternalFailure</Code><Message>try again</Message></Error></ErrorResponse>"
      };
    }
    return { ok: true, status: 200, text: async () => answer, json: async () => ({}) };
  };

  return {
    sent,
    capture() {
      process.stdout.write = (text) => { printed += text; return true; };
      process.stderr.write = (text) => { printed += text; return true; };
      return () => printed;
    },
    done() {
      global.fetch = savedFetch;
      process.stdout.write = savedOut;
      process.stderr.write = savedErr;
    }
  };
}

test("stops rather than guessing when the resource list cannot be read", async () => {
  const dir = scratch();
  const savedFetch = global.fetch;
  const savedWrite = process.stdout.write.bind(process.stdout);
  const savedErrWrite = process.stderr.write.bind(process.stderr);
  let printed = "";
  const sent = [];
  try {
    global.fetch = async (url, options = {}) => {
      const action = (String(options.body || "").match(/Action=([A-Za-z]+)/) || [])[1] || "";
      sent.push(action);
      if (action === "DescribeStacks") {
        return { ok: true, status: 200, text: async () => STACK_EXISTS };
      }
      return {
        ok: false, status: 500,
        text: async () => "<ErrorResponse><Error><Code>InternalFailure</Code><Message>try again</Message></Error></ErrorResponse>"
      };
    };
    process.stdout.write = (text) => { printed += text; return true; };
    process.stderr.write = (text) => { printed += text; return true; };

    const code = await withCredentials(() => run(["remove", "--path", dir, "--profile", "test-only"]));

    assert.equal(code, 1);
    assert.ok(
      !sent.includes("DeleteStack"),
      "the resource list failed to read and the stack was deleted anyway, with nobody having seen what was in it"
    );
    assert.match(printed, /Could not read what is in/);
    assert.match(printed, /Nothing was deleted/);
  } finally {
    global.fetch = savedFetch;
    process.stdout.write = savedWrite;
    process.stderr.write = savedErrWrite;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
