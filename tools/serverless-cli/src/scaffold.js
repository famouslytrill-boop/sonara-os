"use strict";

// A new project, ready to run.
//
// `init` writes a working application rather than a skeleton with TODOs in it.
// `sonara-serverless init && sonara-serverless dev && curl localhost:3000/hello`
// answers on the first try, and every file it writes is one somebody would
// have written anyway.
//
// ## TypeScript with no build step
//
// The TypeScript project has no bundler, no `tsc` in the run path and no watch
// process. Node 22 strips types when it loads a `.ts` file, and Lambda's
// nodejs22.x runtime does the same -- so the `.ts` file is deployed as-is and
// runs as-is. `typescript` appears once, as a dev dependency, purely so the
// editor and `pnpm typecheck` can check types that Node ignores.
//
// That is worth being explicit about, because it is the opposite of what every
// other tool in this space does, and somebody reading the generated project
// will look for the build step and not find one.

const fs = require("node:fs");
const path = require("node:path");

const SERVERLESS_YML = (name, region, typescript) => `# Everything this application is, in one file.
#
# Run it locally:      sonara-serverless dev
# See what would change: sonara-serverless plan
# Send it:             sonara-serverless deploy

name: ${name}
region: ${region}
runtime: nodejs22.x
memory: 512
timeout: 10

environment:
  STAGE: dev

resources:
  notes:
    type: table
    key: id

functions:
  hello:
    handler: handlers/hello.handler
    description: Says hello, and reads nothing
    events:
      - http: GET /hello

  addNote:
    handler: handlers/notes.add
    uses:
      notes: readwrite
    events:
      - http: POST /notes

  listNotes:
    handler: handlers/notes.list
    uses:
      notes: read
    events:
      - http: GET /notes
`;

const HELLO_JS = `// The smallest handler that is one.
//
// The event is API Gateway's payload format 2.0, which is what an HTTP API
// sends. \`sonara-serverless dev\` builds the same shape locally, so what you
// see here is what arrives in production.

exports.handler = async (event) => {
  const name = event.queryStringParameters?.name || "world";
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hello: name,
      stage: process.env.STAGE,
      path: event.requestContext.http.path
    })
  };
};
`;

const HELLO_TS = `// The smallest handler that is one.
//
// This is TypeScript and there is no build step: Node 22 strips the types when
// it loads the file, and Lambda's nodejs22.x runtime does the same. The file
// you edit is the file that runs, locally and deployed.

type ApiEvent = {
  queryStringParameters?: Record<string, string>;
  requestContext: { http: { path: string; method: string } };
};

type ApiReply = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

export const handler = async (event: ApiEvent): Promise<ApiReply> => {
  const name = event.queryStringParameters?.name ?? "world";
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hello: name,
      stage: process.env.STAGE,
      path: event.requestContext.http.path
    })
  };
};
`;

// The notes handlers are the interesting half: they show a function reaching a
// resource declared in the same file, with the table name arriving through the
// environment rather than being hard-coded.
const NOTES_JS = `// Two handlers over the table declared in serverless.yml.
//
// Nothing here names the deployed table: \`uses:\` in the YAML grants the
// permission, and the name arrives in the environment. That is what keeps a
// handler working in more than one account.

const NOT_CONFIGURED = {
  statusCode: 503,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    message: "NOTES_TABLE is not set, so this handler has nowhere to read or write.",
    fix: "Add it under environment: in serverless.yml, or run sonara-serverless dev, which sets it for you."
  })
};

exports.add = async (event) => {
  if (!process.env.NOTES_TABLE) return NOT_CONFIGURED;

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: "That body is not JSON." }) };
  }
  const text = String(body.text || "").trim();
  if (!text) return { statusCode: 400, body: JSON.stringify({ message: "A note needs some text." }) };

  const note = { id: \`note-\${Date.now()}\`, text, createdAt: new Date().toISOString() };
  // Writing to DynamoDB needs a client. @aws-sdk/client-dynamodb is present in
  // the Lambda runtime, so requiring it lazily keeps this file loadable
  // locally whether or not it is installed.
  const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
  const client = new DynamoDBClient({});
  await client.send(new PutItemCommand({
    TableName: process.env.NOTES_TABLE,
    Item: {
      id: { S: note.id },
      text: { S: note.text },
      createdAt: { S: note.createdAt }
    }
  }));

  return { statusCode: 201, body: JSON.stringify(note) };
};

exports.list = async () => {
  if (!process.env.NOTES_TABLE) return NOT_CONFIGURED;

  const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
  const client = new DynamoDBClient({});
  const answer = await client.send(new ScanCommand({ TableName: process.env.NOTES_TABLE, Limit: 50 }));

  // \`answer.Items\` is undefined when the scan returned nothing and also when
  // something went wrong upstream. Defaulting to [] here is safe only because
  // send() throws on failure -- so reaching this line means the scan worked.
  const notes = (answer.Items || []).map((item) => ({
    id: item.id?.S,
    text: item.text?.S,
    createdAt: item.createdAt?.S
  }));

  return { statusCode: 200, body: JSON.stringify({ notes, count: notes.length }) };
};
`;

// The ESM twin of the handlers above, for the TypeScript project.
//
// A TypeScript project here is an ES module project -- `"type": "module"` in
// its package.json -- so its handlers use `export` rather than `exports.`. The
// first version of this scaffold wrote ESM handlers into a CommonJS project,
// which Node refused to load with "Unexpected token 'export'". Keeping the two
// project shapes internally consistent is cheaper than making one file work
// under both.

