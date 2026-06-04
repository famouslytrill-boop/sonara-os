param(
  [switch]$Strict
)

$ErrorActionPreference = "Continue"
$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Test-CommandVersion {
  param(
    [string]$Name,
    [string[]]$Arguments = @("--version"),
    [switch]$Required
  )

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    $message = "$Name is not installed or not on PATH."
    if ($Required) {
      $failures.Add($message)
    } else {
      $warnings.Add($message)
    }
    Write-Host "[missing] $message"
    return
  }

  try {
    $output = & $Name @Arguments 2>&1 | Select-Object -First 1
    Write-Host "[ok] $Name $output"
  } catch {
    $message = "$Name exists but version check failed: $($_.Exception.Message)"
    if ($Required) {
      $failures.Add($message)
    } else {
      $warnings.Add($message)
    }
    Write-Host "[warn] $message"
  }
}

Test-CommandVersion -Name "git" -Required
Test-CommandVersion -Name "gh"
Test-CommandVersion -Name "node" -Arguments @("-v") -Required
Test-CommandVersion -Name "pnpm" -Arguments @("-v") -Required
Test-CommandVersion -Name "docker"
Test-CommandVersion -Name "supabase"
Test-CommandVersion -Name "ffmpeg" -Arguments @("-version")
Test-CommandVersion -Name "java" -Arguments @("-version")

if (Get-Command docker -ErrorAction SilentlyContinue) {
  try {
    docker compose version | Select-Object -First 1 | ForEach-Object { Write-Host "[ok] $_" }
  } catch {
    $warnings.Add("docker compose version failed.")
  }
}

if (Get-Command wsl -ErrorAction SilentlyContinue) {
  try {
    wsl -l -v
  } catch {
    $warnings.Add("wsl -l -v failed.")
  }
} else {
  $warnings.Add("WSL is not installed or not on PATH.")
}

if (-not (Test-Path package.json)) {
  $failures.Add("package.json is missing from the current folder.")
}
if (Test-Path package-lock.json) {
  $failures.Add("package-lock.json exists. This repo must use pnpm only.")
}
if (-not (Test-Path .env.local)) {
  $warnings.Add(".env.local is missing. Local provider-backed features will show setup gates.")
}
if (-not (Test-Path node_modules)) {
  $warnings.Add("node_modules is missing. Run pnpm install --frozen-lockfile.")
}

Write-Host ""
Write-Host "Warnings:"
$warnings | ForEach-Object { Write-Host "- $_" }

if ($failures.Count -gt 0 -or ($Strict -and $warnings.Count -gt 0)) {
  Write-Host ""
  Write-Host "Failures:"
  $failures | ForEach-Object { Write-Host "- $_" }
  exit 1
}

Write-Host "Local Windows tool check completed."
