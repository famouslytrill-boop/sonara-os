"use strict";

const { INFRASTRUCTURE_SERVICES, PIPELINE_LAYERS, MOBILE_EXPERIENCE_CHECKS, envReadiness } = require("../lib/sonara-infrastructure-manifest.cjs");

function registerSonaraInfrastructureRoutes(app, deps) {
  const { layout, brandCard, linkAction, requireAdmin } = deps;

  app.get("/api/infrastructure/manifest", (req, res) => {
    res.status(200).json({
      ok: true,
      status: "ready",
      services: INFRASTRUCTURE_SERVICES,
      pipelineLayers: PIPELINE_LAYERS,
      mobileExperienceChecks: MOBILE_EXPERIENCE_CHECKS
    });
  });

  app.get("/api/infrastructure/readiness", (req, res) => {
    const services = envReadiness(process.env);
    const required = services.filter((service) => service.launchStatus === "required");
    const missing = required.filter((service) => !service.configured);
    res.status(200).json({
      ok: missing.length === 0,
      status: missing.length ? "setup_required" : "ready",
      missingRequiredServices: missing.map((service) => service.key),
      services,
      pipelineLayers: PIPELINE_LAYERS,
      mobileExperienceChecks: MOBILE_EXPERIENCE_CHECKS
    });
  });

  app.get("/infrastructure", (req, res) => {
    const services = envReadiness(process.env);
    const sections = [
      brandCard("Infrastructure depth", "SONARA tracks hosting, database, renewable sessions, payments, email, source control, local terminal work, Docker/Rancher worker readiness, and governed AI adapters as separate layers."),
      brandCard("MVP launch rule", "Paid-customer readiness depends on passing tests, real database state, verified Stripe webhooks, verified Resend sender, and protected customer access."),
      ...services.map((service) => brandCard(`${service.label}: ${service.configured ? "configured" : service.configurationStatus || service.launchStatus}`, `${service.category}. Endpoints: ${service.endpoints.length ? service.endpoints.join(" / ") : "manual or worker-layer verification"}.`)),
      ...PIPELINE_LAYERS.map((layer) => brandCard(layer.label, layer.description)),
      brandCard("Mobile optimization", MOBILE_EXPERIENCE_CHECKS.join(" / "))
    ];

    res.status(200).type("html").send(layout({
      title: "Infrastructure",
      eyebrow: "System depth",
      heading: "SONARA Infrastructure",
      body: "Operational map for Supabase, renewable sessions, Vercel, Stripe, Resend, GitHub, governed AI adapters, Docker, Rancher, workers, mobile readiness, and launch gates.",
      sections,
      actions: [linkAction("/api/infrastructure/readiness", "Readiness JSON"), linkAction("/admin/system", "Admin system"), linkAction("/dashboard", "Dashboard")]
    }));
  });

  app.get("/admin/infrastructure", requireAdmin, (req, res) => {
    const services = envReadiness(process.env);
    const sections = [
      brandCard("Admin infrastructure view", "This page shows configuration state without exposing raw secret values."),
      ...services.map((service) => brandCard(`${service.label}: ${service.configured ? "configured" : service.configurationStatus || "setup required"}`, service.env.length ? service.env.map((item) => `${item.name}: ${item.configured ? "configured" : "missing"}`).join(" / ") : `${service.launchStatus} manual verification required.`)),
      ...PIPELINE_LAYERS.map((layer) => brandCard(layer.label, layer.description))
    ];

    res.status(200).type("html").send(layout({
      title: "Infrastructure Admin",
      eyebrow: "Founder operations",
      heading: "Infrastructure Admin",
      body: "Founder-only infrastructure readiness for MVP paid-customer launch gates.",
      sections,
      actions: [linkAction("/api/infrastructure/readiness", "Readiness JSON"), linkAction("/admin", "Admin"), linkAction("/admin/system", "System")]
    }));
  });
}

module.exports = registerSonaraInfrastructureRoutes;
