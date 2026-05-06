$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$excludedDirPatterns = @("\\node_modules\\", "\\.next\\", "\\.git\\", "\\.venv\\", "\\__pycache__\\")
$binaryExtensions = @(
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot"
)

$patterns = @(
  @{ Name = "Stripe secret key value"; Regex = "sk_(live|test)_[A-Za-z0-9]+"; Assignment = $false },
  @{ Name = "Stripe webhook secret value"; Regex = "whsec_[A-Za-z0-9]+"; Assignment = $false },
  @{ Name = "Non-empty secret assignment"; Regex = "^\s*(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY)\s*=\s*(.+?)\s*$"; Assignment = $true }
)

$findings = @()

$files = Get-ChildItem -LiteralPath $root -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
  $path = $_.FullName
  $isExcludedDir = $false

  foreach ($pattern in $excludedDirPatterns) {
    if ($path -match $pattern) {
      $isExcludedDir = $true
      break
    }
  }

  -not $isExcludedDir -and ($binaryExtensions -notcontains $_.Extension.ToLowerInvariant())
}

foreach ($file in $files) {
  $lineNumber = 0

  foreach ($line in Get-Content -LiteralPath $file.FullName -ErrorAction SilentlyContinue) {
    $lineNumber += 1

    foreach ($pattern in $patterns) {
      if ($line -match $pattern.Regex) {
        if ($pattern.Assignment) {
          $value = $Matches[2].Trim().Trim('"').Trim("'")

          if ([string]::IsNullOrWhiteSpace($value)) {
            continue
          }
        }

        $findings += [PSCustomObject]@{
          Path = $file.FullName
          Line = $lineNumber
          Type = $pattern.Name
        }
      }
    }
  }
}

if ($findings.Count -eq 0) {
  Write-Output "[OK] no obvious secret values found"
  exit 0
}

foreach ($finding in $findings) {
  Write-Output "[WARN] possible secret found: $($finding.Path):$($finding.Line) [$($finding.Type)]"
}

exit 1
