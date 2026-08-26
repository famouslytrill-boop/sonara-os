# sonara-serverless

Define Lambda functions and the AWS resources they need in one YAML file, see
what deploying would change before it changes, and run the whole thing on your
own machine while you work on it.

```sh
sonara-serverless init my-app --typescript
cd my-app && pnpm install
sonara-serverless dev          # it answers on localhost:3000
sonara-serverless login        # opens your browser
sonara-serverless plan         # what would change, before anything does
sonara-serverless deploy
```

Node 22 or newer. **No runtime dependencies** — not a convenience, a
constraint that shaped the whole tool. The YAML parser, the ZIP writer, the
SigV4 signer and the CloudFormation client are all here, in about two thousand
lines, because the alternative was several hundred packages to do four things.

---

## What has actually been run, and what has not

This matters more than a feature list, so it goes first.

**Exercised by the test suite** (221 tests, `make test`): the YAML parser, the
manifest validation, CloudFormation template synthesis, the plan renderer, the
ZIP writer, the SigV4 signer, the PKCE login construction, the local dev server,
the scaffold, and the command line itself. Several of those are checked against
implementations this project did not write — the signer against AWS's own
published test vectors, the ZIP against `unzip`.

**Never run against a live AWS account**: `deploy`, `info`, `remove`, and the
AWS half of `login` and `plan`. There is no AWS account attached to this
repository. The requests are built and signed correctly as far as offline
verification can establish, and the responses are parsed against captured
response shapes — but nobody has watched a stack come up. Treat the first
deploy as the first deploy.

---

## The file

Everything the application is, in one place:

```yaml
name: orders-api
region: eu-west-1
runtime: nodejs22.x        # the default for every function
memory: 512
timeout: 10

environment:
  STAGE: prod              # merged into every function

resources:
  orders:
    type: table            # DynamoDB, pay-per-request
    key: id
    sort: createdAt        # optional
  uploads:
    type: bucket           # S3: private, encrypted, public access blocked
    versioned: true
  jobs:
    type: queue            # SQS

functions:
  checkout:
    handler: handlers/checkout.handler
    memory: 1024           # overrides the default above
    uses:
      orders: readwrite    # read | write | readwrite
      uploads: read
    events:
      - http: POST /checkout
      - http: GET /checkout/{id}

  nightly:
    handler: handlers/nightly.handler
    events:
      - schedule: rate(1 day)
```

Three resource types, not thirty. Each is something the tool can create, grant
a function access to, and describe honestly in a plan. There is deliberately no
`type: anything` escape hatch: the moment one exists, `plan` can no longer say
what would change, and that is the feature people came for.

### `uses:` is how permissions happen

A function gets access to exactly what it names, at the level it names. Nothing
is inferred. A handler that only reads is granted only reads, so a bug in it
cannot become a write — and log permission is scoped to that function's own log
group rather than the account-wide `logs:*` the managed policy grants.

---

## The commands

| | |
|---|---|
| `init [dir]` | write a new project that already works |
| `dev` | run it here, on `localhost:3000` |
| `plan` | ask CloudFormation what deploying would change |
| `deploy` | plan, show it, then apply it |
| `login` | sign in to AWS through your browser |
| `whoami` | which account these credentials are for |
| `info` | what is deployed, and where it answers |
| `remove` | take the stack down, keeping what holds data |

Flags: `--path`, `--profile`, `--region`, `--port`, `--typescript`, `--yes`.

### `dev`

Serves the routes from your `serverless.yml`, invoking your handlers with an
API Gateway **payload format 2.0** event — the same shape production sends, so
a handler that reads `event.requestContext.http.method` works in both places.
Handlers reload on every request, so edits take effect without a restart.

It runs your code. It does **not** reproduce Lambda's memory limits, cold
starts, or execution environment. A local runner that quietly differs from
production is worse than no local runner, so the differences are stated rather
than glossed.

A 404 lists the routes that do exist, which is the one thing a local server can
do that a real one should not.

### `plan`

Asks CloudFormation, via a change set, what it would actually do — computed
against the deployed stack rather than against a local guess. A local guess is
wrong the moment somebody touches the console, and a plan that is occasionally
wrong is worse than none, because people stop reading it.

It distinguishes three things that other tools tend to collapse into two:

- **changes** — here is what would happen
- **no changes** — the deployed stack is already what this file describes
- **could not tell** — the lookup failed, and *nothing is known*

