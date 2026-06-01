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

/**
 * 影响半径（米）· 参照零售「主商圈 Primary trade area」步行/驾车可达的简化圆近似
 * 行业常见：便利店/QSR 主商圈约 5–15 分钟车程或 10–15 分钟步行（Geod、RadiusMapper 等零售区位分析资料）；
 * 城市步行约 4–5 km/h → 10 分钟 ≈ 650–850 m；便利店社区级主商圈多小于 500 m。
 * 本演示对单点 POI 取保守的「核心服务半径」，非完整次级/边缘商圈。
 * @see https://www.geod.app/blog/trade-area-analysis
 */
const INFLUENCE_M_BY_CAT = {
  finance: { min: 60, max: 180, label: '网点步行圈' },
  food: { min: 100, max: 280, label: '餐饮社区圈' },
  life: { min: 90, max: 220, label: '生活服务圈' },
  retail: { min: 150, max: 380, anchorMin: 600, anchorMax: 1200, label: '零售社区圈/商场主圈' },
  culture: { min: 180, max: 450, label: '文体休闲圈' },
  office: { min: 200, max: 500, label: '商务办公圈' },
  hotel: { min: 250, max: 650, label: '住宿接待圈' },
};

function influenceRadiusKm(categoryKey, importance, tier) {
  const spec = INFLUENCE_M_BY_CAT[categoryKey] ?? { min: 100, max: 300 };
  let radiusM;
  if (categoryKey === 'retail' && importance >= 0.8 && spec.anchorMax) {
    const t = (importance - 0.8) / 0.2;
    radiusM = spec.anchorMin + (spec.anchorMax - spec.anchorMin) * Math.min(1, Math.max(0, t));
  } else {
    radiusM = spec.min + (spec.max - spec.min) * importance;
  }
  const tierScale = { 1: 1.04, 2: 1.02, 3: 1.0, 4: 0.96 }[tier] ?? 1;
  radiusM = Math.min(radiusM * tierScale, categoryKey === 'retail' && importance >= 0.8 ? 1300 : 550);
  return Number((radiusM / 1000).toFixed(3));
}

/** 按城市层级分配 POI 数量，全省目标约 1000+ */
function poiCountForUnit(unit, rng) {
  const tierBase = { 1: 185, 2: 92, 3: 58, 4: 36 };
  const base = tierBase[unit.tier] ?? 48;
  const jitter = Math.floor(rng() * 21) - 10;
  return Math.max(22, base + jitter);
}

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

function clampIndex(x) {
  return Math.round(Math.min(100, Math.max(28, x)));
}

/** 城市圆面示意面积（km²） */
function unitAreaKm2(unit) {
  return Math.PI * unit.radiusKm * unit.radiusKm;
}

/**
 * 阶段 3：因果链（演示假设，非统计因果识别）
 * 结构层：人口基数、交通可达、POI 空间集聚（由已生成 POI 聚合）
 * 月度层：季节/节假日冲击 → 人流 → 活力/夜经济/消费 → 人口与经济指数
 */
const CAUSAL_WEIGHTS = {
  footFromPop: 0.26,
  footFromPoi: 0.34,
  footFromTraffic: 0.28,
  activityFromFoot: 0.52,
  activityFromPoi: 0.28,
  activityFromTraffic: 0.2,
  vitalityFromActivity: 0.48,
  vitalityFromPoi: 0.22,
  vitalityFromTraffic: 0.18,
  vitalityFromPop: 0.12,
  nightFromActivity: 0.42,
  nightFromPoi: 0.28,
  nightHoliday: 4.2,
  consumeFromActivity: 0.38,
  consumeFromVitality: 0.42,
  consumeFromPoi: 0.2,
  popFromBase: 0.58,
  popFromActivity: 0.32,
  econFromVitality: 0.36,
  econFromConsume: 0.28,
  econFromTraffic: 0.22,
  econFromPop: 0.14,
  inboundFromActivity: 0.48,
  inboundFromVitality: 0.32,
};

function aggregatePoiByCity(poiFeatures) {
  const byCity = Object.fromEntries(
    UNITS.map((u) => [
      u.id,
      { count: 0, importanceSum: 0, influenceAreaKm2: 0, catWeightSum: 0 },
    ]),
  );
  const catW = Object.fromEntries(POI_CATS.map((c) => [c.key, c.weight]));
  for (const f of poiFeatures) {
    const p = f.properties;
    const bucket = byCity[p.cityId];
    if (!bucket) continue;
    bucket.count += 1;
    const imp = p.importance ?? 0.5;
    bucket.importanceSum += imp;
    const r = p.influenceRadiusKm ?? 0.4;
    bucket.influenceAreaKm2 += Math.PI * r * r;
    bucket.catWeightSum += (catW[p.categoryKey] ?? 1) * imp;
  }
  return byCity;
}

