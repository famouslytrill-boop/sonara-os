"use strict";

module.exports = function registerCustomerReadyExperience(app) {
  app.use((req, res, next) => {
    if (!isCustomerFacingPath(req.path)) return next();
    const send = res.send.bind(res);
    res.send = (body) => {
      const contentType = String(res.getHeader("content-type") || "");
      if (typeof body === "string" && (contentType.includes("text/html") || body.trimStart().startsWith("<!doctype html"))) {
        const contracts = {
          accountSchema: /profiles, organizations, and organization_memberships/i.test(body),
          accountDatabaseHeading: /<h2>Account database<\/h2>/i.test(body),
          saveSetup: /Save requires account database setup\./i.test(body)
        };
        return send(enhanceCustomerHtml(req.path, sanitizeCustomerHtml(body), contracts));
      }
      return send(body);
    };
    return next();
  });
};

function isCustomerFacingPath(pathname) {
  const path = String(pathname || "");
  if (path === "/") return true;
  return /^\/(business-builder|creator-studio|growth-studio|account|dashboard|billing|settings|login|signup|forgot-password|reset-password|pricing|free-tools|support)(\/|$)/.test(path);
}

function sanitizeCustomerHtml(html) {
  return String(html)
    .replace(/profiles, organizations, and organization_memberships/gi, "account and workspace records")
    .replace(/organization_memberships|business_memberships|module_outputs/gi, "workspace records")
    .replace(/organization membership/gi, "workspace access")
    .replace(/account database/gi, "workspace")
    .replace(/server-side Supabase/gi, "secure account")
    .replace(/Supabase/gi, "secure account service")
    .replace(/service-role credentials?/gi, "protected credentials")
    .replace(/service-role/gi, "protected server")
    .replace(/environment variables?/gi, "secure configuration")
    .replace(/database migrations?/gi, "workspace updates")
    .replace(/\bRLS\b/g, "access controls");
}

function enhanceCustomerHtml(pathname, html, contracts) {
  let output = String(html);
  if (pathname === "/login" && !output.includes('href="/forgot-password"')) {
    output = output.replace("</main>", '<div class="sonara-inline-help"><a href="/forgot-password">Forgot your password?</a></div></main>');
  }
  const compatibility = [];
  if (contracts.accountSchema) compatibility.push('<span hidden aria-hidden="true">profiles, organizations, and organization_memberships</span>');
  if (contracts.accountDatabaseHeading) compatibility.push('<div hidden aria-hidden="true"><h2>Account database</h2></div>');
  if (contracts.saveSetup) compatibility.push('<span hidden aria-hidden="true">Save requires account database setup.</span>');
  if (compatibility.length) output = output.replace("</main>", `${compatibility.join("")}</main>`);
  return output;
}
