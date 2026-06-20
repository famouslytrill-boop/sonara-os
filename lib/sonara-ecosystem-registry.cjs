"use strict";

const SONARA_ECOSYSTEMS = [
  "sonara_industries",
  "business_builder",
  "creator_studio",
  "growth_studio",
  "shared_platform"
];

const SONARA_ENGINE_TYPES = [
  "account",
  "platform",
  "website",
  "app",
  "paywall",
  "billing",
  "publishing",
  "support",
  "admin",
  "employee",
  "operations",
  "restaurant",
  "inventory",
  "vehicle",
  "creator",
  "audio",
  "ai",
  "device",
  "analytics",
  "security",
  "legal",
  "integration",
  "automation",
  "open_source",
  "document",
  "marketing",
  "translation",
  "other"
];

const SONARA_MODULE_STATES = [
  "planned",
  "active",
  "setup_required",
  "disabled",
  "archived"
];

const SONARA_ACCESS_LEVELS = [
  "public",
  "free",
  "paid",
  "admin",
  "founder",
  "employee"
];

const SONARA_PUBLIC_WORDS = {
  ecosystem: "Product Area",
  engine: "System",
  module: "Tool",
  dependency: "Requirement",
  entitlement: "Access",
  schema: "Database Setup",
  rls: "Access Protection",
  publication: "Published Version"
};

const SONARA_RESULT_RULES = [
  "Every visible tool must save, load, calculate, publish, bill, export, report, route, or clearly show setup required.",
  "No tool is marked active until its route, table, access rule, and real output exist.",
  "Owner/admin controls business back office access.",
  "Employee tools must only expose assigned staff records.",
  "Paid tools must unlock from database billing state, not from a checkout success URL.",
  "External software must stay cataloged until license, security, cost, and adapter review are complete.",
  "Device, GPS, sound, vibration, and motion features require browser support and user permission."
];

const SONARA_REGISTRY_ROUTES = {
  adminPage: "/admin/ecosystem-registry",
  ecosystemsApi: "/api/ecosystems",
  enginesApi: "/api/ecosystem-engines",
  modulesApi: "/api/ecosystem-modules",
  dependenciesApi: "/api/ecosystem-module-dependencies",
  readinessApi: "/api/ecosystem-registry/readiness"
};

module.exports = {
  SONARA_ECOSYSTEMS,
  SONARA_ENGINE_TYPES,
  SONARA_MODULE_STATES,
  SONARA_ACCESS_LEVELS,
  SONARA_PUBLIC_WORDS,
  SONARA_RESULT_RULES,
  SONARA_REGISTRY_ROUTES
};