function poiStructuralScore(bucket, unit) {
  const area = unitAreaKm2(unit);
  const densityPerKm2 = bucket.count / Math.max(area, 0.01);
  const densityScore = Math.min(100, densityPerKm2 * 95);
  const coverScore = Math.min(100, (bucket.influenceAreaKm2 / Math.max(area, 0.01)) * 12);
  const qualityScore = bucket.count ? (bucket.importanceSum / bucket.count) * 100 : 42;
  const mixScore = bucket.count ? Math.min(100, (bucket.catWeightSum / bucket.count) * 55) : 40;
  return clampIndex(0.38 * densityScore + 0.28 * coverScore + 0.2 * qualityScore + 0.14 * mixScore);
}

function buildCitySeriesCausal(months, poiByCity, rng) {
  return UNITS.map((u, cityIdx) => {
    const tierBoost = (5 - u.tier) * 4;
    const popBase = pick(rng, 48, 82) + tierBoost * 0.55;
    const accessBase = pick(rng, 50, 88) + tierBoost * 0.45;
    const poiBase = poiStructuralScore(poiByCity[u.id], u);
    const bucket = poiByCity[u.id];
    const area = unitAreaKm2(u);

    const popGrowthPct = Number((pick(rng, -0.4, 2.8) + (5 - u.tier) * 0.15).toFixed(1));
    const manufacturingShare = Number((pick(rng, 18, 42) - (u.tier <= 2 ? 5 : 0)).toFixed(1));
    const serviceShare = Number((Math.min(72, 92 - manufacturingShare - pick(rng, 5, 15))).toFixed(1));

    const monthly = months.map((month, idx) => {
      const cn = new Date(month + '-01').getMonth();
      const season = Math.sin(((idx + cityIdx * 2) / 6) * Math.PI) * 5;
      const wave = Math.sin((idx / 8) * Math.PI) * 4;
      const holidayBump = cn === 0 || cn === 9 ? 3.8 : cn >= 4 && cn <= 9 ? 1.6 : 0;
      const shock = pick(rng, -2.5, 2.5);
      const drift = idx * 0.08;

      const trafficReachIdx = clampIndex(
        accessBase + season * 0.45 + wave * 0.35 + shock * 0.6 + drift * 0.5,
      );
      const poiActivityIdx = clampIndex(
        poiBase + season * 0.35 + holidayBump * 0.85 + wave * 0.25 + shock * 0.4,
      );

      const footTrafficIdx = clampIndex(
        CAUSAL_WEIGHTS.footFromPop * popBase +
          CAUSAL_WEIGHTS.footFromPoi * poiActivityIdx +
          CAUSAL_WEIGHTS.footFromTraffic * trafficReachIdx +
          season +
          shock,
      );

      const activityIdx = clampIndex(
        CAUSAL_WEIGHTS.activityFromFoot * footTrafficIdx +
          CAUSAL_WEIGHTS.activityFromPoi * poiActivityIdx +
          CAUSAL_WEIGHTS.activityFromTraffic * trafficReachIdx +
          wave * 0.4,
      );

      const vitalityIndex = clampIndex(
        CAUSAL_WEIGHTS.vitalityFromActivity * activityIdx +
          CAUSAL_WEIGHTS.vitalityFromPoi * poiActivityIdx +
          CAUSAL_WEIGHTS.vitalityFromTraffic * trafficReachIdx +
          CAUSAL_WEIGHTS.vitalityFromPop * popBase +
          shock * 0.35,
      );

      const nightEconomyIdx = clampIndex(
        CAUSAL_WEIGHTS.nightFromActivity * activityIdx +
          CAUSAL_WEIGHTS.nightFromPoi * poiActivityIdx +
          CAUSAL_WEIGHTS.nightHoliday * holidayBump +
          season * 0.55 +
          (cn >= 5 && cn <= 8 ? 1.2 : 0),
      );

      const consumeIdx = clampIndex(
        CAUSAL_WEIGHTS.consumeFromActivity * activityIdx +
          CAUSAL_WEIGHTS.consumeFromVitality * vitalityIndex +
          CAUSAL_WEIGHTS.consumeFromPoi * poiActivityIdx,
      );

      const popIndex = clampIndex(
        CAUSAL_WEIGHTS.popFromBase * popBase + CAUSAL_WEIGHTS.popFromActivity * activityIdx + drift * 0.35,
      );

      const econIndex = clampIndex(
        CAUSAL_WEIGHTS.econFromVitality * vitalityIndex +
          CAUSAL_WEIGHTS.econFromConsume * consumeIdx +
          CAUSAL_WEIGHTS.econFromTraffic * trafficReachIdx +
          CAUSAL_WEIGHTS.econFromPop * popIndex +
          (serviceShare > 55 ? 2 : 0),
      );

      const inboundFlowIdx = clampIndex(
        CAUSAL_WEIGHTS.inboundFromActivity * activityIdx +
          CAUSAL_WEIGHTS.inboundFromVitality * vitalityIndex +
          (u.tier <= 2 ? 5 : u.tier === 3 ? 2 : 0) +
          season * 0.4,
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
        footTrafficIdx,
        poiActivityIdx,
        activityIdx,
      };
    });

    const last = monthly[monthly.length - 1];
    const poiPerKm2 = Number((bucket.count / Math.max(area, 0.01)).toFixed(3));
    const popDensity = Number((180 + popBase * 58 + bucket.count * 2.2).toFixed(1));

    return {
      id: u.id,
      name: u.name,
      tier: u.tier,
      monthly,
      causal: { popBase, accessBase, poiBase },
      latest: {
        month: last.month,
        popDensity,
        poiPerKm2,
        poiCountEstimate: bucket.count,
        poiInfluenceKm2: Number(bucket.influenceAreaKm2.toFixed(2)),
        vitalityIdx: last.vitalityIndex,
        econIdx: last.econIndex,
        popIdx: last.popIndex,
        nightEconomyIdx: last.nightEconomyIdx,
        consumePotential: last.consumeIdx,
        trafficReachIdx: last.trafficReachIdx,
        inboundFlowIdx: last.inboundFlowIdx,
        footTrafficIdx: last.footTrafficIdx,
        poiActivityIdx: last.poiActivityIdx,
        activityIdx: last.activityIdx,
        gdpProxyIdx: clampIndex(last.econIndex * 0.85 + last.vitalityIndex * 0.15),
        popGrowthPct,
        manufacturingShare,
        serviceShare,
        structureNote:
          serviceShare > 58 ? '服务业占比偏高，消费型特征明显' : '二三产并重，制造与配套并存',
      },
    };
  });
}

