# 数据库（PostgreSQL + PostGIS）

本目录为 **城市经济空间 WebGIS** 的后端数据层，与 `web/public/data/mock/hubei/` 模拟数据对齐。

## 环境要求

- PostgreSQL **16**（本机：`D:\pgsql16`，服务名 `PostgreSQL16`）
- **PostGIS** 扩展（与 PostgreSQL 同目录）
- Node.js（执行 `seed.mjs` 灌入 mock）

## 配置

```powershell
cd database
# .env 已存在时可按需修改；否则：
Copy-Item .env.example .env
```

默认连接（见 `.env`）：

| 项 | 值 |
|----|-----|
| 数据库 | `gis_economy` |
| 应用账号 | `gis_app` / `gis_app_dev` |
| 超级用户 | `postgres`（建库用） |

## 一键初始化

```powershell
cd database
npm install
npm run setup
```

或指定 psql 路径：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1 -PsqlPath "D:\pgsql16\bin\psql.exe"
```

## 手动分步

```powershell
$PSQL = "D:\pgsql16\bin\psql.exe"
$env:PGPASSWORD = "postgres"

# 1. 建库（若 template1 缺失，用 postgres 作模板）
& $PSQL -U postgres -d postgres -c "CREATE DATABASE gis_economy WITH TEMPLATE postgres ENCODING 'UTF8';"

# 2. 按序执行 sql/*.sql
Get-ChildItem sql\*.sql | Sort-Object Name | ForEach-Object {
  & $PSQL -U postgres -d gis_economy -v ON_ERROR_STOP=1 -f $_.FullName
}

# 3. 灌入 mock
cd database
npm install
npm run seed
npm run verify
```

## 库结构（schema: `gis`）

| 表 | 说明 |
|----|------|
| `data_sources` / `layer_catalog` | 数据源与图层元数据 |
| `admin_boundaries` | 湖北省界 |
| `city_units` | 市州单元面 + 合成指标 |
| `poi_points` | POI 点 |
| `timeseries_province` | 全省月度时序 |
| `timeseries_cities` | 各市州月度时序 |
| `analysis_tasks` | 分析任务（后端 API 持久化） |

## 当前数据量（验证通过）

| 表 | 行数 |
|----|------|
| admin_boundaries | 1 |
| city_units | 17 |
| poi_points | 272 |
| timeseries_province | 24 |
| timeseries_cities | 408 |
| layer_catalog | 9 |

## 常用命令

```powershell
# 后端连接串
postgresql://gis_app:gis_app_dev@127.0.0.1:5432/gis_economy

# 查看 PostGIS 与样例
D:\pgsql16\bin\psql.exe -U gis_app -d gis_economy -c "SELECT PostGIS_Version();"
D:\pgsql16\bin\psql.exe -U gis_app -d gis_economy -c "SELECT id, name, vitality_idx FROM gis.city_units LIMIT 5;"
```

## 已知问题

若 `createdb` 报 **template1 不存在**，说明集群缺少标准模板库。请用：

```sql
CREATE DATABASE gis_economy WITH TEMPLATE postgres ENCODING 'UTF8';
```

（`setup.ps1` 已自动采用此方式。）
