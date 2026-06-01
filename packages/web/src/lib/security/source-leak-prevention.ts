export type SourceLeakSeverity = "info" | "low" | "medium" | "high" | "critical";
export type SourceLeakFindingType =
  | "env_file"
  | "source_map"
  | "api_key_pattern"
  | "service_role_pattern"
  | "build_output";

export type ArtifactScanTarget = Readonly<{
  filePath: string;
  content?: string;
  isBuildOutput?: boolean;
}>;

export type SourceLeakFinding = Readonly<{
  type: SourceLeakFindingType;
  severity: SourceLeakSeverity;
  filePath: string;
  message: string;
  blocksRelease: boolean;
}>;

export type SourceLeakRiskReport = Readonly<{
  ok: boolean;
  findingCount: number;
  criticalCount: number;
  blocksRelease: boolean;
  findings: readonly SourceLeakFinding[];
}>;

export const sourceLeakCheckDefinitions = Object.freeze([
  Object.freeze({
    title: "Environment files",
    description: "Real .env files must not be committed or included in public output.",
    severity: "critical" as const
  }),
  Object.freeze({
    title: "Source maps",
    description: "Build output source maps are reviewed before public release.",
    severity: "high" as const
  }),
  Object.freeze({
    title: "API key patterns",
    description: "Provider keys and webhook secrets are redacted from artifacts.",
    severity: "critical" as const
  }),
  Object.freeze({
    title: "Service-role key patterns",
    description: "Supabase service-role keys remain server-only and never client-side.",
    severity: "critical" as const
  }),
  Object.freeze({
    title: "Build output folders",
    description: "Build folders are scanned for maps and secret-like patterns.",
    severity: "high" as const
  })
]);

const apiKeyPatterns = [
  /\bsk_(?:live|test)_[A-Za-z0-9_=-]{12,}\b/g,
  /\b(?:api[_-]?key|client[_-]?secret|webhook[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{20,}/gi
];

const serviceRolePatterns = [
  /^SUPABASE_SERVICE_ROLE_KEY[^\S\r\n]*=[^\S\r\n]*(?!["']?(?:placeholder|replace-me|todo|example)\b)["']?\S{12,}/gim,
  /\bservice[_-]?role\b[\s\S]{0,80}\beyJ[A-Za-z0-9_-]{16,}/gi
];

export function createSourceLeakRiskReport(
  targets: readonly ArtifactScanTarget[]
): SourceLeakRiskReport {
  const findings = targets.flatMap((target) => scanArtifactTarget(target));
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  return Object.freeze({
    ok: criticalCount === 0,
    findingCount: findings.length,
    criticalCount,
    blocksRelease: findings.some((finding) => finding.blocksRelease),
    findings: Object.freeze(findings)
  });
}

export function scanArtifactTarget(target: ArtifactScanTarget): readonly SourceLeakFinding[] {
  const findings: SourceLeakFinding[] = [];
  const normalizedPath = target.filePath.replace(/\\/g, "/");
  const fileName = normalizedPath.split("/").at(-1) ?? normalizedPath;

  if (isUnsafeEnvFile(fileName)) {
    findings.push(
      createFinding({
        type: "env_file",
        severity: "critical",
        filePath: target.filePath,
        message: "Real environment file detected."
      })
    );
  }

  if (target.isBuildOutput) {
    findings.push(
      createFinding({
        type: "build_output",
        severity: "info",
        filePath: target.filePath,
        message: "Build output artifact scanned."
      })
    );
  }

  if (target.isBuildOutput && normalizedPath.endsWith(".map")) {
    findings.push(
      createFinding({
        type: "source_map",
        severity: "high",
        filePath: target.filePath,
        message: "Source map found in build output."
      })
    );
  }

  if (target.content) {
    if (matchesAnyPattern(apiKeyPatterns, target.content)) {
      findings.push(
        createFinding({
          type: "api_key_pattern",
          severity: "critical",
          filePath: target.filePath,
          message: "API key-like value detected."
        })
      );
    }
    if (matchesAnyPattern(serviceRolePatterns, target.content)) {
      findings.push(
        createFinding({
          type: "service_role_pattern",
          severity: "critical",
          filePath: target.filePath,
          message: "Service-role key pattern detected."
        })
      );
    }
  }

  return Object.freeze(findings);
}

function matchesAnyPattern(patterns: readonly RegExp[], content: string): boolean {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(content);
  });
}

export function isUnsafeEnvFile(fileName: string): boolean {
  if (!fileName.startsWith(".env")) {
    return false;
  }
  return !/\.(example|sample|template)(?:\..*)?$/i.test(fileName);
}

function createFinding({
  type,
  severity,
  filePath,
  message
}: {
  type: SourceLeakFindingType;
  severity: SourceLeakSeverity;
  filePath: string;
  message: string;
}): SourceLeakFinding {
  return Object.freeze({
    type,
    severity,
    filePath,
    message,
    blocksRelease: severity === "critical"
  });
}