function generatePoiFeatures(rng, provinceFc, provinceBBox) {
  const poiFeatures = [];
  const influenceFeatures = [];
  let poiRejected = 0;
  let poiSeq = 0;

  for (let i = 0; i < UNITS.length; i++) {
    const u = UNITS[i];
    const nPoi = poiCountForUnit(u, rng);
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

      poiSeq += 1;
      const poiId = `poi-${assigned.id}-${String(poiSeq).padStart(4, '0')}`;
      const radiusKm = influenceRadiusKm(cat.key, importance, assigned.tier);
      const radiusM = Math.round(radiusKm * 1000);
      const infSpec = INFLUENCE_M_BY_CAT[cat.key];
      const isAnchorRetail = cat.key === 'retail' && importance >= 0.8;
      const cityShort = assigned.name.replace(/市|州|林区|土家族苗族自治州/g, '');
      const displayName = isAnchorRetail
        ? `${cityShort}${cat.name.slice(0, 2)}商圈${k + 1}`
        : `${cityShort}${cat.name.slice(0, 2)}样点${k + 1}`;

      poiFeatures.push({
        type: 'Feature',
        properties: {
          poiId,
          name: displayName,
          cityId: assigned.id,
          cityName: assigned.name,
          category: cat.name,
          categoryKey: cat.key,
          importance,
          influenceRadiusKm: radiusKm,
          influenceRadiusM: radiusM,
          influenceType: 'circle',
          influenceRing: isAnchorRetail ? 'primary-anchor' : 'primary',
          influenceBasis: infSpec?.label ?? '主商圈示意',
        },
        geometry: { type: 'Point', coordinates: [lo, la] },
      });

      influenceFeatures.push({
        type: 'Feature',
        properties: {
          poiId,
          name: displayName,
          cityId: assigned.id,
          cityName: assigned.name,
          categoryKey: cat.key,
          importance,
          influenceRadiusKm: radiusKm,
          influenceRadiusM: radiusM,
        },
        geometry: {
          type: 'Polygon',
          coordinates: circlePolygon(la, lo, radiusKm, 32),
        },
      });
    }
  }

  return { poiFeatures, influenceFeatures, poiRejected };
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

  const { poiFeatures, influenceFeatures, poiRejected } = generatePoiFeatures(rng, provinceFc, provinceBBox);
  const poiByCity = aggregatePoiByCity(poiFeatures);
  const citySeries = buildCitySeriesCausal(months, poiByCity, rng);

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
        footTrafficIdx: pr.footTrafficIdx,
        poiActivityIdx: pr.poiActivityIdx,
        activityIdx: pr.activityIdx,
        gdpProxyIdx: pr.gdpProxyIdx,
        popGrowthPct: pr.popGrowthPct,
        manufacturingShare: pr.manufacturingShare,
        serviceShare: pr.serviceShare,
        structureNote: pr.structureNote,
        note: '示意边界（球面圆）；活力等指标由 POI/交通/人流因果链推导（阶段3）',
      },
      geometry: {
        type: 'Polygon',
        coordinates: circlePolygon(u.lat, u.lng, u.radiusKm),
      },
    };
  });

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
      causalModel:
        'POI集聚→poiActivity→人流footTraffic→activity→活力/夜经济/消费；交通可达→人流与活力；人口基数→人流与人口指数',
      disclaimer: '市州面为示意几何；指标由阶段3因果链与 POI 聚合一致生成。',
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
      influenceModel:
        '主商圈圆近似：金融/餐饮/生活约 60–380 m，一般零售/办公/文体约 150–650 m，高重要度商场类零售约 600–1200 m（参考零售 trade area 步行/驾车主圈文献）',
      disclaimer: 'POI 随机撒点 + 主商圈圆；半径为演示级简化，非道路网等时圈。',
    },
    features: poiFeatures,
  };

  const fcInfluence = {
    type: 'FeatureCollection',
    name: 'hubei-poi-influence-mock',
    meta: {
      crs: 'EPSG:4326',
      generated: new Date().toISOString(),
      seed,
      geometryType: 'Polygon（圆近似）',
      pairedWith: 'poi-sample.geojson',
      disclaimer: '与 POI 点一一对应的圆形影响区，半径见 influenceRadiusKm。',
    },
    features: influenceFeatures,
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
        'footTrafficIdx',
        'poiActivityIdx',
        'activityIdx',
      ],
      causalModel:
        '月度序列：交通可达→poiActivity(含POI结构+季节/节假)→人流→activity→活力/夜经济/消费/人口/经济',
      disclaimer: '阶段3因果链模拟；非官方统计。',
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
      causalModel: '全省序列为各地因果链结果的算术平均',
      disclaimer: '阶段3：全省序列由各地因果链指数平均得到。',
    },
    monthly: provinceMonthly,
  };

  fs.writeFileSync(path.join(outDir, 'city-units.geojson'), JSON.stringify(fcUnits), 'utf8');
  fs.writeFileSync(path.join(outDir, 'poi-sample.geojson'), JSON.stringify(fcPoi), 'utf8');
  fs.writeFileSync(path.join(outDir, 'poi-influence.geojson'), JSON.stringify(fcInfluence), 'utf8');
  fs.writeFileSync(path.join(outDir, 'timeseries-cities.json'), JSON.stringify(tsCities, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'timeseries-province.json'), JSON.stringify(tsProvince, null, 2), 'utf8');

  console.log('已写入', outDir);
  const radii = poiFeatures.map((f) => f.properties.influenceRadiusM).sort((a, b) => a - b);
  const rMin = radii[0];
  const rMax = radii[radii.length - 1];
  const rMed = radii[Math.floor(radii.length / 2)];
  console.log(
    '  features:',
    cityFeatures.length,
    '市州面,',
    poiFeatures.length,
    '个 POI 点,',
    influenceFeatures.length,
    '个影响圆（均在湖北省界内）',
  );
  console.log(`  影响半径(m): min=${rMin} med=${rMed} max=${rMax}`);
  const wuhan = citySeries.find((c) => c.id === '420100');
  const enshi = citySeries.find((c) => c.id === '422800');
  if (wuhan && enshi) {
    const w = wuhan.latest.vitalityIdx;
    const e = enshi.latest.vitalityIdx;
    console.log(`  阶段3校验：武汉活力 ${w} vs 恩施 ${e}（POI结构 ${wuhan.causal.poiBase} vs ${enshi.causal.poiBase}）`);
  }
  if (poiRejected) console.log('  未放置候选:', poiRejected, '（理论上应为 0）');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
