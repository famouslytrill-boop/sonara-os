"use strict";

// The commands, and what each one promises.
//
//   init     write a new project that already works
//   dev      run it on this machine
//   plan     ask CloudFormation what deploying would change
//   deploy   plan, then do it
//   login    sign in through the browser
//   whoami   which account these credentials are for
//   info     what is deployed, and where it answers
//   remove   take the stack down
//
// ## What has been run and what has not
//
// `init`, `dev`, `plan`'s rendering, the packaging, the signing and the login
// construction are all exercised by the test suite. **The calls to AWS have
// never been made against a live account** -- there is no AWS account attached
// to this repository -- so `deploy`, `info` and `remove` are written and
// unverified end to end. The README says so in those words. Saying it here too
// because this is the file somebody reads before trusting the command.
//
// ## Why deploy always plans first
//
// Not as a courtesy. A change set is the only way to find out that an update
// would *replace* a table rather than modify it, and that difference is the
// difference between a deployment and a data loss. So `deploy` creates the
// change set, renders it, and only then executes -- and stops to ask when
// something would be replaced.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const readline = require("node:readline");

const ui = require("./ui.js");
const { parse, YamlError } = require("./yaml.js");
const { buildApp, ManifestError } = require("./manifest.js");
const { buildTemplate } = require("./template.js");
const { buildPlan } = require("./plan.js");
const { createZip, collectFiles, keyFor } = require("./bundle.js");
const { scaffold } = require("./scaffold.js");
const { serve } = require("./dev.js");
const credentials = require("./credentials.js");
const login = require("./login.js");
const aws = require("./aws.js");

const MANIFEST_NAMES = Object.freeze(["serverless.yml", "serverless.yaml"]);

// A failure this tool understands, as opposed to a crash. Everything thrown
// deliberately carries a hint; `run` prints the hint and exits 1, and anything
// without one is reported as a bug in this tool rather than as user error.
class CommandError extends Error {
  constructor(message, { hint, where, detail } = {}) {
    super(message);
    this.name = "CommandError";
    this.hint = hint || "";
    this.where = where || "";
    this.detail = detail || "";
  }
}

