export type StrategyCard = Readonly<{
  title: string;
  signal: string;
  nextStep: string;
}>;

export type StrategyPage = Readonly<{
  route: string;
  title: string;
  summary: string;
  cards: readonly StrategyCard[];
}>;

export const strategyPages: readonly StrategyPage[] = Object.freeze([
  Object.freeze({
    route: "/signature-memory",
    title: "Signature Memory Graph",
    summary: "Persistent taste and signature memory map for creative direction.",
    cards: Object.freeze([
      Object.freeze({
        title: "Taste Cluster",
        signal: "Nocturnal synth texture",
        nextStep: "Anchor future prompts to the verified sonic fingerprint."
      }),
      Object.freeze({
        title: "Signature Link",
        signal: "Hook-first minor-key lift",
        nextStep: "Connect winning variants back to the catalog memory."
      })
    ])
  }),
  Object.freeze({
    route: "/prompt-genome",
    title: "Prompt Genome",
    summary: "Versioned prompt evolution manager for reusable creative systems.",
    cards: Object.freeze([
      Object.freeze({
        title: "Genome v1",
        signal: "Mood, hook, arrangement, mix intent",
        nextStep: "Preserve the highest-performing prompt branch."
      }),
      Object.freeze({
        title: "Genome v2",
        signal: "Short-form hook mutation",
        nextStep: "Compare caption and visual prompt changes before promotion."
      })
    ])
  }),
  Object.freeze({
    route: "/producer-copilot",
    title: "Producer Copilot",
    summary: "Assistant panel for arrangement and mix suggestions.",
    cards: Object.freeze([
      Object.freeze({
        title: "Arrangement",
        signal: "Chorus lift arrives late",
        nextStep: "Move the strongest motif into the first eight bars."
      }),
      Object.freeze({
        title: "Mix",
        signal: "Low-mid density risk",
        nextStep: "Leave space for vocal and transient clarity."
      })
    ])
  }),
  Object.freeze({
    route: "/rights-vault",
    title: "Rights Vault",
    summary: "Central rights dashboard for splits, metadata, and provenance passports.",
    cards: Object.freeze([
      Object.freeze({
        title: "Splits",
        signal: "Collaborator shares pending",
        nextStep: "Confirm ownership before release packaging."
      }),
      Object.freeze({
        title: "Provenance Passport",
        signal: "Attached",
        nextStep: "Keep source notes bundled with export assets."
      })
    ])
  }),
  Object.freeze({
    route: "/release-simulator",
    title: "Release Simulator",
    summary: "Forecast streams, risk scenarios, and release outcome modeling.",
    cards: Object.freeze([
      Object.freeze({
        title: "Forecast Streams",
        signal: "18k baseline",
        nextStep: "Model staggered drops against the single release path."
      }),
      Object.freeze({
        title: "Risk Scenario",
        signal: "Medium timing risk",
        nextStep: "Shift content cadence around release-week competition."
      })
    ])
  }),
  Object.freeze({
    route: "/plugin-marketplace",
    title: "Plugin Marketplace Shell",
    summary: "Plugin discovery shell with no install backend.",
    cards: Object.freeze([
      Object.freeze({
        title: "Discovery",
        signal: "Creative utilities",
        nextStep: "Surface compatible plugins for Create, Optimize, Release, and Scale."
      })
    ])
  }),
  Object.freeze({
    route: "/collaboration-rooms",
    title: "Collaboration Rooms",
    summary: "Multi-user workspace shell for creative coordination.",
    cards: Object.freeze([
      Object.freeze({
        title: "Room Queue",
        signal: "Three collaborators",
        nextStep: "Stage comments, tasks, and approval handoffs."
      })
    ])
  }),
  Object.freeze({
    route: "/label-dashboard",
    title: "Label Dashboard",
    summary: "Executive analytics layer for catalog, campaigns, and pipeline.",
    cards: Object.freeze([
      Object.freeze({
        title: "Catalog",
        signal: "82 leverage score",
        nextStep: "Prioritize releases with reusable product assets."
      }),
      Object.freeze({
        title: "Campaigns",
        signal: "Two active rollouts",
        nextStep: "Inspect content cadence and licensing readiness."
      })
    ])
  }),
  Object.freeze({
    route: "/agent-routing",
    title: "Creative Agent Routing",
    summary: "Task router UI for assigning work to Signal OS subsystems.",
    cards: Object.freeze([
      Object.freeze({
        title: "Signal Initialization",
        signal: "Prompt and arrangement work",
        nextStep: "Route generation tasks through Provider Gateway."
      }),
      Object.freeze({
        title: "Scale",
        signal: "Catalog and revenue work",
        nextStep: "Route productization tasks to Growth systems."
      })
    ])
  }),
  Object.freeze({
    route: "/readiness-audit",
    title: "Growth Readiness Audit",
    summary: "Product health dashboard for retention, activation, and usage friction.",
    cards: Object.freeze([
      Object.freeze({
        title: "Retention",
        signal: "Healthy",
        nextStep: "Protect saved workflow loops."
      }),
      Object.freeze({
        title: "Usage Friction",
        signal: "Moderate",
        nextStep: "Reduce steps between analysis and export."
      })
    ])
  }),
  Object.freeze({
    route: "/campaign-assistant",
    title: "Campaign Assistant",
    summary: "Campaign planner copilot UI for release momentum.",
    cards: Object.freeze([
      Object.freeze({
        title: "Launch Arc",
        signal: "Tease, drop, recap",
        nextStep: "Draft a campaign calendar from the selected release plan."
      })
    ])
  }),
  Object.freeze({
    route: "/catalog-compounding",
    title: "Catalog Compounding",
    summary: "Catalog growth flywheel for reusable assets and releases.",
    cards: Object.freeze([
      Object.freeze({
        title: "Flywheel",
        signal: "Release to product to licensing",
        nextStep: "Turn each release into a reusable asset bundle."
      })
    ])
  }),
  Object.freeze({
    route: "/deal-room",
    title: "Deal Room",
    summary: "Deal evaluation workspace for rights scope and catalog upside.",
    cards: Object.freeze([
      Object.freeze({
        title: "License Offer",
        signal: "$1.2k non-exclusive",
        nextStep: "Compare payout, rights scope, and catalog upside."
      })
    ])
  }),
  Object.freeze({
    route: "/pricing-models",
    title: "Pricing Models",
    summary: "Subscription and one-off product pricing simulator.",
    cards: Object.freeze([
      Object.freeze({
        title: "Subscription",
        signal: "$9 monthly supporter tier",
        nextStep: "Bundle presets and monthly prompt packs."
      }),
      Object.freeze({
        title: "One-Off",
        signal: "$29 kit purchase",
        nextStep: "Test launch bundle price against single product price."
      })
    ])
  }),
  Object.freeze({
    route: "/knowledge-search",
    title: "Knowledge Graph Search",
    summary: "Global semantic search UI over projects and signatures.",
    cards: Object.freeze([
      Object.freeze({
        title: "Semantic Index",
        signal: "Projects, signatures, rights notes",
        nextStep: "Resolve semantic results when backend search arrives."
      })
    ])
  }),
  Object.freeze({
    route: "/enterprise-controls",
    title: "Enterprise Controls",
    summary: "Advanced org admin controls shell.",
    cards: Object.freeze([
      Object.freeze({
        title: "Org Policy",
        signal: "Workspace roles",
        nextStep: "Keep admin-only controls separate from creative workflows."
      }),
      Object.freeze({
        title: "Secrets",
        signal: "Server-only",
        nextStep: "Never expose service-role credentials in client UI."
      })
    ])
  }),
  Object.freeze({
    route: "/command-center",
    title: "Creative OS Command Center",
    summary: "Global creative operating system dashboard shell.",
    cards: Object.freeze([
      Object.freeze({
        title: "Signal Initialization",
        signal: "Draft to analysis",
        nextStep: "Show the next best action for the active project."
      }),
      Object.freeze({
        title: "Catalog Intelligence",
        signal: "Release to revenue",
        nextStep: "Connect catalog, campaign, and opportunity status."
      })
    ])
  }),
  Object.freeze({
    route: "/orchestration",
    title: "Agent Orchestration",
    summary: "Visual orchestration UI for Signal OS subsystems.",
    cards: Object.freeze([
      Object.freeze({
        title: "Subsystem Chain",
        signal: "Analyze to Compose to Export",
        nextStep: "Visualize routing without executing autonomous agents."
      })
    ])
  }),
  Object.freeze({
    route: "/positioning",
    title: "Category Leadership",
    summary: "Competitive positioning dashboard.",
    cards: Object.freeze([
      Object.freeze({
        title: "Position",
        signal: "Creative OS for music scaling",
        nextStep: "Frame Create, Optimize, Release, and Scale as one system."
      })
    ])
  }),
  Object.freeze({
    route: "/readiness-package",
    title: "V1.5 Readiness Package",
    summary: "Final readiness center for scaling, security, and launch checks.",
    cards: Object.freeze([
      Object.freeze({
        title: "Scaling Checklist",
        signal: "In progress",
        nextStep: "Confirm build, smoke, and CI gates."
      }),
      Object.freeze({
        title: "Security Checklist",
        signal: "Server-only secrets",
        nextStep: "Audit auth and Provider Gateway boundaries."
      }),
      Object.freeze({
        title: "Launch Checklist",
        signal: "Pending",
        nextStep: "Inspect final workflows before V1.5 packaging."
      })
    ])
  })
]);

export function findStrategyPage(route: string) {
  return strategyPages.find((page) => page.route === route) ?? null;
}
