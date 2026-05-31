-- 启用 PostGIS（需已安装 PostGIS 扩展包）
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 常用 UUID（分析任务主键）
CREATE EXTENSION IF NOT EXISTS pgcrypto;