function findManifest(directory) {
  for (const name of MANIFEST_NAMES) {
    const candidate = path.join(directory, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new CommandError(`There is no ${MANIFEST_NAMES[0]} in ${directory}.`, {
    hint: "Run `sonara-serverless init` to start a new application here, or change to the directory that has one."
  });
}

// Read and validate, turning both parser and manifest errors into the same
// shape so the caller does not have to know which layer refused.
function loadApp(directory) {
  const file = findManifest(directory);
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(process.cwd(), file) || path.basename(file);

  let document;
  try {
    document = parse(source);
  } catch (error) {
    if (error instanceof YamlError) {
      const offending = source.split(/\r?\n/)[error.line - 1];
      throw new CommandError(error.message, {
        where: `${relative}, line ${error.line}`,
        detail: offending === undefined ? "" : `${String(error.line).padStart(4)} | ${offending}`,
        hint: error.hint
      });
    }
    throw error;
  }

  try {
    return { app: buildApp(document, { source: relative }), file, directory };
  } catch (error) {
    if (error instanceof ManifestError) {
      throw new CommandError(error.message, { where: error.where || relative, hint: error.hint });
    }
    throw error;
  }
}

function getCredentials(options) {
  try {
    return credentials.resolveCredentials({ profile: options.profile || "default" });
  } catch (error) {
    if (error instanceof credentials.NoCredentials) {
      throw new CommandError(error.message, { hint: error.hint });
    }
    throw error;
  }
}

function ask(question) {
  // Not a terminal means nobody is there to answer. Defaulting to "yes" in CI
  // would make the confirmation decorative exactly where it matters most.
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

// --- init --------------------------------------------------------------

async function commandInit(args, options) {
  const directory = path.resolve(args[0] || ".");
  const name = options.name || path.basename(directory).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "my-app";
  const region = options.region || "eu-west-1";
  const typescript = options.typescript === true || options.ts === true;

  fs.mkdirSync(directory, { recursive: true });

  let written;
  try {
    written = scaffold({ directory, name, region, typescript });
  } catch (error) {
    if (error.code === "would_overwrite") throw new CommandError(error.message, { hint: error.hint });
    throw error;
  }

  ui.heading(`Created ${name}`);
  for (const file of written) ui.note(`  ${file}`);

  ui.heading("Next");
  const where = path.relative(process.cwd(), directory);
  if (where) ui.line(`  cd ${where}`);
  ui.line("  pnpm install");
  ui.line("  sonara-serverless dev");
  ui.line("");
  ui.note("  Then: curl localhost:3000/hello");
  return 0;
}

// --- dev ---------------------------------------------------------------

async function commandDev(args, options) {
  const { app, directory } = loadApp(path.resolve(options.path || "."));
  const port = Number(options.port || 3000);

  const server = await serve(app, { projectRoot: directory, port, log: (text) => ui.line(ui.colour.dim(text)) });

  ui.heading(`${app.name} is running on ${server.url}`);
  if (server.routes.length) {
    ui.table(server.routes.map((route) => [route.method, route.path, ui.colour.dim(route.fn.name)]));
  } else {
    ui.warn("This application has no HTTP routes, so there is nothing to call.");
    ui.note("  Add one under a function:  events:\n                              - http: GET /hello");
  }

  ui.line("");
  ui.note("Handlers reload on every request, so edits take effect without restarting.");
  ui.note("This runs your handlers; it does not reproduce Lambda's limits or cold starts.");
  ui.note("Ctrl-C to stop.");

  await new Promise((resolve) => {
    process.on("SIGINT", resolve);
    process.on("SIGTERM", resolve);
  });
  await server.close();
  ui.line("");
  ui.success("Stopped.");
  return 0;
}

// --- the shared half of plan and deploy --------------------------------

// The bucket deployment packages go in. Per account and region rather than per
// application, so a second application does not create a second bucket.
function artifactBucket(identity, region) {
  return `sonara-serverless-${identity.account}-${region}`;
}

async function packageProject(app, directory) {
  const { entries, skipped } = collectFiles(directory);
  const zip = createZip(entries);
  return { zip, key: keyFor(app.name, zip), fileCount: entries.length, skipped };
}

/**
 * Work out what deploying would change.
 *
 * Always leaves the change set behind when `keep` is set, because `deploy`
 * executes the same one it showed. Showing one change set and executing a
 * second is a race with whoever else is deploying.
 */
async function computeChanges({ app, directory, creds, keep }) {
  const region = app.region;
  const call = { region, credentials: creds };

  const identity = await aws.callerIdentity(call);
  const stack = await aws.describeStack({ ...call, stackName: app.stackName });

  const packaged = await packageProject(app, directory);
  const bucket = artifactBucket(identity, region);

  // Uploaded before the change set, because CloudFormation resolves the code
  // location when the change set is created rather than when it is executed.
  await aws.createBucket({ ...call, bucket });
  if (!(await aws.objectExists({ ...call, bucket, key: packaged.key }))) {
    await aws.putObject({ ...call, bucket, key: packaged.key, body: packaged.zip });
  }

  const template = buildTemplate(app, { codeBucket: bucket, codeKey: packaged.key });
  const changeSetName = `sonara-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const created = await aws.createChangeSet({
    ...call,
    stackName: app.stackName,
    templateBody: JSON.stringify(template),
    exists: stack.exists,
    changeSetName
  });

  // CloudFormation builds a change set asynchronously. Polling rather than
  // sleeping a fixed time, and reporting "pending" rather than "empty" if it
  // never settles -- an unfinished change set has no changes in it *yet*, which
  // is not the same as having none.
  let described = { status: "pending", changes: [] };
  for (let attempt = 0; attempt < 40; attempt += 1) {
    described = await aws.describeChangeSet({ ...call, changeSetId: created.id });
    if (described.status !== "pending") break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (described.status === "pending") {
    throw new CommandError("CloudFormation did not finish working out what would change.", {
      hint: "Nothing has been deployed. Try again; if it keeps happening, look at the change set in the CloudFormation console."
    });
  }

  if (!keep && described.status === "empty") {
    // A change set with nothing in it cannot be executed and would otherwise
    // sit in the account forever.
    await aws.deleteChangeSet({ ...call, changeSetId: created.id }).catch(() => {});
  }

  return { identity, stack, packaged, bucket, changeSetId: created.id, described, template };
}

// --- plan --------------------------------------------------------------

async function commandPlan(args, options) {
  const { app, directory } = loadApp(path.resolve(options.path || "."));
  const creds = getCredentials(options);

  const spinner = ui.progress(`Working out what would change in ${app.name}`);
  let computed;
  try {
    computed = await computeChanges({ app, directory, creds, keep: false });
  } catch (error) {
    spinner.fail();
    throw error;
  }
  spinner.done();

  const plan = buildPlan({
    changes: computed.described.changes,
    status: computed.described.status,
    stackName: app.stackName,
    region: app.region,
    exists: computed.stack.exists
  });

  ui.heading(`${app.name} in ${app.region}, account ${computed.identity.account}`);
  ui.note(`  ${computed.packaged.fileCount} files packaged, ${(computed.packaged.zip.length / 1024).toFixed(0)}KB`);
  if (computed.packaged.skipped.length) {
    ui.note(`  left out: ${computed.packaged.skipped.join(", ")}`);
  }

  ui.line("");
  for (const planLine of plan.lines) ui.line(planLine);

  if (plan.known && (plan.counts.create || plan.counts.update || plan.counts.delete)) {
    ui.line("");
    ui.note("Nothing has changed. Run `sonara-serverless deploy` to apply this.");
  }
  return 0;
}

// --- deploy ------------------------------------------------------------

async function commandDeploy(args, options) {
  const { app, directory } = loadApp(path.resolve(options.path || "."));
  const creds = getCredentials(options);

  const spinner = ui.progress(`Working out what would change in ${app.name}`);
  let computed;
  try {
    computed = await computeChanges({ app, directory, creds, keep: true });
  } catch (error) {
    spinner.fail();
    throw error;
  }
  spinner.done();

  const plan = buildPlan({
    changes: computed.described.changes,
    status: computed.described.status,
    stackName: app.stackName,
    region: app.region,
    exists: computed.stack.exists
  });

  ui.heading(`${app.name} in ${app.region}, account ${computed.identity.account}`);
  ui.line("");
  for (const planLine of plan.lines) ui.line(planLine);

  if (computed.described.status === "empty") return 0;

  // The one place this tool stops and asks. A replacement of something holding
  // data is not recoverable by running the command again.
  if (plan.dangerous && !options.yes) {
    ui.line("");
    const confirmed = await ask("Something above would be replaced or deleted. Type yes to continue: ");
    if (!confirmed) {
      await aws.deleteChangeSet({ region: app.region, credentials: creds, changeSetId: computed.changeSetId }).catch(() => {});
      ui.line("");
      ui.warn("Stopped. Nothing was changed.");
      return 1;
    }
  }

  const call = { region: app.region, credentials: creds };
  const applying = ui.progress("Applying");
  const seen = new Set();
  let failed = null;

  try {
    await aws.executeChangeSet({ ...call, changeSetId: computed.changeSetId });

    // Poll until the stack settles, printing each failure once. Successes are
    // not printed: a wall of CREATE_COMPLETE buries the one line that matters.
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const current = await aws.describeStack({ ...call, stackName: app.stackName });

      const events = await aws.stackEvents({ ...call, stackName: app.stackName }).catch(() => []);
      for (const event of events.reverse()) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        if (!/FAILED/.test(event.status || "")) continue;
        applying.fail();
        ui.warn(`${event.logicalId}: ${event.reason || event.status}`);
        failed = failed || `${event.logicalId}: ${event.reason || event.status}`;
      }

      const status = current.status || "";
      if (/ROLLBACK_COMPLETE|ROLLBACK_FAILED|_FAILED$/.test(status)) {
        applying.fail();
        throw new CommandError(`The deployment failed and CloudFormation rolled it back (${status}).`, {
          detail: failed || "",
          hint: "The stack is back to how it was. Fix what is named above and deploy again."
        });
      }
      if (/COMPLETE$/.test(status)) break;
    }
    applying.done("Deployed.");
  } catch (error) {
    applying.fail();
    throw error;
  }

  const final = await aws.describeStack({ ...call, stackName: app.stackName });
  if (final.outputs.ApiUrl) {
    ui.line("");
    ui.success(`Answering at ${final.outputs.ApiUrl}`);
    const routes = app.functions.flatMap((fn) =>
      fn.events.filter((event) => event.kind === "http").map((event) => [event.method, `${final.outputs.ApiUrl}${event.path}`]));
    if (routes.length) ui.table(routes);
  }
  return 0;
}

// --- login -------------------------------------------------------------

async function commandLogin(args, options) {
  const startUrl = options["start-url"] || options.startUrl;
  const region = options.region || (fs.existsSync(path.join(process.cwd(), "serverless.yml"))
    ? loadApp(process.cwd()).app.region
    : null);

  if (!region) {
    throw new CommandError("This needs to know which region your IAM Identity Center is in.", {
      hint: "Run it with --region, for example:\n  sonara-serverless login --region eu-west-1 --account 111122223333 --role Deploy"
    });
  }
  if (!options.account || !options.role) {
    throw new CommandError("This needs to know which account and role to sign into.", {
      hint: [
        "  sonara-serverless login --region eu-west-1 --account 111122223333 --role Deploy",
        "",
        "The account number and role name are on your AWS access portal page,",
        "next to the account you want."
      ].join("\n")
    });
  }

  // The verifier and the state are made here and never leave this process: the
  // verifier is what makes a stolen authorization code worthless, and the state
  // is what stops the callback server accepting a code from a login that
  // started somewhere else.
  const pkce = login.createPkcePair();
  const state = crypto.randomBytes(16).toString("hex");

  const server = await login.startCallbackServer({ expectedState: state });

  let registered;
  try {
    registered = await login.registerClient({
      region,
      clientName: "sonara-serverless",
      redirectUri: server.redirectUri,
      ...(startUrl ? { issuerUrl: startUrl } : {})
    });
  } catch (error) {
    server.close();
    throw new CommandError(`IAM Identity Center would not register this client: ${error.message}`, {
      hint: "Check that --region is the region your Identity Center instance is in. It is often not the region you deploy to."
    });
  }

  const url = login.authorizationUrl({
    region,
    clientId: registered.clientId,
    redirectUri: server.redirectUri,
    challenge: pkce.challenge,
    state
  });

  ui.heading("Sign in");
  ui.line("  Your browser should open. If it does not, open this:");
  ui.line("");
  ui.line(`  ${url}`);
  ui.line("");
  login.openBrowser(url);

  const spinner = ui.progress("Waiting for you to finish in the browser");
  let code;
  try {
    ({ code } = await server.code);
    spinner.done();
  } catch (error) {
    spinner.fail();
    throw new CommandError(error.message, {
      hint: error.code === "timed_out" ? "Run the command again when you are ready." : ""
    });
  }

  const token = await login.createToken({
    region,
    clientId: registered.clientId,
    clientSecret: registered.clientSecret,
    code,
    verifier: pkce.verifier,
    redirectUri: server.redirectUri
  });

  const role = await login.getRoleCredentials({
    region,
    accessToken: token.accessToken,
    accountId: String(options.account),
    roleName: String(options.role)
  });

  const file = credentials.saveToCache(options.profile || "default", { ...role, region });
  ui.success(`Signed in as ${options.role} in ${options.account}.`);
  ui.note(`  Saved to ${file}${role.expiresAt ? `, good until ${role.expiresAt}` : ""}`);
  return 0;
}

// --- whoami, info, remove ----------------------------------------------

async function commandWhoami(args, options) {
  const creds = getCredentials(options);
  const region = options.region || "us-east-1";
  const identity = await aws.callerIdentity({ region, credentials: creds });
  ui.heading("Signed in");
  ui.table([
    ["account", identity.account],
    ["as", identity.arn],
    ["from", creds.source]
  ]);
  return 0;
}

async function commandInfo(args, options) {
  const { app } = loadApp(path.resolve(options.path || "."));
  const creds = getCredentials(options);
  const stack = await aws.describeStack({ region: app.region, credentials: creds, stackName: app.stackName });

  ui.heading(`${app.name} in ${app.region}`);
  if (!stack.exists) {
    ui.line("  Not deployed yet.");
    ui.note("  Run `sonara-serverless deploy` to create it.");
    return 0;
  }
  ui.table([["status", stack.status], ...Object.entries(stack.outputs)]);
  return 0;
}

async function commandRemove(args, options) {
  const { app } = loadApp(path.resolve(options.path || "."));
  getCredentials(options);

  ui.heading(`This would delete the stack ${app.stackName} in ${app.region}.`);
  ui.line("");
  ui.line("  Tables and buckets declared in this file are kept: they are created with a");
  ui.line("  retain policy, so deleting the stack leaves the data behind. Everything else");
  ui.line("  -- functions, roles, the API, schedules -- goes.");
  ui.line("");
  ui.warn("Not implemented. Delete the stack in the CloudFormation console for now.");
  ui.note("  Saying so rather than pretending: this command has never been run against a real stack,");
  ui.note("  and a half-written delete is the worst thing in this tool to be wrong about.");
  return 1;
}

// --- dispatch ----------------------------------------------------------

const COMMANDS = Object.freeze({
  init: { run: commandInit, summary: "write a new project that already works" },
  dev: { run: commandDev, summary: "run the application on this machine" },
  plan: { run: commandPlan, summary: "what deploying would change, before it changes" },
  deploy: { run: commandDeploy, summary: "apply it" },
  login: { run: commandLogin, summary: "sign in to AWS through your browser" },
  whoami: { run: commandWhoami, summary: "which account these credentials are for" },
  info: { run: commandInfo, summary: "what is deployed, and where it answers" },
  remove: { run: commandRemove, summary: "take the stack down" }
});

// --flag, --flag=value, --flag value, --no-flag.
function parseArgv(argv) {
  const args = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) { args.push(token); continue; }

    const body = token.slice(2);
    if (body.startsWith("no-")) { options[body.slice(3)] = false; continue; }

    const equals = body.indexOf("=");
    if (equals !== -1) { options[body.slice(0, equals)] = body.slice(equals + 1); continue; }

    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) { options[body] = true; continue; }
    options[body] = next;
    i += 1;
  }
  return { args, options };
}

function usage() {
  ui.heading("sonara-serverless");
  ui.line("  Define Lambda functions and the AWS resources they need in one YAML file.");
  ui.heading("Commands");
  ui.table(Object.entries(COMMANDS).map(([name, command]) => [name, command.summary]));
  ui.heading("Options");
  ui.table([
    ["--path <dir>", "where the serverless.yml is (default: here)"],
    ["--profile <name>", "which saved credentials to use (default: default)"],
    ["--region <region>", "for login and whoami, which have no file to read it from"],
    ["--port <port>", "for dev (default: 3000)"],
    ["--typescript", "for init, scaffold a TypeScript project"],
    ["--yes", "for deploy, do not stop to confirm a replacement"]
  ]);
  ui.line("");
  ui.note("  sonara-serverless init my-app --typescript");
  ui.note("  sonara-serverless dev");
  ui.note("  sonara-serverless plan");
}

async function run(argv) {
  const { args, options } = parseArgv(argv);
  const name = args.shift();

  if (!name || options.help || name === "help") {
    usage();
    return name && name !== "help" ? 1 : 0;
  }

  const command = COMMANDS[name];
  if (!command) {
    const names = Object.keys(COMMANDS);
    const close = names.find((candidate) => candidate.startsWith(name.slice(0, 3)));
    ui.failure({
      message: `There is no command called "${name}".`,
      hint: close ? `Did you mean "${close}"?\n\nRun \`sonara-serverless help\` for the list.` : "Run `sonara-serverless help` for the list."
    });
    return 1;
  }

  try {
    return await command.run(args, options);
  } catch (error) {
    if (error instanceof CommandError) {
      ui.failure({ message: error.message, where: error.where, hint: error.hint, detail: error.detail });
      return 1;
    }
    if (error instanceof aws.AwsError) {
      ui.failure({
        message: error.message,
        where: `AWS (${error.code})`,
        hint: error.code === "AccessDenied" || error.status === 403
          ? "These credentials are valid but are not allowed to do this.\nRun `sonara-serverless whoami` to see which account and role they are for."
          : ""
      });
      return 1;
    }
    // Not a failure this tool anticipated. Reported as a bug in the tool rather
    // than as something the user did wrong, with the stack, because that is
    // what is actually needed to fix it.
    ui.failure({
      message: "Something went wrong that this tool did not expect.",
      detail: String(error.stack || error.message),
      hint: "This is a bug in sonara-serverless rather than something you did."
    });
    return 1;
  }
}

module.exports = { run, parseArgv, COMMANDS, CommandError, loadApp, findManifest, artifactBucket, usage };