const NOTES_TS = `// Two handlers over the table declared in serverless.yml.
//
// Nothing here names the deployed table: \`uses:\` in the YAML grants the
// permission, and the name arrives in the environment. That is what keeps a
// handler working in more than one account.

type Reply = { statusCode: number; headers?: Record<string, string>; body: string };

const NOT_CONFIGURED: Reply = {
  statusCode: 503,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    message: "NOTES_TABLE is not set, so this handler has nowhere to read or write.",
    fix: "Add it under environment: in serverless.yml, or run sonara-serverless dev, which sets it for you."
  })
};

export const add = async (event: { body?: string }): Promise<Reply> => {
  const table = process.env.NOTES_TABLE;
  if (!table) return NOT_CONFIGURED;

  let parsed: { text?: string };
  try {
    parsed = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: "That body is not JSON." }) };
  }
  const text = String(parsed.text || "").trim();
  if (!text) return { statusCode: 400, body: JSON.stringify({ message: "A note needs some text." }) };

  const note = { id: \`note-\${Date.now()}\`, text, createdAt: new Date().toISOString() };
  const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  await new DynamoDBClient({}).send(new PutItemCommand({
    TableName: table,
    Item: { id: { S: note.id }, text: { S: note.text }, createdAt: { S: note.createdAt } }
  }));

  return { statusCode: 201, body: JSON.stringify(note) };
};

export const list = async (): Promise<Reply> => {
  const table = process.env.NOTES_TABLE;
  if (!table) return NOT_CONFIGURED;

  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const answer = await new DynamoDBClient({}).send(new ScanCommand({ TableName: table, Limit: 50 }));

  // \`answer.Items\` is undefined both when the scan found nothing and when
  // something went wrong. Defaulting to [] is safe only because send() throws
  // on failure, so reaching this line means the scan worked.
  const notes = (answer.Items || []).map((item) => ({
    id: item.id?.S, text: item.text?.S, createdAt: item.createdAt?.S
  }));

  return { statusCode: 200, body: JSON.stringify({ notes, count: notes.length }) };
};
`;

const GITIGNORE = `node_modules/
.sonara-serverless/
*.zip
.env
.env.*
`;

const README = (name, typescript) => `# ${name}

A serverless application defined in one file: \`serverless.yml\`.

## Getting started

\`\`\`sh
pnpm install
sonara-serverless dev
\`\`\`

Then, in another terminal:

\`\`\`sh
curl localhost:3000/hello
curl localhost:3000/hello?name=you
\`\`\`

## Deploying

\`\`\`sh
sonara-serverless login     # opens your browser
sonara-serverless plan      # what would change, before anything does
sonara-serverless deploy
\`\`\`

\`plan\` is worth running every time. It asks CloudFormation what it would
actually do, rather than guessing, and it says plainly when something would be
replaced rather than updated.

${typescript ? `## TypeScript

There is no build step. Node strips the types when it loads the file, and
Lambda's \`nodejs22.x\` runtime does the same, so the file you edit is the file
that runs. \`typescript\` is a dev dependency only, so your editor and
\`pnpm typecheck\` can check what Node ignores.

\`\`\`sh
pnpm typecheck
\`\`\`
` : ""}
## The layout

\`\`\`
serverless.yml      what exists: functions, routes, resources, permissions
handlers/           the code
\`\`\`
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    // Nothing is emitted: Node strips the types itself. tsc is here to check
    // them, not to build anything.
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true
  },
  "include": ["handlers/**/*.ts"]
}
`;

function packageJson(name, typescript) {
  return `${JSON.stringify({
    name,
    version: "0.1.0",
    private: true,
    // A TypeScript project is an ES module project. Mixing an ESM handler into
    // a CommonJS package is how the first version of this scaffold produced a
    // project that would not load at all.
    type: typescript ? "module" : "commonjs",
    scripts: {
      dev: "sonara-serverless dev",
      plan: "sonara-serverless plan",
      deploy: "sonara-serverless deploy",
      ...(typescript ? { typecheck: "tsc --noEmit" } : {})
    },
    dependencies: { "@aws-sdk/client-dynamodb": "^3.700.0" },
    ...(typescript ? { devDependencies: { typescript: "^5.7.0", "@types/node": "^22.10.0" } } : {})
  }, null, 2)}\n`;
}

/**
 * Write a new project.
 *
 * Refuses rather than overwriting. A file called serverless.yml in the
 * directory somebody ran this in is far more likely to be their application
 * than a leftover, and `init` is the command people run by accident.
 */
function scaffold({ directory, name, region = "eu-west-1", typescript = false }) {
  const files = {
    "serverless.yml": SERVERLESS_YML(name, region, typescript),
    "package.json": packageJson(name, typescript),
    ".gitignore": GITIGNORE,
    "README.md": README(name, typescript),
    [typescript ? "handlers/hello.ts" : "handlers/hello.js"]: typescript ? HELLO_TS : HELLO_JS,
    [typescript ? "handlers/notes.ts" : "handlers/notes.js"]: typescript ? NOTES_TS : NOTES_JS,
    ...(typescript ? { "tsconfig.json": TSCONFIG } : {})
  };

  const existing = Object.keys(files).filter((file) => fs.existsSync(path.join(directory, file)));
  if (existing.length) {
    throw Object.assign(
      new Error(`This directory already has ${existing.join(", ")}.`),
      { code: "would_overwrite", hint: "Run this in an empty directory, or move what is there first. Nothing has been written." }
    );
  }

  for (const [file, contents] of Object.entries(files)) {
    const full = path.join(directory, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }

  return Object.keys(files).sort();
}

module.exports = { scaffold, SERVERLESS_YML, HELLO_JS, HELLO_TS, NOTES_JS, NOTES_TS, packageJson };
