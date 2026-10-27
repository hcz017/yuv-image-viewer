param(
  [switch]$Zip
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

npm ci
npm run compile
npm run test
npm run app:build
npm run check:version

Push-Location app
try {
  npx tauri build
} finally {
  Pop-Location
}

$Exe = Join-Path $Root "app\src-tauri\target\release\yuv-image-viewer.exe"
if (-not (Test-Path $Exe)) {
  throw "未找到构建产物: $Exe"
}

if ($Zip) {
  $Out = Join-Path $Root "yuv-image-viewer-standalone-win64.zip"
  if (Test-Path $Out) { Remove-Item $Out -Force }
  Compress-Archive -Path $Exe, (Join-Path $Root "packaging\windows\*") -DestinationPath $Out
  Write-Host "已生成 $Out"
}
