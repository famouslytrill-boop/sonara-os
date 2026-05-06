export type JsonRecord = Record<string, unknown>;

export type SystemAuditSeverity = "debug" | "info" | "warning" | "error" | "critical";

export type PlatformJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type DbHealthStatus = "pass" | "warn" | "fail" | "unknown";

export type SystemAuditEventInput = {
  eventType: string;
  source: string;
  actorId?: string | null;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  severity?: SystemAuditSeverity;
  message: string;
  metadata?: JsonRecord;
};

export type PlatformJobInput = {
  jobType: string;
  status?: PlatformJobStatus;
  priority?: number;
  input?: JsonRecord;
};

export type PlatformJobUpdate = {
  status?: PlatformJobStatus;
  output?: JsonRecord;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type DbHealthSnapshotInput = {
  checkName: string;
  status: DbHealthStatus;
  score?: number | null;
  details?: JsonRecord;
};

export type CreatorActivityInput = {
  userId?: string | null;
  sessionId?: string | null;
  eventName: string;
  route?: string | null;
  productArea?: string | null;
  metadata?: JsonRecord;
};

export type DbOpsResult<T> =
  | { ok: true; data: T }
  | { ok: false; skipped?: "supabase_admin_not_configured"; error?: string };

export type PlatformJobRow = {
  id: string;
  job_type: string;
  status: PlatformJobStatus;
  priority: number;
  input: JsonRecord;
  output: JsonRecord;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
