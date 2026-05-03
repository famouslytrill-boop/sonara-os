param(
  [ValidateSet("production", "preview", "development")]
  [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"

Write-Host "SONARA Vercel environment setup" -ForegroundColor Cyan
Write-Host "This script prompts for values and sends them to Vercel. It does not write secrets to files." -ForegroundColor Yellow
Write-Host "Service role keys must never be committed." -ForegroundColor Yellow

$variables = @(
  "SONARA_AI_PROVIDER",
  "SONARA_CRON_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_CREATOR_MONTHLY_PRICE_ID",
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_LABEL_MONTHLY_PRICE_ID",
  "NEXT_PUBLIC_APP_URL",
  "OPENAI_API_KEY"
)

foreach ($name in $variables) {
  $skip = Read-Host "Add $name to $Environment? Type y to add"
  if ($skip -ne "y") {
    continue
  }

  $value = Read-Host "Enter value for $name"
  if ([string]::IsNullOrWhiteSpace($value)) {
    Write-Host "Skipped $name because no value was entered." -ForegroundColor DarkYellow
    continue
  }

  $value | npx vercel env add $name $Environment
}

Write-Host "Done. Redeploy without build cache after changing production environment variables." -ForegroundColor Green
