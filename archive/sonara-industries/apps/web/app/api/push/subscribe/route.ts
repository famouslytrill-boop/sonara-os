export async function POST() {
  return Response.json({
    ok: false,
    status: "push_notifications_not_configured",
    message: "Push notifications require explicit user permission, VAPID keys, and product-specific approval rules.",
  });
}
