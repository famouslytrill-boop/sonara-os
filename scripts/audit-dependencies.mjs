// Run `pnpm audit`, and fail differently depending on which thing went wrong.
//
// `pnpm audit` exits non-zero for two entirely different reasons: it found a
// moderate-or-worse advisory, or it could not reach npm's advisory endpoint to
// ask. Three workflows invoked it and none could tell those apart, so on
// 3 September 2026 a network timeout was reported as a security finding —
// across `frontend-dependencies`, `sonara-industries`, and
// `controlled-production-deploy`.
//
// That last one is why this is a script rather than three copies of a shell
// snippet. A false security finding in the deployment workflow blocks a
// production release, and fixing one of three call sites is the shape this
// repository got wrong the same day elsewhere: a repair that created the tables
// that were absent and ignored the ones that were present.
//
// ## What it does not change
//
// The audit level is `moderate`, as it was. **An audit that could not run still
// fails.** An audit that did not happen must never be a green tick — the point
// of separating the two is the message, never the outcome. See
// `SECURITY_NOTES.md`.
//
// ## What it adds: a bound, and a distinct message
//
// `pnpm audit` does **not** fail fast when that endpoint is misbehaving — it
// hangs. Each CI attempt on 3 September sat for **four minutes** before giving
// up. So this bounds it with `timeout(1)` and fails in ninety seconds instead,
// which is an improvement on the behaviour it replaces rather than a cost.
//
// **The bound is not only for an endpoint that never answers.** Later the same
// evening the endpoint began returning `503` in about a second — up, and
// refusing — and `pnpm audit` still ran past ninety seconds, because it retries
// internally. So "the endpoint is answering again" is not a reason to remove
// this; the hang comes from pnpm's own retry loop, and the only thing that
// reliably ends it is a bound out here.
//
// **There is deliberately no retry.** The first version retried three times,
// and running it against the live outage showed that turns a four-minute
// failure into a twelve-minute one and risks pushing a job into its own
// timeout — the fix making CI worse than the bug. A second version bounded each
// attempt and *still* hung, because `spawnSync`'s own `timeout` kills `pnpm`
// while a grandchild keeps the stdout pipe open. Both were found by running
// this, not by reasoning about it. Telling the two failures apart is the
// valuable half; the retry was never the point, and a transport failure a human
// can re-run once is a smaller problem than a retry loop that hangs.
//
// `timeout -k` rather than a Node-side timer, because it signals the whole
// process group — which is exactly what the grandchild problem needs.
//
// Whether the result is *clean* is still `pnpm audit`'s judgement and its exit
// code still decides. This only answers "was anything audited at all", via
// `scripts/audit-result-is-unusable.mjs`.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { couldNotAsk } from "./audit-result-is-unusable.mjs";

// The working directory, not the repository root: each job audits its own
// package, and `dependency-scan.yml` sets `working-directory` per job.
const OUTPUT = path.join(process.cwd(), "pnpm-audit.json");
const LEVEL = "moderate";

// Seconds. Far above a healthy audit, which answers in seconds, and far below
// the four-minute hang. A merely slow endpoint therefore reports "could not
// ask" rather than a finding — which fails loudly and never passes, so the
// error is in the safe direction.
const TIMEOUT_SECONDS = 90;

// --json so the outcome is machine-readable. Without it a transport error and a
// real finding are both just a non-zero exit and some prose, which is the whole
// defect.
const run = spawnSync(
  "bash",
  ["-c", `timeout -k 5 ${TIMEOUT_SECONDS} pnpm audit --audit-level ${LEVEL} --json > ${JSON.stringify(OUTPUT)}`],
  { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "inherit", "inherit"] }
);

// 124 is `timeout`'s own "it did not finish"; 137 is the SIGKILL after -k.
// Anything the audit did manage to write is still on disk, and couldNotAsk()
// decides whether it amounts to a result.
if (run.status === 124 || run.status === 137) {
  process.stdout.write(`::notice::pnpm audit did not answer within ${TIMEOUT_SECONDS}s and was stopped.\n`);
}

if (fs.existsSync(OUTPUT)) process.stdout.write(`${fs.readFileSync(OUTPUT, "utf8")}\n`);

if (couldNotAsk(OUTPUT)) {
  process.stdout.write(
    "::error::pnpm audit did not obtain a result from npm's advisory service, so NOTHING WAS AUDITED. " +
    "This is not a vulnerability report, and it is not a pass. Re-run the job once that service is healthy -- " +
    "note that it answering at all is not the same as it working, since pnpm retries a 5xx internally until this " +
    "bound stops it.\n"
  );
  process.exit(1);
}

process.exit(run.status === null ? 1 : run.status);
