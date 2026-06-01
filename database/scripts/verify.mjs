#!/usr/bin/env node
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const client = new pg.Client({
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || 'gis_app',
  password: process.env.POSTGRES_PASSWORD || 'gis_app_dev',
  database: process.env.POSTGRES_DB || 'gis_economy',
});

const checks = [
  ['PostGIS', "SELECT PostGIS_Version() AS v"],
  ['city_units', 'SELECT COUNT(*)::int AS n FROM gis.city_units'],
  ['poi_points', 'SELECT COUNT(*)::int AS n FROM gis.poi_points'],
  ['poi_influence', "SELECT COUNT(*)::int AS n FROM gis.poi_influence"],
  [
    'poi_radius_m',
    'SELECT MIN(influence_radius_m)::int AS min_m, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY influence_radius_m)::int AS med_m, MAX(influence_radius_m)::int AS max_m FROM gis.poi_points',
  ],
  ['timeseries_province', 'SELECT COUNT(*)::int AS n FROM gis.timeseries_province'],
  ['admin_boundaries', 'SELECT COUNT(*)::int AS n FROM gis.admin_boundaries'],
  ['timeseries_cities', 'SELECT COUNT(*)::int AS n FROM gis.timeseries_cities'],
  ['layer_catalog', 'SELECT COUNT(*)::int AS n FROM gis.layer_catalog'],
];
await client.connect();
console.log('Database:', process.env.POSTGRES_DB);
for (const [label, sql] of checks) {
  const { rows } = await client.query(sql);
  console.log(`  ${label}:`, rows[0]);
}
await client.end();
