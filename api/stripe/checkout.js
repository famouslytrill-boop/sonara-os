import { Buffer } from "node:buffer";
import { URLSearchParams } from "node:url";
import { getCanonicalAppUrl, resolvePlanPrice, sendJson } from "./_stripe-shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const body = await readBody(req);
  const planSlug = body.planSlug || body.plan || body.get?.("planSlug");
  const resolved = resolvePlanPrice(String(planSlug || ""), process.env);
  if (!resolved.ok) {
    return sendJson(res, resolved.status, {
      error: resolved.code,
      message: resolved.message
    });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return sendJson(res, 503, {
      error: "stripe_not_configured",
      message: "Stripe checkout is not configured."
    });
  }
  const appUrl = getCanonicalAppUrl(process.env);
  if (!appUrl) {
    return sendJson(res, 503, {
      error: "app_url_not_configured",
      message: "APP_URL or NEXT_PUBLIC_APP_URL is required."
    });
  }

  const params = new URLSearchParams();
  params.set("mode", resolved.mode);
  params.set("line_items[0][price]", resolved.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${appUrl}/app/billing?checkout=success`);
  params.set("cancel_url", `${appUrl}/pricing?checkout=cancelled`);
  params.set("metadata[plan_slug]", String(planSlug));
  params.set("metadata[source_env_var]", resolved.sourceEnvVar);

  const stripeResponse = await globalThis.fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  const payload = await stripeResponse.json().catch(() => ({}));
  if (!stripeResponse.ok || typeof payload.url !== "string") {
    return sendJson(res, 502, {
      error: "checkout_session_failed",
      message: `Stripe checkout could not be created. HTTP ${stripeResponse.status}.`
    });
  }
  res.statusCode = 303;
  res.setHeader("Location", payload.url);
  return res.end();
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  if (contentType.includes("application/json")) {
    return JSON.parse(raw || "{}");
  }
  return Object.fromEntries(new URLSearchParams(raw));
}
