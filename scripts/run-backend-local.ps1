$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$env:MONGO_URI = "mongodb://127.0.0.1:27017/it_asset_tracker"
Set-Location (Join-Path $root "backend")
node server.js *> (Join-Path $root "backend.local.log")
