#!/usr/bin/env node
/**
 * 将 web/public 下 mock 数据与省界 shp 导入 PostGIS
 * 用法：在 database/ 目录 npm install && npm run seed
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import shp from 'shpjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(__dirname, '../.env') });

const cfg = {
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || 'gis_app',
  password: process.env.POSTGRES_PASSWORD || 'gis_app_dev',
  database: process.env.POSTGRES_DB || 'gis_economy',
};

const MOCK = path.join(ROOT, 'web/public/data/mock/hubei');
const HUBEI_SHP = path.join(ROOT, 'data/geospatial/boundaries/hubei-province/湖北省.shp');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function loadProvince(client) {
  const base = HUBEI_SHP.replace(/\.shp$/i, '');
  const shpFile = `${base}.shp`;
  if (!fs.existsSync(shpFile)) {
    console.warn('[skip] 省界 shp 不存在:', shpFile);
    return;
  }
  const fc = await shp({
    shp: fs.readFileSync(`${base}.shp`),
    dbf: fs.readFileSync(`${base}.dbf`),
    prj: fs.existsSync(`${base}.prj`) ? fs.readFileSync(`${base}.prj`) : undefined,
  });
  await client.query('DELETE FROM gis.admin_boundaries WHERE level = $1', ['province']);
  for (const f of fc.features) {
    const name = f.properties?.NAME || f.properties?.name || '湖北省';
    await client.query(
      `INSERT INTO gis.admin_boundaries (code, name, level, geom, properties)
       VALUES ($1, $2, 'province', ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), $4::jsonb)`,
      [f.properties?.adcode || '420000', name, JSON.stringify(f.geometry), JSON.stringify(f.properties || {})],
    );
  }
  console.log('[ok] admin_boundaries (province):', fc.features.length);
}

async function loadCityUnits(client) {
  const fc = readJson(path.join(MOCK, 'city-units.geojson'));
  await client.query('DELETE FROM gis.poi_points');
  await client.query('DELETE FROM gis.timeseries_cities');
  await client.query('DELETE FROM gis.city_units');
  for (const f of fc.features) {
    const p = f.properties;
    await client.query(
      `INSERT INTO gis.city_units (
        id, name, tier, tier_label, pop_density, poi_per_km2, poi_count_estimate,
        vitality_idx, econ_idx, pop_idx, night_economy_idx, consume_potential,
        traffic_reach_idx, inbound_flow_idx, gdp_proxy_idx, pop_growth_pct,
        manufacturing_share, service_share, structure_note, note, geom
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        ST_SetSRID(ST_GeomFromGeoJSON($21), 4326)
      )`,
      [
        p.id, p.name, p.tier, p.tierLabel, p.popDensity, p.poiPerKm2, p.poiCountEstimate,
        p.vitalityIdx, p.econIdx, p.popIdx, p.nightEconomyIdx, p.consumePotential,
        p.trafficReachIdx, p.inboundFlowIdx, p.gdpProxyIdx, p.popGrowthPct,
        p.manufacturingShare, p.serviceShare, p.structureNote, p.note,
        JSON.stringify(f.geometry),
      ],
    );
  }
  console.log('[ok] city_units:', fc.features.length);
}

async function loadPoi(client) {
  const fc = readJson(path.join(MOCK, 'poi-sample.geojson'));
  await client.query('DELETE FROM gis.poi_points');
  for (const f of fc.features) {
    const p = f.properties;
    await client.query(
      `INSERT INTO gis.poi_points (name, city_id, city_name, category, category_key, importance, geom)
       VALUES ($1,$2,$3,$4,$5,$6, ST_SetSRID(ST_GeomFromGeoJSON($7), 4326))`,
      [p.name, p.cityId, p.cityName, p.category, p.categoryKey, p.importance, JSON.stringify(f.geometry)],
    );
  }
  console.log('[ok] poi_points:', fc.features.length);
}

async function loadTimeseriesProvince(client) {
  const data = readJson(path.join(MOCK, 'timeseries-province.json'));
  await client.query('DELETE FROM gis.timeseries_province');
  for (const row of data.monthly) {
    await client.query(
      `INSERT INTO gis.timeseries_province
       (month, pop_index, econ_index, vitality_index, night_economy_index, consume_index, traffic_index)
       VALUES ($1::date, $2,$3,$4,$5,$6,$7)`,
      [
        `${row.month}-01`,
        row.popIndex, row.econIndex, row.vitalityIndex,
        row.nightEconomyIndex, row.consumeIndex, row.trafficIndex,
      ],
    );
  }
  console.log('[ok] timeseries_province:', data.monthly.length);
}

async function loadTimeseriesCities(client) {
  const data = readJson(path.join(MOCK, 'timeseries-cities.json'));
  await client.query('DELETE FROM gis.timeseries_cities');
  let n = 0;
  for (const city of data.cities || []) {
    const cityId = city.id || city.cityId;
    for (const row of city.monthly || []) {
      await client.query(
        `INSERT INTO gis.timeseries_cities
         (city_id, month, pop_index, econ_index, vitality_index, night_economy_index, consume_index, traffic_index)
         VALUES ($1, $2::date, $3,$4,$5,$6,$7,$8)`,
        [
          cityId,
          `${row.month}-01`,
          row.popIndex,
          row.econIndex,
          row.vitalityIndex,
          row.nightEconomyIdx ?? row.nightEconomyIndex,
          row.consumeIdx ?? row.consumeIndex,
          row.trafficReachIdx ?? row.trafficIndex,
        ],
      );
      n += 1;
    }
  }
  console.log('[ok] timeseries_cities rows:', n);
}

async function main() {
  const client = new pg.Client(cfg);
  await client.connect();
  try {
    await client.query('SET search_path TO gis, public');
    console.log('Connected:', cfg.database, '@', cfg.host);
    await loadProvince(client);
    await loadCityUnits(client);
    await loadPoi(client);
    await loadTimeseriesProvince(client);
    await loadTimeseriesCities(client);
    console.log('Seed finished.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
