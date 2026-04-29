$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$rootPath = $root.Path.TrimEnd("\")
$dist = Join-Path $root "dist"
$packagePath = Join-Path $dist "sonara-launch-core.zip"

$excludedPatterns = @(
  "\.env$",
  "\.env\.(?!example$)",
  "\\node_modules\\",
  "\\\.next\\",
  "\\\.venv\\",
  "\\__pycache__\\",
  "\\\.pytest_cache\\",
  "\\dist\\",
  "sonara-dev\.(out|err)\.log$"
)

if (!(Test-Path $dist)) {
  New-Item -ItemType Directory -Path $dist | Out-Null
}

if (Test-Path $packagePath) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $packagePath = Join-Path $dist "sonara-launch-core-$timestamp.zip"
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($packagePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $files = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object {
    $path = $_.FullName
    -not ($excludedPatterns | Where-Object { $path -match $_ })
  }

  foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($rootPath.Length + 1).Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip,
      $file.FullName,
      $relativePath,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
}
finally {
  $zip.Dispose()
}

Write-Output $packagePath
