"use strict";

// `vercel.json` carried a cron that would have failed the next production
// deployment:
//
//     "crons": [{ "path": "/api/agents/schedule/tick", "schedule": "0 * * * *" }]
//
// The Vercel account this project deploys to is on the **Hobby** plan --
// checked against the account, not assumed -- and Vercel's own documentation
// says, verbatim:
//
//   "Daily execution limit: Cron jobs can only run once per day. Expressions
//    like `0 * * * *` (per-hour) or `*/30 * * * *` (every 30 minutes) will fail
//    deployment with the error: Hobby accounts are limited to daily cron jobs."
//   -- https://vercel.com/docs/cron-jobs/usage-and-pricing
//
// It had not bitten because production is still serving a commit from before
// the cron was added, so the configuration had never been deployed. That is a
// latent deployment blocker rather than a current outage, and it is worth being
// exact about which of the two it is.
//
// The scheduler now runs from `.github/workflows/agent-schedule-tick.yml`. This
// file is what stops a sub-daily cron reappearing in `vercel.json` and blocking
// a deploy that nobody would connect to a change made weeks earlier.
//
// If the account moves to Pro, the minimum interval becomes once per minute and
// this constraint is simply wrong. So the plan is written down as a constant
// with its source, and changing the plan means changing it here -- rather than
// this check quietly outliving the fact it was built on.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Checked on 2 September 2026 against the Vercel account that owns the
// `sonara-os` project (team `famouslytrill-1509's projects`), which reported
// `"plan": "hobby"`.
const DEPLOYMENT_PLAN = "hobby";
const MINIMUM_INTERVAL_MINUTES = { hobby: 24 * 60, pro: 1, enterprise: 1 };

const REPO = path.join(__dirname, "..");
const vercelConfig = JSON.parse(fs.readFileSync(path.join(REPO, "vercel.json"), "utf8"));

// How often a 5-field cron expression can fire, in minutes, for the shapes that
// matter here. Returns null when the shape is not one this understands, and the
// caller fails on null rather than treating "not understood" as "fine" -- an
// expression this cannot read is exactly when a wrong answer is most likely.
function fastestIntervalMinutes(expression) {
  const fields = String(expression).trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour] = fields;

  const everyN = (field) => {
    const match = /^\*\/(\d+)$/.exec(field);
    return match ? Number(match[1]) : null;
  };
  const countValues = (field, max) => {
    if (field === "*") return max;
    const step = everyN(field);
    if (step) return Math.ceil(max / step);
    if (/^\d+$/.test(field)) return 1;
    if (/^[\d,]+$/.test(field)) return field.split(",").length;
    if (/^\d+-\d+$/.test(field)) {
      const [from, to] = field.split("-").map(Number);
      return Math.max(1, to - from + 1);
    }
    return null;
  };

  const minutesPerHour = countValues(minute, 60);
  const hoursPerDay = countValues(hour, 24);
  if (minutesPerHour === null || hoursPerDay === null) return null;

  const firingsPerDay = minutesPerHour * hoursPerDay;
  return firingsPerDay > 0 ? (24 * 60) / firingsPerDay : null;
}

describe("the deployment config can actually deploy", () => {
  it("knows which plan it is reasoning about", () => {
    assert.ok(
      Object.hasOwn(MINIMUM_INTERVAL_MINUTES, DEPLOYMENT_PLAN),
      `DEPLOYMENT_PLAN is "${DEPLOYMENT_PLAN}", which is not a plan with a recorded minimum interval`
    );
  });

  it("declares no cron Vercel would refuse on this plan", () => {
    const floor = MINIMUM_INTERVAL_MINUTES[DEPLOYMENT_PLAN];
    const crons = Array.isArray(vercelConfig.crons) ? vercelConfig.crons : [];
    for (const cron of crons) {
      const interval = fastestIntervalMinutes(cron.schedule);
      assert.ok(
        interval !== null,
        `the cron on ${cron.path} has a schedule this check cannot read ("${cron.schedule}"), so it cannot say whether the deployment would be refused`
      );
      assert.ok(
        interval >= floor,
        `the cron on ${cron.path} runs every ${interval} minutes. On the ${DEPLOYMENT_PLAN} plan Vercel refuses anything under ${floor} ` +
          `("Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day."), so this would fail ` +
          `the next production deployment. The agent scheduler runs from .github/workflows/agent-schedule-tick.yml instead.`
      );
    }
  });

  it("still schedules the agent tick somewhere, rather than nowhere", () => {
    // The two-sided half. Taking the cron out of vercel.json and stopping there
    // would also make the check above pass, and would silently delete the
    // feature -- so the replacement has to exist and has to name the endpoint.
    const workflow = path.join(REPO, ".github", "workflows", "agent-schedule-tick.yml");
    assert.ok(fs.existsSync(workflow), "the agent schedule tick workflow is gone, so nothing runs customer schedules");
    const text = fs.readFileSync(workflow, "utf8");
    assert.match(text, /\/api\/agents\/schedule\/tick/, "the workflow no longer calls the tick endpoint");
    assert.match(text, /^\s*- cron: ".*"/m, "the workflow no longer runs on a schedule");
    assert.match(
      text,
      /x-sonara-schedule-secret/,
      "the workflow no longer presents the shared secret, so every tick would be refused with a 401"
    );
  });

  it("ticks often enough for an hour-of-day schedule to mean anything", () => {
    const text = fs.readFileSync(path.join(REPO, ".github", "workflows", "agent-schedule-tick.yml"), "utf8");
    const match = /^\s*- cron: "([^"]+)"/m.exec(text);
    assert.ok(match, "no cron expression found in the tick workflow");
    const interval = fastestIntervalMinutes(match[1]);
    assert.ok(interval !== null, `the workflow's schedule "${match[1]}" could not be read`);
    assert.ok(
      interval <= 60,
      `the tick runs every ${interval} minutes. A schedule set for 09:00 is only due once the customer's local hour reaches 09:00, ` +
        `so a tick less often than hourly would find it "not yet" and never look again that day.`
    );
  });

  it("reads the cron shapes it claims to read", () => {
    // The helper decides both assertions above, so it gets its own cases. An
    // interval reader that quietly returns the wrong number would make both of
    // them agree about something untrue.
    assert.equal(fastestIntervalMinutes("0 * * * *"), 60);
    assert.equal(fastestIntervalMinutes("*/30 * * * *"), 30);
    assert.equal(fastestIntervalMinutes("7 * * * *"), 60);
    assert.equal(fastestIntervalMinutes("0 0 * * *"), 24 * 60);
    assert.equal(fastestIntervalMinutes("0 9 * * *"), 24 * 60);
    assert.equal(fastestIntervalMinutes("0 0,12 * * *"), 12 * 60);
    assert.equal(fastestIntervalMinutes("* * * * *"), 1);
    assert.equal(fastestIntervalMinutes("0 */6 * * *"), 6 * 60);
    assert.equal(fastestIntervalMinutes("nonsense"), null, "an unreadable expression must report that, not a number");
    assert.equal(fastestIntervalMinutes("0 * * *"), null, "a four-field expression is not a cron this reads");
  });
});
