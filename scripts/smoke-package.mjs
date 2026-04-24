import fs from "node:fs";
import path from "node:path";
import { packageName, repoRoot, toFileUrl } from "./workspace.mjs";

const packageArg = process.argv[2];
if (!packageArg) {
  throw new Error("Usage: node scripts/smoke-package.mjs <package-dir>");
}

const packageDir = path.resolve(process.cwd(), packageArg);
const name = packageName(packageDir);
const entry = path.join(packageDir, "dist/index.mjs");

if (!fs.existsSync(entry)) {
  throw new Error(`Missing build output for ${name}. Run npm run build first.`);
}

const mod = await import(toFileUrl(entry));
await runSmoke(name, mod);
console.log(`Smoke package gate passed: ${name}`);

async function runSmoke(name, mod) {
  switch (name) {
    case "@signal-os/core":
      smokeCore(mod);
      return;
    case "@signal-os/runtime":
      smokeRuntime(mod);
      return;
    case "@signal-os/provider-gateway":
      await smokeProviderGateway(mod);
      return;
    case "@signal-os/export":
      smokeExport(mod);
      return;
    case "@signal-os/routes":
      smokeRoutes(mod);
      return;
    case "@signal-os/web":
      smokeWeb(mod);
      return;
    default:
      throw new Error(
        `No smoke test registered for ${name} at ${path.relative(repoRoot, packageDir)}`
      );
  }
}

function smokeCore(mod) {
  assertArrayEqual(
    mod.ExportTiers,
    ["prompt_bundle", "production_bundle", "daw_bundle", "release_bundle", "elite_mutation_bundle"],
    "ExportTiers"
  );
  if (!mod.DawNames.includes("ableton-live")) {
    throw new Error("DawNames missing ableton-live.");
  }
  const sessionStore = mod.createSessionStore();
  sessionStore.startSession({
    sessionId: "s1",
    userId: "u1",
    exportTier: "daw_bundle",
    dawName: "reaper"
  });
  if (sessionStore.getState().dawName !== "reaper") {
    throw new Error("Session store did not persist dawName.");
  }
  if (sessionStore.getState().exportTier !== "daw_bundle") {
    throw new Error("Session store did not persist exportTier.");
  }
  const machine = mod.createWorkflowStateMachine();
  machine.send(mod.WorkflowEvents.START_SESSION);
  machine.send(mod.WorkflowEvents.COMPLETE_ANALYSIS);
  if (machine.getState() !== "analysis-ready") {
    throw new Error("Workflow state machine did not advance.");
  }
}

function smokeRuntime(mod) {
  const bus = mod.createEventBus();
  const seen = [];
  bus.onAny((event) => seen.push(event.eventName));
  const adapter = mod.createRuntimeAdapter({ adapterName: "smoke", eventBus: bus });
  adapter.start();
  adapter.reportHealth();
  adapter.stop();
  assertArrayEqual(
    seen,
    [
      "runtime.adapter.created",
      "runtime.adapter.started",
      "runtime.adapter.health",
      "runtime.adapter.stopped"
    ],
    "runtime events"
  );
}

async function smokeProviderGateway(mod) {
  const provider = {
    name: "smoke-provider",
    async complete(request) {
      return { prompt: request.prompt, musicStyle: request.musicStyle };
    }
  };
  const gateway = mod.createProviderGateway({ provider });
  const accepted = await gateway.complete({ prompt: "Make a calm loop", musicStyle: "ambient" });
  if (!accepted.ok || accepted.blocked) {
    throw new Error("Provider Gateway blocked a safe request.");
  }
  const blocked = await gateway.complete({
    prompt: "Make it exactly like a named artist",
    musicStyle: "ambient"
  });
  if (!blocked.blocked) {
    throw new Error("Provider Gateway allowed an imitation request.");
  }
}

function smokeExport(mod) {
  const bundle = mod.createExportBundle({
    bundleId: "bundle-1",
    files: [{ path: "mix.wav", kind: "audio", contentType: "audio/wav", content: "" }],
    provenance: {
      session: { sessionId: "s1" },
      analysis: { bpm: 120 },
      compose: { musicStyle: "ambient" },
      decisionResult: { status: "accepted" }
    }
  });
  const paths = bundle.files.map((file) => file.path);
  for (const expected of [
    "provenance/session.json",
    "provenance/analysis.json",
    "provenance/compose.json",
    "provenance/decision-result.json",
    "provenance/manifest.json"
  ]) {
    if (!paths.includes(expected)) {
      throw new Error(`Export bundle missing ${expected}`);
    }
  }
}

function smokeRoutes(mod) {
  const billing = mod.createBillingRouteHelpers();
  const admin = mod.createAdminRouteHelpers();
  if (billing.checkout("release_bundle") !== "/billing/checkout/release_bundle") {
    throw new Error("Billing checkout route helper failed.");
  }
  if (admin.user("user 1") !== "/admin/users/user%201") {
    throw new Error("Admin user route helper failed.");
  }
}

function smokeWeb(mod) {
  const context = mod.createSessionContext();
  context.setState(mod.completeUploadSimulation("smoke.wav"));
  if (context.getState().currentStep !== "analyze") {
    throw new Error("Web SessionContext did not advance to analyze after upload simulation.");
  }
  if (context.getState().uploadedFileName !== "smoke.wav") {
    throw new Error("Web SessionContext did not persist uploadedFileName.");
  }
  const progress = mod
    .createUploadSimulationSnapshots("smoke.wav")
    .map((snapshot) => snapshot.progress);
  assertArrayEqual(progress, [0, 23, 67, 100], "upload simulation progress");
  if (!mod.mutationVariants.some((variant) => variant.name === "Short-Form Hook Variant")) {
    throw new Error("Web mutation variants missing Short-Form Hook Variant.");
  }
  if (mod.normalizeRoute("/mutation") !== "/mutation") {
    throw new Error("Web route normalization did not preserve /mutation.");
  }
}

function assertArrayEqual(actual, expected, label) {
  if (JSON.stringify(Array.from(actual)) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch.`);
  }
}
