import { describe, expect, it } from "vitest";
import {
  autoAllowedOperationsActions,
  blockedOperationsActions,
  canRunPostLaunchAction,
  evaluatePostLaunchAction,
  isBlockedPostLaunchAction,
  postLaunchOperationsQueues,
  requiresOwnerApproval,
  summarizePostLaunchOperations,
  type OperationsQueueId
} from "./lib/post-launch-operations/index.ts";
import { getRouteDefinition, isKnownRoute } from "./routes/route-manifest.ts";

const requiredQueues: readonly OperationsQueueId[] = Object.freeze([
  "customer_follow_ups",
  "review_requests",
  "billing_alerts",
  "failed_webhook_alerts",
  "onboarding_incomplete_alerts",
  "support_requests",
  "security_warnings",
  "reliability_incidents"
]);

describe("post-launch operations", () => {
  it("defines the required operations queues", () => {
    const queueIds = postLaunchOperationsQueues.map((queue) => queue.id);
    expect(queueIds).toEqual(requiredQueues);
    expect(summarizePostLaunchOperations()).toMatchObject({
      totalQueues: requiredQueues.length,
      needsOwnerReview: 3,
      blockedQueues: 1
    });
  });

  it("enforces auto, approval, and blocked post-launch actions", () => {
    for (const actionKind of autoAllowedOperationsActions) {
      expect(canRunPostLaunchAction(actionKind)).toBe(true);
      expect(evaluatePostLaunchAction(actionKind).approvalLevel).toBe("auto_allowed");
    }

    expect(requiresOwnerApproval("send_customer_facing_message")).toBe(true);
    expect(requiresOwnerApproval("change_payment_link")).toBe(true);
    expect(canRunPostLaunchAction("issue_refund")).toBe(false);

    for (const actionKind of blockedOperationsActions) {
      expect(isBlockedPostLaunchAction(actionKind)).toBe(true);
      expect(canRunPostLaunchAction(actionKind)).toBe(false);
    }
  });

  it("registers the operations dashboard as an admin-required route", () => {
    expect(isKnownRoute("/admin/operations")).toBe(true);
    expect(getRouteDefinition("/admin/operations")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required",
      surface: "admin"
    });
  });
});
