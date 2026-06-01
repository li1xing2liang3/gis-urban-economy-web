-- 与 web/public/data/mock/hubei 阶段 2/3 仿真数据对齐（POI 影响圈、因果链指标）

ALTER TABLE gis.poi_points ADD COLUMN IF NOT EXISTS poi_id TEXT;
ALTER TABLE gis.poi_points ADD COLUMN IF NOT EXISTS influence_radius_m INT;
ALTER TABLE gis.poi_points ADD COLUMN IF NOT EXISTS influence_radius_km DOUBLE PRECISION;
ALTER TABLE gis.poi_points ADD COLUMN IF NOT EXISTS properties JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_poi_points_poi_id ON gis.poi_points (poi_id) WHERE poi_id IS NOT NULL;

ALTER TABLE gis.city_units ADD COLUMN IF NOT EXISTS foot_traffic_idx SMALLINT;
ALTER TABLE gis.city_units ADD COLUMN IF NOT EXISTS poi_activity_idx SMALLINT;
ALTER TABLE gis.city_units ADD COLUMN IF NOT EXISTS activity_idx SMALLINT;
ALTER TABLE gis.city_units ADD COLUMN IF NOT EXISTS poi_influence_km2 DOUBLE PRECISION;

ALTER TABLE gis.timeseries_cities ADD COLUMN IF NOT EXISTS inbound_flow_idx SMALLINT;
ALTER TABLE gis.timeseries_cities ADD COLUMN IF NOT EXISTS foot_traffic_idx SMALLINT;
ALTER TABLE gis.timeseries_cities ADD COLUMN IF NOT EXISTS poi_activity_idx SMALLINT;
ALTER TABLE gis.timeseries_cities ADD COLUMN IF NOT EXISTS activity_idx SMALLINT;

CREATE TABLE IF NOT EXISTS gis.poi_influence (
  id                 SERIAL PRIMARY KEY,
  poi_id             TEXT NOT NULL UNIQUE,
  city_id            TEXT REFERENCES gis.city_units(id) ON DELETE SET NULL,
  influence_radius_m INT,
  geom               GEOMETRY(Polygon, 4326) NOT NULL,
  properties         JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poi_influence_geom ON gis.poi_influence USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_poi_influence_city ON gis.poi_influence (city_id);
