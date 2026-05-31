#Requires -Version 5.1
<#
.SYNOPSIS
  初始化 PostGIS 数据库：建库、执行 SQL、导入 mock 数据

.USAGE
  cd database
  Copy-Item .env.example .env   # 按需改密码
  .\scripts\setup.ps1

  可选：仅执行 SQL、跳过 seed
  .\scripts\setup.ps1 -SkipSeed

  可选：指定 psql 路径（未加入 PATH 时）
  .\scripts\setup.ps1 -PsqlPath "C:\Program Files\PostgreSQL\16\bin\psql.exe"
#>
param(
  [switch]$SkipSeed,
  [string]$PsqlPath = ""
)

$ErrorActionPreference = "Stop"
$DatabaseDir = Split-Path -Parent $PSScriptRoot
$RootDir = Split-Path -Parent $DatabaseDir

function Load-DotEnv {
  param([string]$Path)
  $envMap = @{}
  if (-not (Test-Path $Path)) {
    throw "未找到 $Path ，请先执行: Copy-Item .env.example .env"
  }
  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $pair = $_ -split '=', 2
    if ($pair.Count -eq 2) {
      $envMap[$pair[0].Trim()] = $pair[1].Trim()
    }
  }
  return $envMap
}

function Find-Psql {
  param([string]$Explicit)
  if ($Explicit -and (Test-Path $Explicit)) { return $Explicit }
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "D:\pgsql16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  return $null
}

function Invoke-Psql {
  param(
    [string]$Psql,
    [string]$Db,
    [string]$User,
    [string]$Password,
    [string]$File = "",
    [string]$Command = ""
  )
  $env:PGPASSWORD = $Password
  $args = @("-h", $cfg.HOST, "-p", $cfg.PORT, "-U", $User, "-d", $Db, "-v", "ON_ERROR_STOP=1")
  if ($File) { $args += @("-f", $File) }
  if ($Command) { $args += @("-c", $Command) }
  & $Psql @args
  if ($LASTEXITCODE -ne 0) { throw "psql 失败 (exit $LASTEXITCODE): $File$Command" }
}

Write-Host "== GIS Economy · PostGIS setup ==" -ForegroundColor Cyan

$envFile = Join-Path $DatabaseDir ".env"
$cfgMap = Load-DotEnv $envFile

$cfg = [ordered]@{
  HOST           = $cfgMap["POSTGRES_HOST"]
  PORT           = $cfgMap["POSTGRES_PORT"]
  SUPERUSER      = $cfgMap["POSTGRES_SUPERUSER"]
  SUPERPASSWORD  = $cfgMap["POSTGRES_SUPERPASSWORD"]
  APPUSER        = $cfgMap["POSTGRES_USER"]
  APPPASSWORD    = $cfgMap["POSTGRES_PASSWORD"]
  DB             = $cfgMap["POSTGRES_DB"]
}

$psql = Find-Psql -Explicit $PsqlPath
if (-not $psql) {
  Write-Host ""
  Write-Host "未检测到 psql。请先安装 PostgreSQL + PostGIS：" -ForegroundColor Yellow
  Write-Host "  1) 下载: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
  Write-Host "  2) 安装时勾选 Stack Builder -> PostGIS" -ForegroundColor Gray
  Write-Host "  3) 或将 PostgreSQL bin 加入 PATH 后重试" -ForegroundColor Gray
  Write-Host ""
  Write-Host "也可尝试（需管理员 PowerShell）：" -ForegroundColor Yellow
  Write-Host '  winget install -e --id PostgreSQL.PostgreSQL.16' -ForegroundColor Gray
  Write-Host ""
  exit 1
}

Write-Host "psql: $psql"

# 1) 创建应用库（若不存在）
$dbExists = Invoke-Psql -Psql $psql -Db "postgres" -User $cfg.SUPERUSER -Password $cfg.SUPERPASSWORD `
  -Command "SELECT 1 FROM pg_database WHERE datname = '$($cfg.DB)'" 2>$null
# 上面不好捕获输出，改用单独命令
$env:PGPASSWORD = $cfg.SUPERPASSWORD
$check = & $psql -h $cfg.HOST -p $cfg.PORT -U $cfg.SUPERUSER -d postgres -tAc `
  "SELECT 1 FROM pg_database WHERE datname = '$($cfg.DB)'"
if ($check.Trim() -ne "1") {
  Write-Host "Creating database $($cfg.DB) ..."
  Invoke-Psql -Psql $psql -Db "postgres" -User $cfg.SUPERUSER -Password $cfg.SUPERPASSWORD `
    -Command "CREATE DATABASE $($cfg.DB) WITH TEMPLATE postgres ENCODING 'UTF8';"
}

# 2) 按序执行 SQL
$sqlDir = Join-Path $DatabaseDir "sql"
$sqlFiles = Get-ChildItem $sqlDir -Filter "*.sql" | Sort-Object Name
foreach ($f in $sqlFiles) {
  Write-Host "Running $($f.Name) ..."
  Invoke-Psql -Psql $psql -Db $cfg.DB -User $cfg.SUPERUSER -Password $cfg.SUPERPASSWORD -File $f.FullName
}

# 3) 导入 mock
if (-not $SkipSeed) {
  Write-Host "Running seed (npm) ..."
  Push-Location $DatabaseDir
  if (-not (Test-Path "node_modules")) {
    npm install
  }
  npm run seed
  npm run verify
  Pop-Location
}

Write-Host ""
Write-Host "Done. Connection string:" -ForegroundColor Green
Write-Host "  postgresql://$($cfg.APPUSER):$($cfg.APPPASSWORD)@$($cfg.HOST):$($cfg.PORT)/$($cfg.DB)" -ForegroundColor Gray
Write-Host ""
Write-Host "Verify PostGIS:" -ForegroundColor Green
Write-Host "  psql -U $($cfg.APPUSER) -d $($cfg.DB) -c `"SELECT PostGIS_Version();`"" -ForegroundColor Gray
