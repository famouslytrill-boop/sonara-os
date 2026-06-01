import {
  createHumanApprovalGate,
  ownerConfirmationFeatureFlags,
  sensitiveActionRegistry,
  type OwnerConfirmationAction,
  type OwnerConfirmationStatus,
  type SensitiveActionRecord
} from "@signal-os/owner-confirmation-lock";
import { createElement, createMetric } from "../../../dom.ts";

const demoActions = Object.freeze([
  {
    actionKey: "move_subscription_funds",
    category: "money_movement",
    productArea: "Billing/Stripe",
    title: "Prepare money movement",
    description: "Prepare a provider-hosted billing change for owner review.",
    triggeredBy: "billing-alert-worker",
    createdBy: "system",
    affectedRecords: ["billing_account_setup"],
    publicPrivateImpact: "Private billing setup only until owner approval.",
    moneySecurityLegalCustomerImpact: "Money movement cannot execute without owner confirmation."
  },
  {
    actionKey: "publish_ai_visual",
    category: "ai_visual_output",
    productArea: "Creator Studio",
    title: "Approve generated campaign visual",
    description: "Review generated customer-facing graphic before public use.",
    triggeredBy: "creator-workflow",
    createdBy: "system",
    affectedRecords: ["asset_draft"],
    publicPrivateImpact: "Would become customer-facing only after approval.",
    moneySecurityLegalCustomerImpact: "Asset-rights review required before public use.",
    generatedContentPreview: "Draft visual preview only. No public posting."
  },
  {
    actionKey: "update_refund_policy",
    category: "legal_policy_text",
    productArea: "Legal Readiness",
    title: "Publish refund policy update",
    description: "AI-drafted policy copy is draft-only until owner approval.",
    triggeredBy: "legal-readiness",
    createdBy: "system",
    affectedRecords: ["refund_policy"],
    beforePreview: "Existing refund policy placeholder.",
    afterPreview: "Draft updated refund policy text. Not legal advice.",
    publicPrivateImpact: "Would update public policy copy after approval.",
    moneySecurityLegalCustomerImpact: "Legal/policy text requires owner confirmation."
  },
  {
    actionKey: "publish_testimonial",
    category: "publishing_proof_reviews",
    productArea: "Business Builder",
    title: "Publish testimonial",
    description: "Publish a moderated testimonial after permission review.",
    triggeredBy: "reviews-queue",
    createdBy: "system",
    affectedRecords: ["testimonial_pending"],
    publicPrivateImpact: "Would publish proof/review content after owner approval.",
    moneySecurityLegalCustomerImpact: "Customer proof requires permission and owner approval."
  },
  {
    actionKey: "delete_audit_logs",
    category: "deleting_data",
    productArea: "Security Center",
    title: "Delete audit logs",
    description: "Attempt to delete approval audit logs.",
    triggeredBy: "unknown",
    createdBy: "system",
    affectedRecords: ["owner_confirmation_audit_logs"],
    publicPrivateImpact: "Private audit records would be destroyed.",
    moneySecurityLegalCustomerImpact: "Audit log deletion is always blocked."
  }
] satisfies readonly OwnerConfirmationAction[]);

export function createOwnerReviewDemoState() {
  const gate = createHumanApprovalGate();
  const pendingMoney = gate.submitAction(demoActions[0]);
  const pendingVisual = gate.submitAction(demoActions[1]);
  const legal = gate.submitAction(demoActions[2]);
  gate.approveAction(legal.record.id, "owner_demo");
  const testimonial = gate.submitAction(demoActions[3]);
  gate.rejectAction(testimonial.record.id, "owner_demo", "Permission record is not ready.");
  gate.submitAction(demoActions[4]);
  return {
    ...gate.getState(),
    pendingIds: [pendingMoney.record.id, pendingVisual.record.id]
  };
}

export function renderOwnerReviewShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: readonly HTMLElement[];
}) {
  const page = createElement("section", { className: "work-screen sonara-shell" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Owner Confirmation Lock" }),
    createElement("h1", { textContent: title }),
    createElement("p", { className: "screen-copy", textContent: description }),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Setup-mode only. Approval buttons are visible for launch review, but no live sensitive action executes from this static shell."
    }),
    createElement("a", {
      className: "ghost-action security-back-link",
      href: "/admin/owner-review",
      textContent: "Owner Review Queue"
    })
  );
  page.append(header, ...children);
  return page;
}

export function renderOwnerReviewSummary() {
  const state = createOwnerReviewDemoState();
  const metrics = createElement("div", { className: "metric-grid" });
  metrics.append(
    createMetric("Pending", state.queue.length),
    createMetric(
      "Approved",
      state.records.filter((record) => record.approval_status === "approved").length
    ),
    createMetric(
      "Rejected",
      state.records.filter((record) => record.approval_status === "rejected").length
    ),
    createMetric(
      "Blocked",
      state.records.filter((record) => record.approval_status === "blocked").length
    )
  );
  return metrics;
}

