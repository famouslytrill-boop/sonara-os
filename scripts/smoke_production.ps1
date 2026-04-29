param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")

$routes = @("/", "/create", "/library", "/export", "/settings")
foreach ($route in $routes) {
  $response = Invoke-WebRequest -UseBasicParsing "$base$route"
  if ($response.StatusCode -ne 200) {
    throw "Route $route returned $($response.StatusCode)"
  }
}

$analysis = @{
  fingerprint = @{
    id = "SONARA-SMOKE"
    identity = "Production smoke-test identity"
    mood = "focused"
    audienceSignal = "launch verification"
    sonicPalette = @("lead vocal", "clean drums")
  }
  readiness = @{
    score = 80
    launchState = "ready"
    blockers = @()
    nextChecks = @("Confirm env", "Confirm private storage")
  }
  releasePlan = @{
    positioning = "SONARA verifies identity before release."
    hook = "Every song gets a fingerprint."
    rollout = @("Fingerprint", "Package", "Launch")
    exportAssets = @(@{ name = "fingerprint.json"; purpose = "identity" })
  }
}

$body = @{ analysis = $analysis } | ConvertTo-Json -Depth 10
$zip = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/sonara/export" -Method Post -ContentType "application/json" -Body $body
if ($zip.StatusCode -ne 200 -or $zip.Headers["Content-Type"] -notlike "*application/zip*") {
  throw "Export smoke test failed"
}

Write-Output "Production smoke test passed for $base"
