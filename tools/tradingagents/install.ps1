param([string]$Python)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$runtimeRoot = Join-Path (Split-Path $projectRoot -Parent) 'runtime/tradingagents'
$commit = '2d17df8da1536c121e4d7395ac5a5dcec9e96d6f'
if (!$Python) { $Python = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' }
if (!(Test-Path -LiteralPath $Python)) { throw 'Specify Python 3.12+ with -Python.' }
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$source = Join-Path $runtimeRoot 'source'
if (!(Test-Path -LiteralPath $source)) {
  git clone --no-checkout https://github.com/TauricResearch/TradingAgents.git $source
  if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
}
git -C $source checkout --detach $commit
if ($LASTEXITCODE -ne 0) { throw 'Pinned source unavailable; installation stopped' }
'{}' | Set-Content -LiteralPath (Join-Path $runtimeRoot 'verified.json') -Encoding utf8
& $Python -m venv (Join-Path $runtimeRoot 'venv')
if ($LASTEXITCODE -ne 0) { throw 'Virtual environment failed' }
$venvPython = Join-Path $runtimeRoot 'venv/Scripts/python.exe'
& $venvPython -m pip install --disable-pip-version-check --no-input $source
if ($LASTEXITCODE -ne 0) { throw 'Installation failed' }
& $venvPython -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Dependency check failed' }
& $venvPython -c "from tradingagents.graph.trading_graph import TradingAgentsGraph; print('IMPORT_OK')"
if ($LASTEXITCODE -ne 0) { throw 'Import failed' }
@{commit=$commit;verifiedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeRoot 'verified.json') -Encoding utf8
& $venvPython -m pip freeze | Set-Content -LiteralPath (Join-Path $runtimeRoot 'installed-packages.txt') -Encoding utf8
Write-Output 'Installed. Configure data/tradingagents.local.json before starting research.'
