param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path $PSScriptRoot -Parent

$runtime = $env:BOSS_OFFICE_NODE
if (!$runtime -and $env:USERPROFILE) {
  $bundled = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  if (Test-Path -LiteralPath $bundled) { $runtime = $bundled }
}
if (!$runtime) {
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($command) { $runtime = $command.Source }
}
if (!$runtime -or !(Test-Path -LiteralPath $runtime)) {
  throw '找不到 Node.js。請安裝 Node.js 24，或用 BOSS_OFFICE_NODE 指定 node.exe。'
}
$major = [int](& $runtime -p "process.versions.node.split('.')[0]")
if ($LASTEXITCODE -ne 0 -or $major -lt 24) {
  throw "需要 Node.js 24 以上，目前是 $(& $runtime --version)。"
}

$port = if ($env:BOSS_PORT) { [int]$env:BOSS_PORT } else { 4317 }
$url = "http://127.0.0.1:$port"
try {
  $health = Invoke-RestMethod "$url/api/health" -TimeoutSec 2
  if ($health.app -eq 'boss-office') {
    if (!$NoBrowser) { Start-Process $url }
    exit 0
  }
  throw "$port 被其他服務使用"
} catch {
  if ($_.Exception.Message -eq "$port 被其他服務使用") { throw }
}

$logs = Join-Path $appRoot 'data\logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
Start-Process -FilePath $runtime -ArgumentList @('--import','tsx','server/index.ts') -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'service.stdout.log') -RedirectStandardError (Join-Path $logs 'service.stderr.log') | Out-Null
for ($attempt=0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod "$url/api/health" -TimeoutSec 2
    if ($health.app -eq 'boss-office') {
      if (!$NoBrowser) { Start-Process $url }
      exit 0
    }
  } catch {}
}
throw "服務未啟動，請檢查 $logs"
