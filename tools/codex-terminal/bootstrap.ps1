param([switch]$Execute,[switch]$Repos,[switch]$All,[switch]$SkipVerify)
$ErrorActionPreference="Stop"
$argsList=@((Join-Path $PSScriptRoot "sonara-bootstrap.mjs"))
if($Execute){$argsList+="--execute"}
if($Repos){$argsList+="--repos"}
if($All){$argsList+="--all"}
if($SkipVerify){$argsList+="--skip-verify"}
& node @argsList
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