The third is the one that matters. "No changes" is a claim about the deployed
stack; printing it when the lookup failed sends somebody to deploy blind.

A resource that would be **replaced** rather than updated is called out
separately, because for a table that means a new empty one. `deploy` stops and
asks before doing it, and in a non-interactive shell it refuses rather than
assuming yes.

### `login`

Opens your browser, using the OAuth **authorization code flow with PKCE**.

There is no device-code fallback, on purpose. The device-code flow — where the
terminal prints a short code you type into a web page — is phishable by design:
an attacker runs the flow against their own client, gets a genuine AWS code, and
sends it to you with a plausible story. The page is real, the code is real, and
approving it authorises *them*. AWS made PKCE the default in the AWS CLI at
v2.22.0 for this reason. A fallback flag would be a switch that turns the
phishable flow back on, and the people most likely to find it are the people
being talked through a fix by a stranger.

With PKCE the authorization code arrives over loopback rather than through a
person, and redeeming it requires a verifier that never leaves the process.

```sh
sonara-serverless login --region eu-west-1 --account 111122223333 --role Deploy
```

Credentials are cached in `~/.sonara-serverless/credentials.json`, mode `0600`.
Expiry is checked before use, so an expired session says so instead of failing
as a 403 that reads like a permissions problem.

Credentials are resolved in the order every AWS tool uses: the environment,
this tool's cache, then `~/.aws/credentials`. A tool that resolved them
differently from the AWS CLI sitting next to it deploys to the wrong account
exactly once.

### `remove`

There is no change set for a delete — CloudFormation will not tell you in
advance what `DeleteStack` destroys — so `remove` works it out from the stack's
own resource list and prints it before calling anything.

The summary has three parts. **Deleted** is what goes. **Kept** is what
survives: tables and buckets are created with `DeletionPolicy: Retain`, so
taking the stack down is not the thing that loses a customer's orders. They are
listed by their real AWS names, because that is the list you need to finish the
job by hand — a retained bucket is still costing money under a name this tool
will not reuse, and a person who believes they deleted everything has left both.
**Unclassified** is any resource type this tool has no rule for, which is
reported as its own category rather than being counted as deleted: saying "I
cannot tell you whether this survives" is a worse-looking report and a truer one.

Confirmation is typing the stack name, not pressing return through a `y/n`. In a
non-interactive shell it refuses rather than assuming yes. `--yes` is honoured
only when everything in the stack is classified — and never when the resource
list could not be read at all, since an empty list read as real would otherwise
sail straight into a delete nobody had seen the contents of.

---

## Node.js and TypeScript

TypeScript handlers run **with no build step**. Node 22 strips types when it
loads a `.ts` file and Lambda's `nodejs22.x` runtime does the same, so the file
you edit is the file that runs, locally and deployed. No bundler, no watcher,
nothing to keep in sync.

`init --typescript` scaffolds an ES module project; `typescript` appears once,
as a dev dependency, purely so your editor and `pnpm typecheck` can check what
Node ignores at runtime.

---

## What the YAML parser refuses

The parser implements a documented subset and refuses everything else **by
name**, with a line number and what to write instead. Refusing costs one line
of output. Guessing costs a wrong deployment that reported success.

- `yes` / `no` / `on` / `off` — a boolean in YAML 1.1, a string in 1.2
- leading-zero numbers like `022` — octal in one version, decimal in the other
- tabs for indentation
- duplicate keys — YAML says last-wins, and a person who wrote a key twice
  meant something that last-wins is not reliably
- anchors, aliases and merge keys — structure shared invisibly is a change that
  lands in two places
- tags, including CloudFormation's `!Ref` shorthand
- more than one document in a file

Unknown *settings* are refused the same way, with a suggestion:

```
x orders-api has a setting called "memorySize", which this does not read.
  in serverless.yml

  Did you mean "memory"? If this were ignored instead of refused, you would
  have no way to find out it never took effect.
```

---

## Working on the tool

```sh
make test        # 221 tests, node --test
make lint
make check       # both
```

The tests worth reading first are `tests/sigv4.test.js`, which checks the
signer against AWS's published vectors rather than against itself, and
`tests/bundle.test.js`, which hands the ZIP to `unzip`.

Two bugs found by those tests are recorded in the source where they happened,
because both were the kind that produce a plausible wrong answer rather than an
error: the signer applied S3's single path-encoding rule to every service, and
the CloudFormation XML reader used a non-greedy regex that silently truncated
any element containing another of the same name.

MIT licensed.
