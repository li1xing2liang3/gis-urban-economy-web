/**
 * 生成湖北省模拟数据（演示用）。
 * POI 必须经过湖北省界多边形校验（与 public/geo/hubei/hubei.* 一致）。
 * 用法（在 web 目录）：npm run generate:mock-hubei
 * 或：node scripts/generate-hubei-mock-datasets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import shp from 'shpjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const outDir = path.join(webRoot, 'public', 'data', 'mock', 'hubei');
const hubeiShapeBase = path.join(webRoot, 'public', 'geo', 'hubei', 'hubei');

const UNITS = [
  { id: '420100', name: '武汉市', lat: 30.5928, lng: 114.3055, radiusKm: 42, tier: 1 },
  { id: '420200', name: '黄石市', lat: 30.2, lng: 115.0389, radiusKm: 22, tier: 3 },
  { id: '420300', name: '十堰市', lat: 32.6294, lng: 110.7989, radiusKm: 33, tier: 3 },
  { id: '420500', name: '宜昌市', lat: 30.6919, lng: 111.2869, radiusKm: 36, tier: 2 },
  { id: '420600', name: '襄阳市', lat: 32.0424, lng: 112.1441, radiusKm: 38, tier: 2 },
  { id: '420700', name: '鄂州市', lat: 30.3919, lng: 114.8949, radiusKm: 16, tier: 4 },
  { id: '420800', name: '荆门市', lat: 31.0354, lng: 112.1993, radiusKm: 28, tier: 3 },
  { id: '420900', name: '孝感市', lat: 30.9246, lng: 113.9169, radiusKm: 30, tier: 3 },
  { id: '421000', name: '荆州市', lat: 30.3325, lng: 112.2381, radiusKm: 34, tier: 3 },
  { id: '421100', name: '黄冈市', lat: 30.4539, lng: 114.8723, radiusKm: 36, tier: 3 },
  { id: '421200', name: '咸宁市', lat: 29.8413, lng: 114.3225, radiusKm: 28, tier: 3 },
  { id: '421300', name: '随州市', lat: 31.6901, lng: 113.3825, radiusKm: 25, tier: 4 },
  { id: '422800', name: '恩施土家族苗族自治州', lat: 30.272, lng: 109.4885, radiusKm: 42, tier: 3 },
  { id: '429004', name: '仙桃市', lat: 30.3625, lng: 113.454, radiusKm: 14, tier: 4 },
  { id: '429005', name: '潜江市', lat: 30.4019, lng: 112.8993, radiusKm: 14, tier: 4 },
  { id: '429006', name: '天门市', lat: 30.6633, lng: 113.1669, radiusKm: 17, tier: 4 },
  { id: '429021', name: '神农架林区', lat: 31.7449, lng: 110.6759, radiusKm: 28, tier: 4 },
];

const TIER_LABEL = { 1: '核心城市', 2: '区域中心', 3: '地级市', 4: '中小城市 / 省直管' };

const POI_CATS = [
  { key: 'retail', name: '零售购物', weight: 1 },
  { key: 'food', name: '餐饮美食', weight: 1.1 },
  { key: 'office', name: '商务办公', weight: 0.85 },
  { key: 'life', name: '生活服务', weight: 0.9 },
  { key: 'culture', name: '文体休闲', weight: 0.75 },
  { key: 'hotel', name: '住宿酒店', weight: 0.65 },
  { key: 'finance', name: '金融网点', weight: 0.55 },
];

const R_EARTH_KM = 6371;

function destinationPoint(lat, lng, bearingDeg, distKm) {
  const δ = distKm / R_EARTH_KM;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * sinδ * cosφ1, cosδ - sinφ1 * Math.sin(φ2));
  return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
}

function circlePolygon(lat, lng, radiusKm, steps = 36) {
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 360;
    const [la, lo] = destinationPoint(lat, lng, bearing, radiusKm);
    ring.push([lo, la]);
  }
  return [ring];
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, min, max) {
  return min + rng() * (max - min);
}

/** GeoJSON [lng,lat] 射线法：点在环内（不含边界数值稳定性处理） */
function pointInRing(lng, lat, ring) {
  let inside = false;
  const n = ring.length;
  if (n < 3) return false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const inter = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-14) + xi;
    if (inter) inside = !inside;
  }
  return inside;
}

