/**
 * 将 web/public/data/mock/hubei 下的 GeoJSON / JSON 灌入 PostGIS
 * 用法：node database/scripts/seed-from-mock.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const MOCK = path.join(ROOT, 'web/public/data/mock/hubei');

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/gis_urban_economy';

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(MOCK, rel), 'utf8'));
}

function monthToDate(monthStr) {
  return `${monthStr}-01`;
}

function ringToWkt(coords) {
  const pts = coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `(${pts})`;
}

function polygonToWkt(coordinates) {
  const rings = coordinates.map(ringToWkt).join(', ');
  return `POLYGON(${rings})`;
}

function multiPolygonToWkt(geom) {
  if (geom.type === 'Polygon') {
    return `MULTIPOLYGON((${geom.coordinates.map(ringToWkt).join(', ')}))`;
  }
  const polys = geom.coordinates
    .map((poly) => `(${poly.map(ringToWkt).join(', ')})`)
    .join(', ');
  return `MULTIPOLYGON(${polys})`;
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query('SET search_path TO gis, public');

    await client.query('TRUNCATE poi RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE timeseries_cities RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE timeseries_province RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE city_units CASCADE');

    const cityFc = readJson('city-units.geojson');
    for (const f of cityFc.features) {
      const p = f.properties;
      const wkt = multiPolygonToWkt(f.geometry);
      await client.query(
        `INSERT INTO city_units (
          id, name, tier, tier_label, pop_density, poi_per_km2, poi_count_estimate,
          vitality_idx, econ_idx, pop_idx, night_economy_idx, consume_potential,
          traffic_reach_idx, inbound_flow_idx, gdp_proxy_idx, pop_growth_pct,
          manufacturing_share, service_share, structure_note, note, geom
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          ST_Multi(ST_SetSRID(ST_GeomFromText($21), 4326))
        )`,
        [
          p.id,
          p.name,
          p.tier,
          p.tierLabel,
          p.popDensity,
          p.poiPerKm2,
          p.poiCountEstimate,
          p.vitalityIdx,
          p.econIdx,
          p.popIdx,
          p.nightEconomyIdx,
          p.consumePotential,
          p.trafficReachIdx,
          p.inboundFlowIdx,
          p.gdpProxyIdx,
          p.popGrowthPct,
          p.manufacturingShare,
          p.serviceShare,
          p.structureNote,
          p.note,
          wkt,
        ],
      );
    }
    console.log(`city_units: ${cityFc.features.length} rows`);

    const poiFc = readJson('poi-sample.geojson');
    for (const f of poiFc.features) {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      await client.query(
        `INSERT INTO poi (name, city_id, city_name, category, category_key, importance, geom)
         VALUES ($1,$2,$3,$4,$5,$6, ST_SetSRID(ST_MakePoint($7,$8), 4326))`,
        [p.name, p.cityId, p.cityName, p.category, p.categoryKey, p.importance, lng, lat],
      );
    }
    console.log(`poi: ${poiFc.features.length} rows`);

    const tsProv = readJson('timeseries-province.json');
    for (const row of tsProv.monthly) {
      await client.query(
        `INSERT INTO timeseries_province (
          month, pop_index, econ_index, vitality_index,
          night_economy_index, consume_index, traffic_index
        ) VALUES ($1::date,$2,$3,$4,$5,$6,$7)`,
        [
          monthToDate(row.month),
          row.popIndex,
          row.econIndex,
          row.vitalityIndex,
          row.nightEconomyIndex,
          row.consumeIndex,
          row.trafficIndex,
        ],
      );
    }
    console.log(`timeseries_province: ${tsProv.monthly.length} rows`);

    const tsCities = readJson('timeseries-cities.json');
    let cityTsCount = 0;
    for (const city of tsCities.cities) {
      for (const row of city.monthly) {
        await client.query(
          `INSERT INTO timeseries_cities (
            city_id, month, pop_index, econ_index, vitality_index,
            night_economy_index, consume_index, traffic_index, inbound_flow_index
          ) VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9)`,
          [
            city.id,
            monthToDate(row.month),
            row.popIndex,
            row.econIndex,
            row.vitalityIndex,
            row.nightEconomyIdx,
            row.consumeIdx,
            row.trafficReachIdx,
            row.inboundFlowIdx,
          ],
        );
        cityTsCount++;
      }
    }
    console.log(`timeseries_cities: ${cityTsCount} rows`);

    await client.query('COMMIT');
    console.log('Seed completed.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
