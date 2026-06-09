-- Backend simulation extension tables
-- These tables complement database/sql/02_schema.sql for UAV and sensing mock data.

CREATE TABLE IF NOT EXISTS gis.zhiyan_observations (
  id TEXT PRIMARY KEY,
  city_id TEXT,
  city_name TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  flow_index SMALLINT,
  vehicle_index SMALLINT,
  congestion_index SMALLINT,
  vitality_index SMALLINT,
  anomaly_score SMALLINT,
  trigger_uav BOOLEAN NOT NULL DEFAULT FALSE,
  geom GEOMETRY(Point, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS gis.uav_routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT,
  scene TEXT,
  status TEXT,
  captured_at TIMESTAMPTZ,
  altitude_m DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  resolution TEXT,
  quality SMALLINT,
  zhiyan_sync BOOLEAN NOT NULL DEFAULT FALSE,
  participates_model BOOLEAN NOT NULL DEFAULT FALSE,
  geom GEOMETRY(LineString, 4326) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS gis.uav_coverages (
  id TEXT PRIMARY KEY,
  route_id TEXT REFERENCES gis.uav_routes(id) ON DELETE CASCADE,
  route_name TEXT,
  quality SMALLINT,
  status TEXT,
  area_km2_estimate DOUBLE PRECISION,
  geom GEOMETRY(Polygon, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS gis.low_altitude_risk_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT,
  risk_level TEXT,
  risk_score SMALLINT,
  risk_type TEXT,
  altitude_limit_m DOUBLE PRECISION,
  active_hours TEXT,
  rule_text TEXT,
  source TEXT,
  geom GEOMETRY(Polygon, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS gis.uav_takeoff_sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT,
  site_type TEXT,
  daily_capacity INTEGER,
  readiness_score SMALLINT,
  charging BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT,
  scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  geom GEOMETRY(Point, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS gis.uav_task_records (
  task_id TEXT PRIMARY KEY,
  route_id TEXT REFERENCES gis.uav_routes(id) ON DELETE SET NULL,
  route_name TEXT,
  task_type TEXT,
  district TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT,
  drone_id TEXT,
  takeoff_site_id TEXT REFERENCES gis.uav_takeoff_sites(id) ON DELETE SET NULL,
  image_count INTEGER,
  video_minutes DOUBLE PRECISION,
  coverage_km2 DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  avg_altitude_m DOUBLE PRECISION,
  avg_speed_mps DOUBLE PRECISION,
  battery_used_pct SMALLINT,
  risk_events INTEGER,
  quality_score SMALLINT,
  output_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS gis.uav_telemetry_samples (
  id BIGSERIAL PRIMARY KEY,
  route_id TEXT REFERENCES gis.uav_routes(id) ON DELETE CASCADE,
  drone_id TEXT,
  sampled_at TIMESTAMPTZ,
  altitude_m DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  battery_pct SMALLINT,
  signal_pct SMALLINT,
  heading_deg DOUBLE PRECISION,
  risk_score SMALLINT,
  geom GEOMETRY(Point, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS gis.building_white_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT,
  usage TEXT,
  height_m DOUBLE PRECISION,
  floors INTEGER,
  confidence DOUBLE PRECISION,
  source TEXT,
  geom GEOMETRY(Polygon, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS gis.dem_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_dir TEXT,
  crs TEXT,
  hillshade_asset TEXT,
  dem_preview_asset TEXT,
  sample_elevation_min_m DOUBLE PRECISION,
  sample_elevation_max_m DOUBLE PRECISION,
  sample_elevation_avg_m DOUBLE PRECISION,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS gis.uav_route_terrain_profiles (
  id BIGSERIAL PRIMARY KEY,
  route_id TEXT REFERENCES gis.uav_routes(id) ON DELETE CASCADE,
  route_name TEXT,
  progress DOUBLE PRECISION,
  ground_elevation_m DOUBLE PRECISION,
  flight_altitude_m DOUBLE PRECISION,
  clearance_m DOUBLE PRECISION,
  geom GEOMETRY(Point, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zhiyan_observations_geom ON gis.zhiyan_observations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_uav_routes_geom ON gis.uav_routes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_uav_coverages_geom ON gis.uav_coverages USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_low_altitude_risk_zones_geom ON gis.low_altitude_risk_zones USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_uav_takeoff_sites_geom ON gis.uav_takeoff_sites USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_uav_telemetry_samples_geom ON gis.uav_telemetry_samples USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_building_white_models_geom ON gis.building_white_models USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_uav_route_terrain_profiles_geom ON gis.uav_route_terrain_profiles USING GIST (geom);
