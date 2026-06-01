import { logger } from "../logger.ts";
import { createClientSafeError } from "./error-handling.ts";

export type GlobalErrorBoundaryController = Readonly<{
  dispose(): void;
}>;

type WindowWithBoundaryFlag = Window & {
  __SONARA_GLOBAL_ERROR_BOUNDARY_INSTALLED__?: boolean;
};

export function installGlobalErrorBoundary(): GlobalErrorBoundaryController {
  if (typeof window === "undefined") {
    return Object.freeze({ dispose() {} });
  }

  const scopedWindow = window as WindowWithBoundaryFlag;
  if (scopedWindow.__SONARA_GLOBAL_ERROR_BOUNDARY_INSTALLED__) {
    return Object.freeze({ dispose() {} });
  }
  scopedWindow.__SONARA_GLOBAL_ERROR_BOUNDARY_INSTALLED__ = true;

  const onError = (event: ErrorEvent) => {
    const safeError = createClientSafeError(event.error ?? event.message, "global");
    logger.error("Global client error captured", {
      referenceId: safeError.referenceId,
      message: safeError.message
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const safeError = createClientSafeError(event.reason, "promise");
    logger.error("Unhandled promise rejection captured", {
      referenceId: safeError.referenceId,
      message: safeError.message
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return Object.freeze({
    dispose() {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      scopedWindow.__SONARA_GLOBAL_ERROR_BOUNDARY_INSTALLED__ = false;
    }
  });
}
