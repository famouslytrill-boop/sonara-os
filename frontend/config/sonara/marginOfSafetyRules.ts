export const sonaraMarginOfSafetyRules = [
  {
    id: "protect-beginner-focus",
    label: "Protect beginner focus",
    threshold: 70,
    description: "New systems must stay behind a simple product door unless they directly improve creator workflow clarity.",
  },
  {
    id: "protect-delivery-margin",
    label: "Protect delivery margin",
    threshold: 64,
    description: "Pricing and packaging should leave room for support, tools, storage, and quality review.",
  },
  {
    id: "protect-trust",
    label: "Protect trust",
    threshold: 82,
    description: "No claims, automations, or marketplace behaviors that create avoidable reputation risk.",
  },
  {
    id: "protect-scope",
    label: "Protect scope",
    threshold: 72,
    description: "Delay heavy systems until user demand, operating margin, and trust controls justify them.",
  },
] as const;
