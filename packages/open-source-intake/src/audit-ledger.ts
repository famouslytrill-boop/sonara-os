import type { OpenSourceAuditEvent, OpenSourceProjectRecord } from "./types.ts";

export function createOpenSourceAuditEvent(
  project: OpenSourceProjectRecord,
  eventType: OpenSourceAuditEvent["eventType"],
  summary: string,
  createdAt = new Date().toISOString()
): OpenSourceAuditEvent {
  return Object.freeze({
    id: `open_source_audit_${project.id}_${eventType.replaceAll(".", "_")}`,
    projectId: project.id,
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    eventType,
    summary,
    createdAt,
    metadata: Object.freeze({
      normalizedUrl: project.normalizedUrl,
      integrationStatus: project.integrationStatus,
      useMode: project.useMode,
      licenseRisk: project.licenseRisk,
      securityRisk: project.securityRisk
    })
  });
}

export function createOpenSourceAuditLedger(
  projects: readonly OpenSourceProjectRecord[]
): readonly OpenSourceAuditEvent[] {
  return Object.freeze(
    projects.flatMap((project) => {
      const events = [
        createOpenSourceAuditEvent(
          project,
          "project.intake_created",
          "Project added to intake registry."
        )
      ];
      if (project.integrationStatus === "blocked") {
        events.push(
          createOpenSourceAuditEvent(
            project,
            "project.blocked",
            "Project is blocked by intake policy."
          )
        );
      }
      if (
        project.licenseRisk === "unknown" ||
        project.licenseRisk === "high" ||
        project.licenseRisk === "critical"
      ) {
        events.push(
          createOpenSourceAuditEvent(
            project,
            "project.license_review_required",
            "License review is required before use beyond intake."
          )
        );
      }
      if (
        project.securityRisk === "unknown" ||
        project.securityRisk === "high" ||
        project.securityRisk === "critical"
      ) {
        events.push(
          createOpenSourceAuditEvent(
            project,
            "project.security_review_required",
            "Security review is required before use beyond intake."
          )
        );
      }
      if (project.integrationStatus === "reviewed_reference_only") {
        events.push(
          createOpenSourceAuditEvent(
            project,
            "project.reference_only",
            "Project is limited to reference or concept use."
          )
        );
      }
      return events;
    })
  );
}
