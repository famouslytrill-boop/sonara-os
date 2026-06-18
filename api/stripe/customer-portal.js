import { sendJson } from "./_stripe-shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  return sendJson(res, 503, {
    error: "setup_required",
    message:
      "The customer portal is not enabled yet. Configure Stripe customer portal settings before exposing this action."
  });
}
