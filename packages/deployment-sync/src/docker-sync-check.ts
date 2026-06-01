import type { DeploymentSyncContext, DockerSyncStatus } from "./types.ts";
import { isEnvConfigured } from "./env-validator.ts";
import { makeFinding, summarizeStatus } from "./sync-utils.ts";

export function checkDockerSync(context: DeploymentSyncContext = {}): DockerSyncStatus {
  const env = context.env ?? {};
  const files = context.repoFiles ?? new Set<string>();
  const findings = [
    makeFinding(
      "docker",
      files.has("Dockerfile") ? "configured" : "skipped_for_mvp",
      "low",
      "docker.dockerfile",
      "Dockerfile is optional for MVP when Vercel static deployment is sufficient."
    ),
    makeFinding(
      "docker",
      files.has("docker-compose.yml") ? "configured" : "skipped_for_mvp",
      "low",
      "docker.compose",
      "docker-compose.yml is optional for MVP local stack support."
    ),
    makeFinding(
      "docker",
      isEnvConfigured(env, "DOCKER_IMAGE_NAME") ? "configured" : "skipped_for_mvp",
      "low",
      "docker.image_name",
      "DOCKER_IMAGE_NAME is optional unless container deployment is selected."
    ),
    makeFinding(
      "docker",
      "needs_review",
      "medium",
      "docker.secret_baking",
      "Container builds must not bake secrets, database URLs, Stripe keys, or service-role keys into images."
    )
  ];
  return Object.freeze({
    provider: "docker",
    ...summarizeStatus(findings),
    findings: Object.freeze(findings),
    metadata: Object.freeze({ requiredForMvp: false })
  });
}
