# Assembles a portable, double-clickable Botcord (Windows) without electron-builder,
# sidestepping the winCodeSign symlink-privilege requirement. Produces:
#   release/Botcord-win/Botcord.exe   (run directly)
#   release/Botcord-Windows-Portable.zip
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$node = "C:\Program Files\nodejs"
$env:Path = "$node;" + $env:Path

$stage = Join-Path $root 'release\Botcord-win'
$app = Join-Path $stage 'resources\app'
Write-Host '==> Cleaning stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $app -Force | Out-Null

Write-Host '==> Copying Electron runtime'
Copy-Item (Join-Path $root 'node_modules\electron\dist\*') $stage -Recurse -Force
Rename-Item (Join-Path $stage 'electron.exe') 'Botcord.exe'
# Remove Electron's fallback app so ours is used.
Remove-Item (Join-Path $stage 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue

Write-Host '==> Staging app files'
Copy-Item (Join-Path $root 'out') (Join-Path $app 'out') -Recurse -Force
Copy-Item (Join-Path $root 'build') (Join-Path $app 'build') -Recurse -Force
$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$appPkg = [ordered]@{
  name         = 'botcord'
  productName  = 'Botcord'
  version      = $pkg.version
  main         = 'out/main/index.js'
  dependencies = $pkg.dependencies
}
($appPkg | ConvertTo-Json -Depth 6) | Out-File (Join-Path $app 'package.json') -Encoding utf8

Write-Host '==> Installing production dependencies (discord.js)'
Push-Location $app
& npm install --omit=dev --no-audit --no-fund --silent
Pop-Location

Write-Host '==> Branding the executable icon'
$rcedit = Get-ChildItem "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign" -Recurse -Filter 'rcedit-x64.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($rcedit) {
  $exe = Join-Path $stage 'Botcord.exe'
  $ico = Join-Path $root 'build\icon.ico'
  & $rcedit.FullName $exe --set-icon $ico `
    --set-version-string 'ProductName' 'Botcord' `
    --set-version-string 'FileDescription' 'Botcord' `
    --set-version-string 'CompanyName' 'Lucas' `
    --set-file-version $pkg.version --set-product-version $pkg.version 2>$null
  Write-Host '    icon + metadata applied'
} else {
  Write-Host '    rcedit not found — using default Electron icon'
}

Write-Host '==> Zipping'
$zip = Join-Path $root 'release\Botcord-Windows-Portable.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$stage\*" -DestinationPath $zip -CompressionLevel Optimal
$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "==> Done: $zip ($mb MB)"
Write-Host "==> Run: $stage\Botcord.exe"