function pointInPolygonGeom(lng, lat, geom) {
  if (geom.type === 'Polygon') {
    const coords = geom.coordinates;
    if (!pointInRing(lng, lat, coords[0])) return false;
    for (let h = 1; h < coords.length; h++) {
      if (pointInRing(lng, lat, coords[h])) return false;
    }
    return true;
  }
  if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      const outer = poly[0];
      if (!pointInRing(lng, lat, outer)) continue;
      let inHole = false;
      for (let h = 1; h < poly.length; h++) {
        if (pointInRing(lng, lat, poly[h])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
    return false;
  }
  return false;
}

function pointInProvince(lng, lat, fc) {
  for (const feat of fc.features) {
    if (feat.geometry && pointInPolygonGeom(lng, lat, feat.geometry)) return true;
  }
  return false;
}

function bboxFromFc(fc) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  function consumeRing(ring) {
    for (const pt of ring) {
      minLng = Math.min(minLng, pt[0]);
      maxLng = Math.max(maxLng, pt[0]);
      minLat = Math.min(minLat, pt[1]);
      maxLat = Math.max(maxLat, pt[1]);
    }
  }
  for (const feat of fc.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates) consumeRing(ring);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) {
        for (const ring of poly) consumeRing(ring);
      }
    }
  }
  return { minLng, maxLng, minLat, maxLat };
}

function randomPointInProvince(rng, fc, bbox, maxTry = 160) {
  for (let i = 0; i < maxTry; i++) {
    const lng = bbox.minLng + rng() * (bbox.maxLng - bbox.minLng);
    const lat = bbox.minLat + rng() * (bbox.maxLat - bbox.minLat);
    if (pointInProvince(lng, lat, fc)) return { lng, lat };
  }
  return null;
}

