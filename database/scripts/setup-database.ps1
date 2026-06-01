# 城市经济空间 WebGIS · PostgreSQL + PostGIS 一键初始化
# 默认连接本机 D:\pgsql16 安装的 PostgreSQL 16

param(
  [string]$PgBin = "D:\pgsql16\bin",
  [string]$Host = "localhost",
  [int]$Port = 5432,
  [string]$SuperUser = "postgres",
  [string]$Password = $env:PGPASSWORD,
  [string]$DbName = "gis_urban_economy",
  [string]$AppUser = "gis_app",
  [string]$AppPassword = "gis_app_2026",
  [switch]$SkipSeed,
  [switch]$SkipProvinceShp
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$SqlDir = Join-Path $RepoRoot "database\sql"
$ShpPath = Join-Path $RepoRoot "data\geospatial\boundaries\hubei-province\湖北省.shp"

$psql = Join-Path $PgBin "psql.exe"
$createdb = Join-Path $PgBin "createdb.exe"
$shp2pgsql = Join-Path $PgBin "shp2pgsql.exe"

if (-not (Test-Path $psql)) {
  throw "找不到 psql：$psql`n请修改 -PgBin 参数，例如 -PgBin 'D:\pgsql16\bin'"
}

if (-not $Password) {
  $sec = Read-Host "请输入 PostgreSQL 超级用户 [$SuperUser] 的密码" -AsSecureString
  $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  )
}
$env:PGPASSWORD = $Password

Write-Host "==> 检查 PostgreSQL 连接..." -ForegroundColor Cyan
& $psql -U $SuperUser -h $Host -p $Port -d postgres -c "SELECT version();" | Out-Null

Write-Host "==> 创建数据库 [$DbName]..." -ForegroundColor Cyan
$dbExists = & $psql -U $SuperUser -h $Host -p $Port -d postgres -tAc `
  "SELECT 1 FROM pg_database WHERE datname = '$DbName';"
if ($dbExists -match "1") {
  Write-Host "    数据库已存在，跳过 CREATE DATABASE"
} else {
  & $createdb -U $SuperUser -h $Host -p $Port -E UTF8 $DbName
}

Write-Host "==> 执行 schema 初始化 (01_init.sql)..." -ForegroundColor Cyan
& $psql -U $SuperUser -h $Host -p $Port -d $DbName -f (Join-Path $SqlDir "01_init.sql")

if (-not $SkipProvinceShp) {
  if (Test-Path $ShpPath) {
    Write-Host "==> 导入湖北省界 shapefile..." -ForegroundColor Cyan
    & $psql -U $SuperUser -h $Host -p $Port -d $DbName -c `
      "TRUNCATE gis.province_boundary RESTART IDENTITY;"
    $shpSql = & $shp2pgsql -I -s 4326 -W UTF-8 -g geom $ShpPath gis.province_boundary
    $shpSql | & $psql -U $SuperUser -h $Host -p $Port -d $DbName -q
    Write-Host "    省界导入完成"
  } else {
    Write-Host "    警告：未找到 $ShpPath，跳过省界导入" -ForegroundColor Yellow
  }
}

Write-Host "==> 创建应用账号 [$AppUser]..." -ForegroundColor Cyan
$grantSql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$AppUser') THEN
    CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword';
  END IF;
END
`$`$;
GRANT CONNECT ON DATABASE $DbName TO $AppUser;
GRANT USAGE ON SCHEMA gis TO $AppUser;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA gis TO $AppUser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA gis TO $AppUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA gis GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $AppUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA gis GRANT USAGE, SELECT ON SEQUENCES TO $AppUser;
"@
$grantSql | & $psql -U $SuperUser -h $Host -p $Port -d $DbName -q

if (-not $SkipSeed) {
  Write-Host "==> 灌入 mock 模拟数据..." -ForegroundColor Cyan
  Push-Location (Join-Path $RepoRoot "database")
  if (-not (Test-Path "node_modules\pg")) {
    npm install --silent
  }
  $env:DATABASE_URL = "postgresql://${AppUser}:${AppPassword}@${Host}:${Port}/${DbName}"
  npm run seed
  Pop-Location
}

Write-Host "`n==> 验证..." -ForegroundColor Cyan
& $psql -U $SuperUser -h $Host -p $Port -d $DbName -c @"
SELECT 'postgis' AS item, PostGIS_Version() AS value
UNION ALL SELECT 'city_units', COUNT(*)::text FROM gis.city_units
UNION ALL SELECT 'poi', COUNT(*)::text FROM gis.poi
UNION ALL SELECT 'timeseries_province', COUNT(*)::text FROM gis.timeseries_province
UNION ALL SELECT 'timeseries_cities', COUNT(*)::text FROM gis.timeseries_cities
UNION ALL SELECT 'province_boundary', COUNT(*)::text FROM gis.province_boundary;
"@

Write-Host "`n完成！连接串（后端 .env 用）：" -ForegroundColor Green
Write-Host "DATABASE_URL=postgresql://${AppUser}:${AppPassword}@${Host}:${Port}/${DbName}"
