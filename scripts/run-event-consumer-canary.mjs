import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { EVENT_TOPICS, createAgentEvent } = require("../lib/sonara-event-driven-agent-contract.cjs");
const { createEventOutboxRepository } = require("../lib/sonara-event-outbox.cjs");
const {
  CANARY_ACTION,
  CANARY_KIND,
  CANARY_PRODUCER_PREFIX,
  CANARY_ACTIVATION_GATE,
  createEventConsumerWorker,
  evaluateCanaryActivation
} = require("../lib/sonara-event-consumer.cjs");
const { evaluateEventConsumerCanaryGate } = require("../lib/sonara-event-consumer-gate.cjs");

const SAMPLE_COUNT = CANARY_ACTIVATION_GATE.minSamples;
const CONCURRENCY = 4;

const activation = await evaluateEventConsumerCanaryGate();
if (!activation.ok && activation.reason !== "flag_disabled") {
  console.error(`Event consumer canary capability gate refused activation: ${activation.reason}.`);
  process.exit(1);
}
if (!activation.allowed) {
  console.error("Event consumer canary is disabled. Enable only the controlled one-tenant runtime capability and explicit canary organization.");
  process.exit(2);
}

const config = supabaseConfig();
if (!config.ok) {
  console.error("Event consumer canary requires the production Supabase URL/project id and service-role key.");
  process.exit(1);
}

const repository = createEventOutboxRepository({
  getSupabaseServerConfig: () => config
});

const runToken = crypto.randomUUID();
const runProducer = `${CANARY_PRODUCER_PREFIX}:${runToken}`;
const organizationId = activation.organizationId;

const handlers = {
  [CANARY_KIND]: async (event) => {
    const isCanary = event.action === CANARY_ACTION
      && event.producer === runProducer
      && event.payload?.canary === true
      && event.payload?.runToken === runToken;
    if (!isCanary) {
      const error = new Error("consumer canary received an event outside its synthetic run");
      error.code = "canary_scope_mismatch";
      error.retryable = false;
      throw error;
    }
    return { ok: true };
  }
};

const worker = createEventConsumerWorker({ repository, handlers });

const enqueues = await Promise.all(
  Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const correlationId = `event-consumer-canary:${runToken}:${index + 1}`;
    const event = createAgentEvent({
      organizationId,
      actorId: "system:event-consumer-canary",
      producer: runProducer,
      topic: EVENT_TOPICS.RESULTS,
      kind: CANARY_KIND,
      action: CANARY_ACTION,
      correlationId,
      payload: {
        canary: true,
        runToken,
        sequence: index + 1,
        sampleCount: SAMPLE_COUNT
      },
      provenance: {
        sourceType: "controlled_production_canary",
        sourceId: correlationId,
        userProvided: false,
        licensedOrOwned: true
      }
    });
    return repository.enqueue(event);
  })
);

const enqueueFailures = enqueues.filter((result) => !result?.ok);
if (enqueueFailures.length) {
  console.error(`Event consumer canary could not enqueue ${enqueueFailures.length} of ${SAMPLE_COUNT} synthetic events.`);
  process.exit(1);
}

const results = [];
let cursor = 0;

async function lane(laneNumber) {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= SAMPLE_COUNT) return;

    const result = await worker.runOnce({
      enabled: true,
      organizationId,
      consumer: `sonara-event-consumer-canary-lane-${laneNumber}`,
      kinds: [CANARY_KIND],
      producers: [runProducer]
    });
    results.push(result);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, index) => lane(index + 1)));

const evaluation = evaluateCanaryActivation(results.map((result) => result.sample));
const statusCounts = results.reduce((acc, result) => {
  const status = String(result?.status || "unknown");
  acc[status] = (acc[status] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  gate: "event_consumer_activation_canary",
  organizationScoped: true,
  syntheticOnly: true,
  scheduled: false,
  samplesRequested: SAMPLE_COUNT,
  concurrency: CONCURRENCY,
  statusCounts,
  metrics: evaluation.metrics,
  checks: evaluation.checks,
  passed: evaluation.ok
}, null, 2));

if (!evaluation.ok) process.exit(1);

function supabaseConfig() {
  const projectId = String(process.env.SUPABASE_PROJECT_ID || "").trim();
  const url = String(
    process.env.SUPABASE_URL
      || process.env.NEXT_PUBLIC_SUPABASE_URL
      || (projectId ? `https://${projectId}.supabase.co` : "")
  ).replace(/\/+$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) return { ok: false };
  return { ok: true, url, serviceRoleKey };
}
