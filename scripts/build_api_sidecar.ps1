#Requires -Version 5.1
<#
.SYNOPSIS
    Build the axiom-api sidecar binary for Tauri desktop bundling (WOR-14).

.DESCRIPTION
    Produces a standalone one-file console binary of axiom_app.api and places it
    at apps/axiom-desktop/src-tauri/binaries/axiom-api-{target-triple}.exe, which
    is the naming convention Tauri v2 requires for externalBin sidecar binaries.

    Prerequisites: Python environment with axiom-app[api] installed, Rust toolchain
    Usage: powershell -File scripts/build_api_sidecar.ps1
#>
$ErrorActionPreference = "Stop"

# ── Resolve paths ────────────────────────────────────────────────────────────
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutDir   = Join-Path $RepoRoot "apps" "axiom-desktop" "src-tauri" "binaries"

# ── Detect Rust target triple ────────────────────────────────────────────────
try {
    $rustcOutput = rustc -Vv 2>&1
} catch {
    Write-Error "rustc not found. Please install the Rust toolchain and try again."
    exit 1
}

$hostLine = ($rustcOutput | Select-String -Pattern "^host:").Line
if (-not $hostLine) {
    Write-Error "Could not parse target triple from 'rustc -Vv' output."
    exit 1
}
$TargetTriple = ($hostLine -split ":\s*", 2)[1].Trim()

Write-Host "[build_api_sidecar] Target triple: $TargetTriple"
Write-Host "[build_api_sidecar] Output dir:    $OutDir"

# ── Install PyInstaller ──────────────────────────────────────────────────────
pip install pyinstaller
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install PyInstaller."
    exit 1
}

# ── Build sidecar binary ────────────────────────────────────────────────────
$AssetsData       = "${RepoRoot}\axiom_app\assets;axiom_app/assets"
$SettingsData     = "${RepoRoot}\axiom_app\default_settings.json;axiom_app"
$EntryPoint       = Join-Path $RepoRoot "axiom_app" "api" "__main__.py"

pyinstaller `
    --noconfirm `
    --clean `
    --name axiom-api `
    --onefile `
    --console `
    --collect-submodules axiom_app `
    --add-data $AssetsData `
    --add-data $SettingsData `
    $EntryPoint

if ($LASTEXITCODE -ne 0) {
    Write-Error "PyInstaller build failed."
    exit 1
}

# ── Copy to Tauri binaries directory ─────────────────────────────────────────
if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$SourceBinary = Join-Path "dist" "axiom-api.exe"
$DestBinary   = Join-Path $OutDir "axiom-api-${TargetTriple}.exe"

Copy-Item -Path $SourceBinary -Destination $DestBinary -Force

Write-Host "[build_api_sidecar] Sidecar written to: $DestBinary"
