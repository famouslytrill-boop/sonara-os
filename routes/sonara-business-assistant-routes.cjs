"use strict";

// /business-builder/owner/assistant -- the first thing in this product that
// does work on a business's own records rather than storing them.
//
// It runs the nine checks in lib/sonara-business-checks.cjs against the owner's
// rows and says what needs attention: dishes selling below what they cost,
// invoices past due, stock at its reorder level, bookings with no way to reach
// the customer. All arithmetic over records the business already has. No model
// call, no provider, nothing metered -- which is why it can run every time the
// page is opened without costing the owner or the customer anything.
//
// It changes nothing. Every check is a read, and every finding links to the
// page where the owner fixes it themselves. That places it on the self-serve
// side of lib/sonara-agent-authority.cjs, and the module is consulted here
// rather than assumed: if check_data_quality ever moves onto the sensitive
// list, this page stops running rather than quietly continuing.
//
// Two things it deliberately does not do.
//
// It does not hide checks that found nothing. "We looked and it is fine" and
// "we did not look" have to render differently, or a page full of silence reads
// as a clean bill of health it has not earned.
//
// It does not treat a failed read as a clean result. If a table is unavailable
// the page says so for that check. Counting an error as zero findings is the
// exact shape of every blind spot this codebase has had.

const {
  CHECKS,
  SEVERITY_LABEL,
  selectFor,
  runCheck,
  summarise
} = require("../lib/sonara-business-checks.cjs");
const { classifyAction } = require("../lib/sonara-agent-authority.cjs");

const ROW_LIMIT = 500;

module.exports = function registerSonaraBusinessAssistantRoutes(app, deps = {}) {
  const layout = deps.layout;
  const brandCard = deps.brandCard;
  const linkAction = deps.linkAction;
  const escapeHtml = deps.escapeHtml;
  const requireWorkspaceAccess = deps.requireWorkspaceAccess;
  const getCustomerPrimaryOrganization = deps.getCustomerPrimaryOrganization;
  const getSupabaseServerConfig = deps.getSupabaseServerConfig;
  const supabaseHeaders = deps.supabaseHeaders;

  if (typeof layout !== "function" || typeof requireWorkspaceAccess !== "function") return;

  async function readRows(config, check, organizationId) {
    const query = `?select=${selectFor(check)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=${ROW_LIMIT}`;
    const response = await fetch(`${config.url}/rest/v1/${check.table}${query}`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => []);
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  }

  function findingList(result) {
    // Ten is enough to act on. Past that the list becomes the problem.
    const shown = result.findings.slice(0, 10);
    const rest = result.findings.length - shown.length;
    const items = shown.map((finding) => `<li>${escapeHtml(finding.sentence)}</li>`).join("");
    const more = rest > 0 ? `<p>and ${rest} more.</p>` : "";
    return `<ul>${items}</ul>${more}`;
  }

  function resultCard(result) {
    if (result.unavailable) {
      return brandCard(
        result.label,
        "This check could not run — the records behind it were not reachable just now. It is not a result; try again shortly."
      );
    }
    if (result.count === 0) {
      return brandCard(result.label, "Checked, nothing to fix.");
    }
    const heading = `${result.count} ${result.count === 1 ? "item needs" : "items need"} attention. ${result.why}`;
    return brandCard(result.label, `${heading}${findingList(result)}`);
  }

  app.get("/business-builder/owner/assistant", requireWorkspaceAccess("business_builder"), async (req, res) => {
    // The authority module decides, rather than this page assuming. Reading
    // records and reporting is self-serve today; if that ever changes, this
    // stops instead of carrying on under an assumption written down once.
    const permission = classifyAction("check_data_quality");
    if (permission.requiresOwnerApproval) {
      return res.status(200).type("html").send(layout({
        title: "Business assistant",
        eyebrow: "Business Builder",
        heading: "This needs your approval before it can run",
        body: permission.reason,
        sections: [brandCard("Why you are seeing this", "Checking your records has been reclassified as something that needs your say-so. Nothing has run.")],
        actions: [linkAction("/business-builder/owner", "Back to your business")]
      }));
    }

    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : null;
    const org = typeof getCustomerPrimaryOrganization === "function"
      ? await getCustomerPrimaryOrganization(req.sonaraAccess?.user || req.user, { autoBootstrap: false }).catch(() => null)
      : null;

    if (!config?.ok || !org?.ok || !org.organizationId) {
      return res.status(200).type("html").send(layout({
        title: "Business assistant",
        eyebrow: "Business Builder",
        heading: "Setup required",
        body: "Your workspace is not connected yet, so there are no records to check.",
        sections: [brandCard("What to do", "Finish setting up your business and this page will start checking your records.")],
        actions: [linkAction("/business-builder/owner", "Back to your business")]
      }));
    }

    const results = [];
    for (const check of CHECKS) {
      const read = await readRows(config, check, org.organizationId);
      if (!read.ok) {
        results.push({ id: check.id, label: check.label, severity: check.severity, count: 0, findings: [], unavailable: true, why: check.why });
        continue;
      }
      results.push(runCheck(check, read.rows));
    }

    const summary = summarise(results);
    const unavailable = summary.results.filter((result) => result.unavailable).length;
    const ran = summary.results.length - unavailable;

    // The headline never rounds an unreachable check down to "fine".
    const headline = unavailable > 0
      ? `${summary.total} ${summary.total === 1 ? "item needs" : "items need"} attention. ${unavailable} of ${summary.results.length} checks could not run.`
      : summary.total === 0
        ? `All ${ran} checks ran and found nothing to fix.`
        : `${summary.total} ${summary.total === 1 ? "item needs" : "items need"} attention across ${ran} checks.`;

    const sections = [];
    let currentSeverity = "";
    for (const result of summary.results) {
      if (result.severity !== currentSeverity) {
        currentSeverity = result.severity;
        sections.push(brandCard(SEVERITY_LABEL[currentSeverity] || currentSeverity, ""));
      }
      sections.push(resultCard(result));
    }

    const actions = [linkAction("/business-builder/owner", "Back to your business")];
    for (const result of summary.results.slice(0, 3)) {
      const check = CHECKS.find((entry) => entry.id === result.id);
      if (result.count > 0 && check) actions.push(linkAction(check.fixPath, check.fixLabel));
    }

    return res.status(200).type("html").send(layout({
      title: "Business assistant",
      eyebrow: "Business Builder",
      heading: "What needs your attention",
      body: `${headline} Nothing here has been changed — every item links to the page where you decide what to do about it.`,
      sections,
      actions
    }));
  });
};
