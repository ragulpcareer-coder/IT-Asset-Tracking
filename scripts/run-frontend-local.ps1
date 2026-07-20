$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "frontend")
npm.cmd run dev -- --host 127.0.0.1 *> (Join-Path $root "frontend.local.log")
