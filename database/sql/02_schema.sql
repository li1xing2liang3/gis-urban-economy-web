-- 城市经济空间 WebGIS · PostGIS 逻辑模型
-- 坐标系：WGS84 (EPSG:4326)

CREATE SCHEMA IF NOT EXISTS gis;
SET search_path TO gis, public;

-- ---------- 元数据 ----------

CREATE TABLE IF NOT EXISTS data_sources (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer_catalog (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  data_source TEXT NOT NULL,
  table_name  TEXT,
  geom_type   TEXT,
  metric      TEXT,
  rule_text   TEXT,
  unit        TEXT,
  sort_order  INT NOT NULL DEFAULT 0
);

-- ---------- 空间要素 ----------

CREATE TABLE IF NOT EXISTS admin_boundaries (
  id          SERIAL PRIMARY KEY,
  code        TEXT,
  name        TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT 'province',
  geom        GEOMETRY(MultiPolygon, 4326) NOT NULL,
  properties  JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS city_units (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  tier                SMALLINT,
  tier_label          TEXT,
  pop_density         DOUBLE PRECISION,
  poi_per_km2         DOUBLE PRECISION,
  poi_count_estimate  INT,
  vitality_idx        SMALLINT,
  econ_idx            SMALLINT,
  pop_idx             SMALLINT,
  night_economy_idx   SMALLINT,
  consume_potential   SMALLINT,
  traffic_reach_idx   SMALLINT,
  inbound_flow_idx    SMALLINT,
  gdp_proxy_idx       SMALLINT,
  pop_growth_pct      DOUBLE PRECISION,
  manufacturing_share DOUBLE PRECISION,
  service_share       DOUBLE PRECISION,
  structure_note      TEXT,
  note                TEXT,
  geom                GEOMETRY(Polygon, 4326) NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poi_points (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  city_id       TEXT REFERENCES city_units(id) ON DELETE SET NULL,
  city_name     TEXT,
  category      TEXT,
  category_key  TEXT,
  importance    DOUBLE PRECISION,
  geom          GEOMETRY(Point, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_poi_geom ON poi_points USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_poi_city ON poi_points (city_id);
CREATE INDEX IF NOT EXISTS idx_poi_category ON poi_points (category_key);
CREATE INDEX IF NOT EXISTS idx_city_units_geom ON city_units USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_geom ON admin_boundaries USING GIST (geom);

-- ---------- 时序指标 ----------

CREATE TABLE IF NOT EXISTS timeseries_province (
  month              DATE PRIMARY KEY,
  pop_index          SMALLINT,
  econ_index         SMALLINT,
  vitality_index     SMALLINT,
  night_economy_index SMALLINT,
  consume_index      SMALLINT,
  traffic_index      SMALLINT
);

CREATE TABLE IF NOT EXISTS timeseries_cities (
  city_id            TEXT NOT NULL REFERENCES city_units(id) ON DELETE CASCADE,
  month              DATE NOT NULL,
  pop_index          SMALLINT,
  econ_index         SMALLINT,
  vitality_index     SMALLINT,
  night_economy_index SMALLINT,
  consume_index      SMALLINT,
  traffic_index      SMALLINT,
  PRIMARY KEY (city_id, month)
);

-- ---------- 分析任务（后端 API 持久化） ----------

CREATE TABLE IF NOT EXISTS analysis_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  params        JSONB NOT NULL DEFAULT '{}'::jsonb,
  result        JSONB,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analysis_tasks_status ON analysis_tasks (status, created_at DESC);
