export const appHealthProvider = {
  id: "app_health",
  checks: [
    "app_uptime",
    "api_error_rate",
    "webhook_failures",
    "auth_failures",
    "payment_provider_errors",
    "email_sms_delivery_errors",
    "file_upload_errors",
    "slow_dashboard_queries",
    "supabase_latency_placeholder"
  ]
} as const;
