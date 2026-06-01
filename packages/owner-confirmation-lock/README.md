# Owner Confirmation Lock

Owner Confirmation Lock is the internal approval layer for high-risk SONARA One actions.

The system may draft, queue, recommend, flag, summarize, remind, and prepare actions automatically. It must not execute destructive, financial, legal, public-facing, customer-facing, AI-media, data-deletion, payout, or security-changing actions without owner confirmation.

## Required Owner Confirmation

- Money movement
- Refunds
- Price changes
- Payout settings
- Legal or policy text
- Customer-facing campaigns
- Security setting changes
- Deleting data
- Publishing proof or reviews
- AI-generated voice outputs
- AI-generated visual outputs
- AI-generated video outputs

## Always Blocked

- Changing payout destination through automation
- Removing an owner
- Disabling security gates
- Deleting audit logs
- Sending legal notices
- Sending deceptive claims
- Publishing fake reviews or proof

## Usage

```ts
import { createHumanApprovalGate } from "@signal-os/owner-confirmation-lock";

const gate = createHumanApprovalGate();
const queued = gate.submitAction({
  actionKey: "publish_offer_price",
  category: "price_changes",
  productArea: "Business Builder",
  title: "Publish offer price",
  description: "Publish a new offer price.",
  triggeredBy: "automation",
  createdBy: "system"
});

gate.approveAction(queued.record.id, "owner_1");
gate.executeOnlyAfterApproval(queued.record.id);
```

Unknown sensitive actions default to owner review. Blocked actions cannot execute.
