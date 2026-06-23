"use strict";

function registerFreeLaunchStackRoutes(app, deps) {
  const { layout, brandCard, linkAction } = deps;

  app.get("/free-launch-stack", (req, res) => {
    return res.status(200).type("html").send(
      layout({
        title: "Free Launch Stack",
        eyebrow: "FREE TOOLS DIRECTORY",
        heading: "Build lean before you pay",
        body: "A guided launch stack for founders, creators, and small operators who need real tools before expensive subscriptions.",
        sections: [
          brandCard("Hosting and deployment", "Free and low-cost paths for sites, previews, build logs, rollback, and release checks."),
          brandCard("Database and storage", "Supabase and Postgres-first planning for records, buckets, policies, exports, and access."),
          brandCard("Email and contact", "Verified sending domains, support routing, contact forms, and setup-required fallbacks."),
          brandCard("Analytics and monitoring", "Readiness JSON, deployment checks, event logs, and simple proof metrics."),
          brandCard("Design and media", "Brand assets, screenshots, social proof, launch videos, and creator-ready media planning."),
          brandCard("AI and automation", "Prompt packs, workflow assistants, worker queues, and owner approval gates."),
          brandCard("Security and legal", "Privacy posture, legal routes, role checks, audit trails, and secret scanning."),
          brandCard("Operations templates", "Templates for offers, inventory, media releases, campaigns, and customer follow-up.")
        ],
        actions: [
          linkAction("/signup", "Start Free"),
          linkAction("/pricing", "Upgrade when ready"),
          linkAction("/api/readiness", "Readiness JSON"),
          linkAction("/infrastructure", "Infrastructure")
        ]
      })
    );
  });
}

module.exports = registerFreeLaunchStackRoutes;