function nearestUnit(lat, lng) {
  let best = UNITS[0];
  let bestD = Infinity;
  for (const u of UNITS) {
    const d = (lat - u.lat) ** 2 + (lng - u.lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

async function loadProvinceFc() {
  const obj = {
    shp: fs.readFileSync(hubeiShapeBase + '.shp'),
    dbf: fs.readFileSync(hubeiShapeBase + '.dbf'),
  };
  if (fs.existsSync(hubeiShapeBase + '.prj')) obj.prj = fs.readFileSync(hubeiShapeBase + '.prj');
  if (fs.existsSync(hubeiShapeBase + '.cpg')) obj.cpg = fs.readFileSync(hubeiShapeBase + '.cpg');
  const parsed = await shp(obj);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

async function main() {
  const seed = 20260408;
  const rng = mulberry32(seed);

  fs.mkdirSync(outDir, { recursive: true });

  let provinceFc;
  try {
    provinceFc = await loadProvinceFc();
  } catch (e) {
    console.error('无法读取省界 shapefile:', hubeiShapeBase, e);
    process.exit(1);
  }
  const provinceBBox = bboxFromFc(provinceFc);

  const months = [];
  for (let y = 2024; y <= 2026; y++) {
    const endM = y === 2026 ? 4 : 12;
    const startM = y === 2024 ? 5 : 1;
    for (let m = startM; m <= endM; m++) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }

  const citySeries = UNITS.map((u, cityIdx) => {
    const tierBoost = (5 - u.tier) * 4;
    const basePop = pick(rng, 42, 94) + tierBoost * 0.35;
    const baseEcon = pick(rng, 48, 96) + tierBoost * 0.4;
    const baseVit = pick(rng, 44, 94) + tierBoost * 0.45;
    const baseNight = pick(rng, 40, 92) + (u.tier <= 2 ? 8 : 0);
    const baseConsume = pick(rng, 45, 95) + (u.tier <= 2 ? 6 : 0);
    const baseTraffic = pick(rng, 46, 94) + tierBoost * 0.25;

    const monthly = months.map((month, idx) => {
      const season = Math.sin(((idx + cityIdx * 2) / 6) * Math.PI) * 5;
      const wave = Math.sin((idx / 8) * Math.PI) * 6;
      const drift = idx * 0.12;
      const cn = new Date(month + '-01').getMonth();
      const holidayBump = cn === 0 || cn === 9 ? 3 : cn >= 4 && cn <= 9 ? 1.5 : 0;

      const popIndex = Math.round(
        Math.min(100, Math.max(32, basePop + wave + season + pick(rng, -5, 5) + drift + holidayBump * 0.3)),
      );
      const econIndex = Math.round(
        Math.min(100, Math.max(35, baseEcon + wave * 0.85 + pick(rng, -5, 6) + drift * 0.95)),
      );
      const vitalityIndex = Math.round(
        Math.min(100, Math.max(34, baseVit + wave * 1.05 + pick(rng, -6, 6) + drift * 0.88)),
      );
      const nightEconomyIdx = Math.round(
        Math.min(100, Math.max(33, baseNight + wave * 0.95 + pick(rng, -5, 7) + drift * 0.8)),
      );
      const consumeIdx = Math.round(
        Math.min(100, Math.max(36, baseConsume + wave * 0.9 + pick(rng, -4, 5) + drift * 0.85)),
      );
      const trafficReachIdx = Math.round(
        Math.min(100, Math.max(38, baseTraffic + wave * 0.75 + pick(rng, -4, 4) + drift * 0.7)),
      );
      const inboundFlowIdx = Math.round(
        Math.min(100, Math.max(30, baseVit * 0.92 + season + pick(rng, -6, 8) + (u.tier <= 2 ? 6 : 0))),
      );

      return {
        month,
        popIndex,
        econIndex,
        vitalityIndex,
        nightEconomyIdx,
        consumeIdx,
        trafficReachIdx,
        inboundFlowIdx,
      };
    });

    const last = monthly[monthly.length - 1];
    const popGrowthPct = Number((pick(rng, -0.4, 2.8) + (5 - u.tier) * 0.15).toFixed(1));
    const manufacturingShare = Number((pick(rng, 18, 42) - (u.tier <= 2 ? 5 : 0)).toFixed(1));
    const serviceShare = Number((Math.min(72, 92 - manufacturingShare - pick(rng, 5, 15))).toFixed(1));

    return {
      id: u.id,
      name: u.name,
      tier: u.tier,
      monthly,
      latest: {
        month: last.month,
        popDensity: Number(pick(rng, 180, 6200).toFixed(1)),
        poiPerKm2: Number(pick(rng, 4, 220).toFixed(2)),
        poiCountEstimate: Math.round(pick(rng, 800, 420000)),
        vitalityIdx: last.vitalityIndex,
        econIdx: last.econIndex,
        popIdx: last.popIndex,
        nightEconomyIdx: last.nightEconomyIdx,
        consumePotential: last.consumeIdx,
        trafficReachIdx: last.trafficReachIdx,
        inboundFlowIdx: last.inboundFlowIdx,
        gdpProxyIdx: Math.round(pick(rng, 52, 98) + (5 - u.tier) * 3),
        popGrowthPct,
        manufacturingShare,
        serviceShare,
        structureNote:
          serviceShare > 58 ? '服务业占比偏高，消费型特征明显' : '二三产并重，制造与配套并存',
      },
    };
  });

  const provinceMonthly = months.map((month) => {
    let p = 0;
    let e = 0;
    let v = 0;
    let n = 0;
    let c = 0;
    let t = 0;
    let nit = 0;
    for (const cs of citySeries) {
      const row = cs.monthly.find((x) => x.month === month);
      if (row) {
        p += row.popIndex;
        e += row.econIndex;
        v += row.vitalityIndex;
        n += row.nightEconomyIdx;
        c += row.consumeIdx;
        t += row.trafficReachIdx;
        nit += 1;
      }
    }
    const d = nit || 1;
    return {
      month,
      popIndex: Math.round(p / d),
      econIndex: Math.round(e / d),
      vitalityIndex: Math.round(v / d),
      nightEconomyIndex: Math.round(n / d),
      consumeIndex: Math.round(c / d),
      trafficIndex: Math.round(t / d),
    };
  });

  const cityFeatures = UNITS.map((u, i) => {
    const s = citySeries[i];
    const pr = s.latest;
    return {
      type: 'Feature',
      properties: {
        id: u.id,
        name: u.name,
        tier: u.tier,
        tierLabel: TIER_LABEL[u.tier] ?? '—',
        popDensity: pr.popDensity,
        poiPerKm2: pr.poiPerKm2,
        poiCountEstimate: pr.poiCountEstimate,
        vitalityIdx: pr.vitalityIdx,
        econIdx: pr.econIdx,
        popIdx: pr.popIdx,
        nightEconomyIdx: pr.nightEconomyIdx,
        consumePotential: pr.consumePotential,
        trafficReachIdx: pr.trafficReachIdx,
        inboundFlowIdx: pr.inboundFlowIdx,
        gdpProxyIdx: pr.gdpProxyIdx,
        popGrowthPct: pr.popGrowthPct,
        manufacturingShare: pr.manufacturingShare,
        serviceShare: pr.serviceShare,
        structureNote: pr.structureNote,
        note: '示意边界（球面圆），指标为模拟合成',
      },
      geometry: {
        type: 'Polygon',
        coordinates: circlePolygon(u.lat, u.lng, u.radiusKm),
      },
    };
  });

  const poiFeatures = [];
  let poiRejected = 0;

  for (let i = 0; i < UNITS.length; i++) {
    const u = UNITS[i];
    const nPoi = 12 + Math.floor(rng() * 11);
    for (let k = 0; k < nPoi; k++) {
      const cat = POI_CATS[Math.floor(rng() * POI_CATS.length)];
      const importance = Number((0.35 + rng() * 0.65).toFixed(2));
      let lo;
      let la;
      let assigned = u;

      let placed = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const bear = rng() * 360;
        const shrink = Math.max(0.1, 0.88 - attempt * 0.013);
        const dist = rng() * u.radiusKm * shrink;
        const [lat, lng] = destinationPoint(u.lat, u.lng, bear, dist);
        if (pointInProvince(lng, lat, provinceFc)) {
          lo = lng;
          la = lat;
          placed = true;
          break;
        }
      }

      if (!placed) {
        const rp = randomPointInProvince(rng, provinceFc, provinceBBox, 100);
        if (rp) {
          lo = rp.lng;
          la = rp.lat;
          assigned = nearestUnit(la, lo);
          placed = true;
        }
      }

      if (!placed) {
        poiRejected++;
        continue;
      }

      poiFeatures.push({
        type: 'Feature',
        properties: {
          name: `${assigned.name.replace(/市|州|林区|土家族苗族自治州/g, '')}${cat.name.slice(0, 2)}样点${k + 1}`,
          cityId: assigned.id,
          cityName: assigned.name,
          category: cat.name,
          categoryKey: cat.key,
          importance,
        },
        geometry: { type: 'Point', coordinates: [lo, la] },
      });
    }
  }

  const fcUnits = {
    type: 'FeatureCollection',
    name: 'hubei-city-units-mock',
    meta: {
      crs: 'EPSG:4326',
      generated: new Date().toISOString(),
      seed,
      fields: [
        'vitalityIdx 综合活力',
        'nightEconomyIdx 夜经济',
        'consumePotential 消费潜力',
        'popDensity 人口密度示意',
        'tier / tierLabel 城市层级（演示）',
      ],
      disclaimer: '湖北省各地单元为示意几何与随机指标，仅供界面演示。',
    },
    features: cityFeatures,
  };

  const fcPoi = {
    type: 'FeatureCollection',
    name: 'hubei-poi-sample-mock',
    meta: {
      crs: 'EPSG:4326',
      generated: new Date().toISOString(),
      seed,
      provinceBoundary: 'web/public/geo/hubei/hubei.shp（POI 已约束在省界内）',
      categoryKeys: POI_CATS.map((c) => c.key),
      disclaimer: 'POI 为随机撒点；坐标已与湖北省界求交过滤。',
    },
    features: poiFeatures,
  };

  const tsCities = {
    meta: {
      region: '湖北省',
      unit: '合成指数（0–100）',
      monthlyRange: { start: months[0], end: months[months.length - 1] },
      seed,
      indicators: [
        'popIndex',
        'econIndex',
        'vitalityIndex',
        'nightEconomyIdx',
        'consumeIdx',
        'trafficReachIdx',
        'inboundFlowIdx',
      ],
      disclaimer: '各地月度指数为模拟合成，非官方统计。',
    },
    cities: citySeries.map((c) => ({
      id: c.id,
      name: c.name,
      tier: c.tier,
      monthly: c.monthly,
    })),
  };

  const tsProvince = {
    meta: {
      region: '湖北省（各地平均合成）',
      unit: '合成指数（0–100）',
      seed,
      indicators: ['popIndex', 'econIndex', 'vitalityIndex', 'nightEconomyIndex', 'consumeIndex', 'trafficIndex'],
      disclaimer: '全省序列由各地模拟指数平均得到，用于趋势图演示。',
    },
    monthly: provinceMonthly,
  };

  fs.writeFileSync(path.join(outDir, 'city-units.geojson'), JSON.stringify(fcUnits), 'utf8');
  fs.writeFileSync(path.join(outDir, 'poi-sample.geojson'), JSON.stringify(fcPoi), 'utf8');
  fs.writeFileSync(path.join(outDir, 'timeseries-cities.json'), JSON.stringify(tsCities, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'timeseries-province.json'), JSON.stringify(tsProvince, null, 2), 'utf8');

  console.log('已写入', outDir);
  console.log('  features:', cityFeatures.length, '市州面,', poiFeatures.length, '个 POI 点（均在湖北省界内）');
  if (poiRejected) console.log('  未放置候选:', poiRejected, '（理论上应为 0）');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