export function renderRecordGrid(records: readonly SensitiveActionRecord[]) {
  const grid = createElement("div", { className: "planning-grid" });
  for (const record of records) {
    grid.append(renderSensitiveActionCard(record));
  }
  return grid;
}

export function renderSensitiveActionCard(record: SensitiveActionRecord) {
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("p", {
      className: `status-badge status-badge--${record.risk_level === "critical" ? "blocked" : "ready"}`,
      textContent: `${record.risk_level} risk`
    }),
    createElement("h2", { textContent: record.title }),
    createElement("p", { className: "screen-copy", textContent: record.description }),
    createMetric("Category", record.action_category),
    createMetric("Status", formatStatus(record.approval_status)),
    createMetric("Product area", record.product_area),
    createMetric("Triggered by", record.triggered_by),
    createMetric("Affected records", record.affected_records.length || "None listed"),
    createMetric("Timestamp", record.created_at),
    createElement("p", {
      className: "recommendation",
      textContent: `Public/private impact: ${record.public_private_impact}`
    }),
    createElement("p", {
      className: "recommendation",
      textContent: `Money/security/legal/customer impact: ${record.money_security_legal_customer_impact}`
    })
  );

  if (record.before_preview || record.after_preview) {
    card.append(renderBeforeAfterPreview(record));
  }
  if (record.generated_content_preview) {
    card.append(
      createElement("p", {
        className: "warning-copy",
        textContent: `Generated content preview: ${record.generated_content_preview}`
      })
    );
  }

  const actions = createElement("div", { className: "action-row" });
  actions.append(
    createReviewButton("Approve"),
    createReviewButton("Reject"),
    createElement("a", {
      className: "secondary-action",
      href: "/admin/owner-review/pending",
      textContent: "View details"
    })
  );
  card.append(actions);
  return card;
}

export function renderAuditHistory() {
  const state = createOwnerReviewDemoState();
  const card = createElement("article", { className: "planning-card shell-card" });
  const list = createElement("ul", { className: "safety-list" });
  for (const event of state.auditEvents) {
    const item = createElement("li");
    item.append(
      createElement("strong", { textContent: event.event_type }),
      createElement("span", {
        textContent: ` - ${event.product_area}: ${event.summary}`
      })
    );
    list.append(item);
  }
  card.append(createElement("h2", { textContent: "Audit history" }), list);
  return card;
}

export function renderPolicyFlagSummary() {
  const card = createElement("article", { className: "planning-card shell-card" });
  const list = createElement("ul", { className: "safety-list" });
  for (const [flag, enabled] of Object.entries(ownerConfirmationFeatureFlags)) {
    list.append(createElement("li", { textContent: `${flag}: ${String(enabled)}` }));
  }
  card.append(createElement("h2", { textContent: "Feature flags" }), list);
  return card;
}

export function renderSensitiveCategoryGrid() {
  const grid = createElement("div", { className: "planning-grid" });
  for (const entry of sensitiveActionRegistry) {
    const card = createElement("article", { className: "planning-card shell-card" });
    const list = createElement("ul", { className: "safety-list" });
    for (const rule of entry.rules) {
      list.append(createElement("li", { textContent: rule }));
    }
    card.append(
      createElement("p", {
        className: `status-badge status-badge--${entry.riskLevel === "critical" ? "blocked" : "ready"}`,
        textContent: `${entry.riskLevel} risk`
      }),
      createElement("h2", { textContent: entry.title }),
      createElement("p", { className: "screen-copy", textContent: entry.summary }),
      createMetric("Category", entry.category),
      createMetric("Requirement", entry.approvalRequirement),
      createMetric("Integrations", entry.integrations.join(", ")),
      list
    );
    grid.append(card);
  }
  return grid;
}

export function filterRecordsByStatus(status: OwnerConfirmationStatus) {
  return createOwnerReviewDemoState().records.filter((record) => record.approval_status === status);
}

function renderBeforeAfterPreview(record: SensitiveActionRecord) {
  const wrapper = createElement("div", { className: "planning-grid" });
  const before = createElement("article", { className: "planning-card shell-card" });
  const after = createElement("article", { className: "planning-card shell-card" });
  before.append(
    createElement("h3", { textContent: "Before" }),
    createElement("p", {
      className: "screen-copy",
      textContent: record.before_preview ?? "No previous value listed."
    })
  );
  after.append(
    createElement("h3", { textContent: "After" }),
    createElement("p", {
      className: "screen-copy",
      textContent: record.after_preview ?? "No proposed value listed."
    })
  );
  wrapper.append(before, after);
  return wrapper;
}

function createReviewButton(label: string) {
  const button = createElement("button", {
    className: label === "Approve" ? "primary-action" : "secondary-action",
    type: "button",
    textContent: label
  });
  button.setAttribute("disabled", "true");
  button.setAttribute("aria-disabled", "true");
  button.setAttribute("title", "Setup-mode only. No live action executes from this page.");
  return button;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}
