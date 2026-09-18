param([string]$Python)
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$OfficeRoot = (Resolve-Path -LiteralPath (Join-Path $ProjectRoot '..')).Path
$RuntimeRoot = Join-Path $OfficeRoot 'runtime\docling'

if (!$Python) { $Python = $env:BOSS_OFFICE_PYTHON }
if (!$Python -and $env:USERPROFILE) {
  $bundled = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
  if (Test-Path -LiteralPath $bundled) { $Python = $bundled }
}
if (!$Python) {
  $command = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($command) { $Python = $command.Source }
}
if (!$Python -or !(Test-Path -LiteralPath $Python)) {
  throw '找不到 Python。請安裝 Python 3.12 以上，或用 -Python / BOSS_OFFICE_PYTHON 指定 python.exe。'
}
& $Python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)"
if ($LASTEXITCODE -ne 0) { throw 'Docling 安裝需要 Python 3.12 以上。' }

New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null
& $Python -m venv (Join-Path $RuntimeRoot 'venv')
$VenvPython = Join-Path $RuntimeRoot 'venv\Scripts\python.exe'
& $VenvPython -m pip install --disable-pip-version-check --no-input -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Docling 安裝失敗' }
& $VenvPython -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Docling 相依套件檢查失敗' }
$Models = Join-Path $RuntimeRoot 'models'
New-Item -ItemType Directory -Path $Models -Force | Out-Null
& (Join-Path $RuntimeRoot 'venv\Scripts\docling-tools.exe') models download layout tableformer --output-dir $Models
if ($LASTEXITCODE -ne 0) { throw 'Docling 模型下載失敗' }
& $VenvPython -m pip freeze | Set-Content -LiteralPath (Join-Path $RuntimeRoot 'installed-packages.txt') -Encoding utf8
Write-Host "Docling 本機環境已安裝：$RuntimeRoot"
