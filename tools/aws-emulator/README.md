# aws-emulator

A local AWS emulator on one port. No account, no auth token, no licence key, and
nothing behind a paid tier.

```sh
docker compose up
aws --endpoint-url http://localhost:4566 s3 mb s3://things
aws --endpoint-url http://localhost:4566 s3 cp ./file.txt s3://things/
```

Or without Docker at all — it has **no dependencies**, so there is nothing to
install:

```sh
node src/server.js
```

---

## What it emulates, and what it refuses

This is the part to read first, because it is the part that decides whether the
tool is useful or actively harmful.

**Implemented, and tested**

| | |
|---|---|
| **S3** | buckets, objects, both addressing styles, real MD5 ETags, list with prefix |
| **DynamoDB** | tables, put/get/delete/update, query on a partition key, scan, batch |
| **SQS** | queues, send/receive/delete, **a real visibility timeout**, attributes |
| **Lambda** | create, update, delete, and **actually runs Node handlers** |
| **STS** | GetCallerIdentity, AssumeRole, GetSessionToken |
| **IAM** | roles and policies, stored — see the warning below |

**Not implemented** — EC2, ECS, RDS, API Gateway, SNS, EventBridge, Secrets
Manager, SSM, Kinesis, Step Functions, CloudFormation, CloudWatch Logs.

Every one of those **refuses by name**, with a 501 and an error in that
service's own dialect. None of them returns an empty success.

That is the design decision the whole project turns on. An emulator's dangerous
failure is not crashing — it is *answering*. A service that returns `200 {}` for
something it has not implemented lets your code carry on with what looks like a
valid empty result: no items, no messages, no instances. Your test passes, you
ship, and it breaks against real AWS for a reason nothing local ever hinted at.
So there is no third state between "implemented and tested" and "refuses".

The same rule holds inside a service that *is* implemented: ask DynamoDB for
`TransactWriteItems` and it names the operation and refuses, rather than
returning something that reads as success.

`GET /_emulator/health` lists both sets, read from the code rather than from a
list written by hand, so this README cannot drift from what actually runs.

---

## Two things it does not do, stated plainly

**It does not authenticate anything.** Signatures are parsed — that is how it
works out which service a request is for — and never verified. Locally there is
nothing to protect, and signature checking would only add failures unrelated to
the code under test: a clock an hour out, a proxy that reordered a header, an
SDK that signs a payload differently, each arriving as a 403 that looks like a
bug in your application.

**Do not put this port on a network you do not control.**

**It does not evaluate IAM policies.** Roles and policies are stored and
returned; nothing is ever denied because of one. So **a test that passes here
can still be denied by AWS**, and nothing local will have hinted at it.

A partial policy evaluator would be worse: it would get some denials right and
some wrong, and the wrong ones are indistinguishable from the right ones without
reading its source. `SimulatePrincipalPolicy` therefore refuses rather than
answering "allowed".

---

## Lambda actually runs your code

A function's zip is unpacked and its handler is invoked in a separate Node
process, with a real event on stdin and its return value on stdout.

```sh
aws --endpoint-url http://localhost:4566 lambda invoke \
    --function-name doubler --payload '{"n":21}' out.json
cat out.json   # {"doubled":42}
```

A separate process rather than an in-process `require`, so a handler that calls
`process.exit` cannot take the emulator with it, one that leaks globals cannot
affect the next invocation, and one that never returns can be killed.

The limits, since they are the useful part:

- **Node runtimes only.** Python, Go and the rest are refused at *create* time,
  not at invoke time, so the reason is clear.
- **The timeout is enforced. The memory limit is not.** `MemorySize` is recorded
  and ignored — which means a function that works here can still be killed by
  AWS for memory.
- No cold starts, no concurrency limits, no VPC, no layers. Nothing models them.
- Handler output goes to this container's stdout, where `docker logs` will show
  it. CloudWatch Logs is not emulated, and inventing a log group would be a lie
  about where to find them.

---

## Pointing things at it

Anything that honours `AWS_ENDPOINT_URL` — the AWS CLI v2, the v3 SDKs — needs
only that:

```sh
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=eu-west-1
```

**S3 needs path-style addressing.** AWS puts the bucket in the hostname
(`bucket.s3.region.amazonaws.com`); a local endpoint is one host with no
wildcard DNS in front of it, so the bucket has to move into the path. Every SDK
has a switch for this — `forcePathStyle: true` in JS v3, `--s3-path-style` or
`s3.addressing_style = path` for the CLI. Without it the bucket name is simply
lost.

Both styles are accepted, so a tool that gets the Host header through unchanged
works either way.

### Its own endpoints

- `GET /_emulator/health` — what is implemented, what is not, whether state is
  persisted
- `POST /_emulator/reset` — empty the account, so a test suite need not restart
  the container between cases

### State

In memory by default and cleared when it stops, because a suite wants a clean
account every run. Set `AWS_EMULATOR_STATE_DIR` to keep it, and it says which it
is doing at startup.

Regions are kept apart, as AWS keeps them: a bucket made in `eu-west-1` is not
visible from `us-east-1`. It costs one map key to be right, and getting it wrong
lets a test pass locally and fail in production for a reason the test could
never show.

---

## What has been verified, and what has not

**Verified**: 43 tests, every one driving the server over a real socket rather
than calling handlers directly — because the half most likely to be wrong is
routing, body handling, and whether the answer parses as the dialect the caller
expects.

The strongest of them is `tests/the-cli-can-drive-it.test.js`. The serverless
CLI in `../serverless-cli/` signs real AWS requests and, until this existed, had
never spoken to a server. Its SigV4 signer was checked against AWS's own
published vectors — which proves the arithmetic and proves nothing about whether
the requests it assembles are ones a service would accept. Two projects written
independently, one signing and one parsing, agreeing over a socket is a stronger
statement than either making sense alone.

It found a real problem on the first run: `createBucket` addressed the bucket
the way AWS does, the bucket name was lost against a single host, and the
emulator answered "S3 does not answer PUT at the root". That is the problem
every emulator user hits, and it is why `AWS_ENDPOINT_URL` now switches the CLI
to path style.

**Not verified**: the Docker image. There is no Docker daemon in the environment
this was written in, so `docker compose up` has never been run. The `Dockerfile`
and `docker-compose.yml` are written and unexercised. Everything they start —
the server, every service, every test — runs under plain Node and is verified
that way.

---

## Working on it

```sh
make test    # 43 tests
make run     # localhost:4566, no Docker
make check   # lint and test
```

MIT licensed.
