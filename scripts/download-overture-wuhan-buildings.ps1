# Download Overture building footprints for Wuhan
# Usage:
#   .\scripts\download-overture-wuhan-buildings.ps1
#   .\scripts\download-overture-wuhan-buildings.ps1 -Wide

param([switch]$Wide)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (Get-Command py -ErrorAction SilentlyContinue) {
    $py = "py", "-3.10"
} else {
    $py = @("python")
}

$args = @("$root\scripts\download-overture-wuhan-buildings.py")
if ($Wide) { $args += "--wide" }

Write-Host "Running: $($py -join ' ') $($args -join ' ')"
& @py @args
