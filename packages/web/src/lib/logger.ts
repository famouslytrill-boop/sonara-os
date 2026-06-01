export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogRecord = {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  createdAt: string;
};

export type StructuredLogger = Readonly<{
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}>;

const sensitiveContextKeyPattern = /(secret|token|password|service.?role|api.?key|webhook)/i;

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

function write(record: LogRecord) {
  const payload = `[${record.level}] ${record.message}`;
  const context = record.context ? redactLogContext(record.context) : {};
  if (record.level === "error") {
    console.error(payload, context);
  } else if (record.level === "warn") {
    console.warn(payload, context);
  } else {
    console.log(payload, context);
  }
}

function isProduction() {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

export function createLogRecord(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): LogRecord {
  return {
    level,
    message,
    context: context ? redactLogContext(context) : undefined,
    createdAt: new Date().toISOString()
  };
}

export function redactLogContext(context: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      sensitiveContextKeyPattern.test(key) ? "[REDACTED]" : redactNestedValue(value)
    ])
  );
}

export function createStructuredLogger(): StructuredLogger {
  return Object.freeze({
    debug(message: string, context?: Record<string, unknown>) {
      if (!isProduction()) {
        write(createLogRecord("debug", message, context));
      }
    },
    info(message: string, context?: Record<string, unknown>) {
      write(createLogRecord("info", message, context));
    },
    warn(message: string, context?: Record<string, unknown>) {
      write(createLogRecord("warn", message, context));
    },
    error(message: string, context?: Record<string, unknown>) {
      write(createLogRecord("error", message, context));
    }
  });
}

function redactNestedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactNestedValue(item));
  }
  if (value && typeof value === "object") {
    return redactLogContext(value as Record<string, unknown>);
  }
  return value;
}

export const logger = createStructuredLogger();
