/**
 * 生成武汉市区模拟数据（演示用）。
 * POI 约束在武汉市域多边形内（GADM cities.geojson），按行政区聚合活力指标。
 * 用法（在 web 目录）：npm run generate:mock-hubei
 * 或：node scripts/generate-hubei-mock-datasets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..');
const outDir = path.join(webRoot, 'public', 'data', 'mock', 'hubei');
const wuhanCitiesGeojson = path.join(repoRoot, 'data/geospatial/boundaries/hubei-cities/cities.geojson');

/** 武汉市区主要行政区（与 GlobalContextBar 区划选项一致） */
const UNITS = [
  { id: '420102', name: '江岸区', lat: 30.656, lng: 114.308, radiusKm: 7.5, tier: 1 },
  { id: '420103', name: '江汉区', lat: 30.601, lng: 114.27, radiusKm: 6.2, tier: 1 },
  { id: '420104', name: '硚口区', lat: 30.582, lng: 114.214, radiusKm: 7.0, tier: 2 },
  { id: '420105', name: '汉阳区', lat: 30.553, lng: 114.218, radiusKm: 9.0, tier: 2 },
  { id: '420106', name: '武昌区', lat: 30.554, lng: 114.316, radiusKm: 12.0, tier: 1 },
  { id: '420107', name: '青山区', lat: 30.639, lng: 114.385, radiusKm: 8.0, tier: 3 },
  { id: '420111', name: '洪山区', lat: 30.504, lng: 114.4, radiusKm: 11.5, tier: 1 },
  { id: '420112', name: '东西湖区', lat: 30.619, lng: 114.137, radiusKm: 10.0, tier: 3 },
  { id: '420114', name: '蔡甸区', lat: 30.534, lng: 114.029, radiusKm: 10.5, tier: 4 },
  { id: '420115', name: '江夏区', lat: 30.375, lng: 114.321, radiusKm: 14.0, tier: 3 },
];

const WUHAN_CITY_ID = '420100';
const WUHAN_CITY_NAME = '武汉市';

const TIER_LABEL = { 1: '核心城区', 2: '副中心', 3: '一般城区', 4: '远郊拓展' };

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

/** 按行政区层级分配 POI，全市目标约 1000+ */
function poiCountForUnit(unit, rng) {
  const tierBase = { 1: 135, 2: 95, 3: 75, 4: 55 };
  const base = tierBase[unit.tier] ?? 60;
  const jitter = Math.floor(rng() * 17) - 8;
  return Math.max(40, base + jitter);
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
    const bucket = byCity[p.districtId ?? p.cityId];
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

function generatePoiFeatures(rng, wuhanFc, wuhanBBox) {
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
        const shrink = Math.max(0.12, 0.9 - attempt * 0.012);
        const dist = rng() * u.radiusKm * shrink;
        const [lat, lng] = destinationPoint(u.lat, u.lng, bear, dist);
        if (pointInRegion(lng, lat, wuhanFc)) {
          lo = lng;
          la = lat;
          assigned = nearestUnit(lat, lng);
          placed = true;
          break;
        }
      }

      if (!placed) {
        const rp = randomPointInRegion(rng, wuhanFc, wuhanBBox, 120);
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
      const districtShort = assigned.name.replace(/区/g, '');
      const displayName = isAnchorRetail
        ? `${districtShort}${cat.name.slice(0, 2)}商圈${k + 1}`
        : `${districtShort}${cat.name.slice(0, 2)}样点${k + 1}`;

      poiFeatures.push({
        type: 'Feature',
        properties: {
          poiId,
          name: displayName,
          cityId: WUHAN_CITY_ID,
          cityName: WUHAN_CITY_NAME,
          districtId: assigned.id,
          districtName: assigned.name,
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
          cityId: WUHAN_CITY_ID,
          cityName: WUHAN_CITY_NAME,
          districtId: assigned.id,
          districtName: assigned.name,
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

function pointInRegion(lng, lat, fc) {
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

function randomPointInRegion(rng, fc, bbox, maxTry = 160) {
  for (let i = 0; i < maxTry; i++) {
    const lng = bbox.minLng + rng() * (bbox.maxLng - bbox.minLng);
    const lat = bbox.minLat + rng() * (bbox.maxLat - bbox.minLat);
    if (pointInRegion(lng, lat, fc)) return { lng, lat };
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

/** ~750 m 格网（纬度方向约 0.00675°） */
const GRID_CELL_LAT = 0.00675;
const GRID_CELL_LNG = 0.00715;
const GRID_REF_MONTH = '2026-04';

/** 武汉核心商圈/节点热点（高斯叠加，坐标为演示锚点） */
const VITALITY_HOTSPOTS = [
  { name: '江汉路-循礼门', lat: 30.582, lng: 114.285, amp: 22, sigmaKm: 0.62, nightAmp: 9, districtId: '420103' },
  { name: '武广-武展', lat: 30.586, lng: 114.268, amp: 16, sigmaKm: 0.52, nightAmp: 5, districtId: '420103' },
  { name: '楚河汉街', lat: 30.553, lng: 114.332, amp: 18, sigmaKm: 0.58, nightAmp: 8, districtId: '420106' },
  { name: '司门口-黄鹤楼', lat: 30.548, lng: 114.297, amp: 14, sigmaKm: 0.68, nightAmp: 6, districtId: '420106' },
  { name: '街道口-广埠屯', lat: 30.528, lng: 114.352, amp: 15, sigmaKm: 0.72, nightAmp: 5, districtId: '420111' },
  { name: '光谷广场', lat: 30.507, lng: 114.399, amp: 21, sigmaKm: 0.88, nightAmp: 4, districtId: '420111' },
  { name: '武汉东站', lat: 30.488, lng: 114.424, amp: 12, sigmaKm: 0.78, nightAmp: 3, districtId: '420111' },
  { name: '徐东-岳家嘴', lat: 30.592, lng: 114.348, amp: 14, sigmaKm: 0.62, nightAmp: 5, districtId: '420106' },
  { name: '钟家村', lat: 30.549, lng: 114.254, amp: 11, sigmaKm: 0.54, nightAmp: 4, districtId: '420105' },
  { name: '王家湾', lat: 30.561, lng: 114.206, amp: 13, sigmaKm: 0.58, nightAmp: 4, districtId: '420105' },
  { name: '江滩-黎黄陂', lat: 30.592, lng: 114.298, amp: 10, sigmaKm: 0.48, nightAmp: 7, districtId: '420102' },
  { name: '青山滨江', lat: 30.655, lng: 114.392, amp: 8, sigmaKm: 0.82, nightAmp: 2, districtId: '420107' },
];

/** 轨道交通/快速路廊道示意（提升 trafficReach） */
const TRANSIT_CORRIDORS = [
  { weight: 1.0, line: [[114.205, 30.592], [114.285, 30.578], [114.355, 30.548], [114.42, 30.505]] },
  { weight: 0.88, line: [[114.218, 30.633], [114.27, 30.601], [114.316, 30.554], [114.4, 30.504]] },
  { weight: 0.72, line: [[114.137, 30.619], [114.214, 30.582], [114.316, 30.554]] },
  { weight: 0.65, line: [[114.385, 30.639], [114.348, 30.592], [114.316, 30.554]] },
];

const POI_CAT_WEIGHT = Object.fromEntries(POI_CATS.map((c) => [c.key, c.weight]));

function haversineKm(lat1, lng1, lat2, lng2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(a));
}

function distanceToSegmentKm(lat, lng, latA, lngA, latB, lngB) {
  const x = (lng - lngA) * 96 * Math.cos((lat * Math.PI) / 180);
  const y = (lat - latA) * 111;
  const x2 = (lngB - lngA) * 96 * Math.cos((lat * Math.PI) / 180);
  const y2 = (latB - latA) * 111;
  const len2 = x2 * x2 + y2 * y2;
  if (len2 < 1e-8) return Math.hypot(x, y);
  const t = Math.max(0, Math.min(1, (x * x2 + y * y2) / len2));
  return Math.hypot(x - t * x2, y - t * y2);
}

function poiKernelAt(lat, lng, poiFeatures) {
  let sum = 0;
  for (const f of poiFeatures) {
    const [lo, la] = f.geometry.coordinates;
    const d = haversineKm(lat, lng, la, lo);
    const r = (f.properties.influenceRadiusKm ?? 0.4) * 1.15;
    if (d > r * 2.8) continue;
    const imp = f.properties.importance ?? 0.5;
    const cw = POI_CAT_WEIGHT[f.properties.categoryKey] ?? 1;
    sum += imp * cw * Math.exp(-(d * d) / (2 * (r * 0.62) ** 2));
  }
  return sum;
}

function hotspotAt(lat, lng) {
  let poiAmp = 0;
  let nightAmp = 0;
  let label = null;
  let minDist = Infinity;
  for (const h of VITALITY_HOTSPOTS) {
    const d = haversineKm(lat, lng, h.lat, h.lng);
    const g = h.amp * Math.exp(-(d * d) / (2 * h.sigmaKm ** 2));
    if (g > poiAmp) poiAmp = g;
    nightAmp = Math.max(nightAmp, h.nightAmp * Math.exp(-(d * d) / (2 * (h.sigmaKm * 1.1) ** 2)));
    if (d < minDist) {
      minDist = d;
      if (d <= h.sigmaKm * 1.05) label = h.name;
    }
  }
  return { poiAmp, nightAmp, label, minDistKm: minDist };
}

function corridorScoreAt(lat, lng) {
  let best = 0;
  for (const c of TRANSIT_CORRIDORS) {
    const line = c.line;
    for (let i = 0; i < line.length - 1; i++) {
      const [lngA, latA] = line[i];
      const [lngB, latB] = line[i + 1];
      const d = distanceToSegmentKm(lat, lng, latA, lngA, latB, lngB);
      const s = Math.exp(-(d * d) / (2 * 1.8 ** 2)) * 100 * c.weight;
      if (s > best) best = s;
    }
  }
  return best;
}

function flowLevelFromIdx(v) {
  if (v >= 78) return '极高';
  if (v >= 65) return '高';
  if (v >= 52) return '中';
  return '低';
}

function vitalityClassFromIdx(v) {
  if (v >= 82) return 5;
  if (v >= 70) return 4;
  if (v >= 58) return 3;
  if (v >= 46) return 2;
  return 1;
}

function urbanCoreBBox(paddingDeg = 0.018) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const u of UNITS) {
    const latPad = u.radiusKm / 111;
    const lngPad = u.radiusKm / (111 * Math.cos((u.lat * Math.PI) / 180));
    minLat = Math.min(minLat, u.lat - latPad);
    maxLat = Math.max(maxLat, u.lat + latPad);
    minLng = Math.min(minLng, u.lng - lngPad);
    maxLng = Math.max(maxLng, u.lng + lngPad);
  }
  return {
    minLat: minLat - paddingDeg,
    maxLat: maxLat + paddingDeg,
    minLng: minLng - paddingDeg,
    maxLng: maxLng + paddingDeg,
  };
}

function inUrbanUnit(lat, lng) {
  for (const u of UNITS) {
    const d = haversineKm(lat, lng, u.lat, u.lng);
    if (d <= u.radiusKm * 1.05) return true;
  }
  return false;
}

function cellSquarePolygon(lat, lng, halfLat, halfLng) {
  return [
    [
      [lng - halfLng, lat - halfLat],
      [lng + halfLng, lat - halfLat],
      [lng + halfLng, lat + halfLat],
      [lng - halfLng, lat + halfLat],
      [lng - halfLng, lat - halfLat],
    ],
  ];
}

function smoothGridCells(cells, passes = 2) {
  const byKey = new Map(cells.map((c) => [`${c.row},${c.col}`, c]));
  const keys = ['vitalityIdx', 'footTrafficIdx', 'poiActivityIdx', 'trafficReachIdx', 'nightEconomyIdx'];
  for (let p = 0; p < passes; p++) {
    const next = new Map();
    for (const c of cells) {
      const patch = { ...c };
      for (const k of keys) {
        let sum = c[k] * 4;
        let n = 4;
        for (const [dr, dc, w] of [
          [-1, 0, 1],
          [1, 0, 1],
          [0, -1, 1],
          [0, 1, 1],
          [-1, -1, 0.5],
          [-1, 1, 0.5],
          [1, -1, 0.5],
          [1, 1, 0.5],
        ]) {
          const nb = byKey.get(`${c.row + dr},${c.col + dc}`);
          if (nb) {
            sum += nb[k] * w;
            n += w;
          }
        }
        patch[k] = Math.round(sum / n);
      }
      next.set(`${c.row},${c.col}`, patch);
    }
    for (const c of cells) {
      const u = next.get(`${c.row},${c.col}`);
      if (u) Object.assign(c, u);
    }
  }
}

/**
 * 生成 750m 级活力格网：POI 核密度 + 商圈热点 + 交通廊道 + 区级因果链基线，并做空间平滑。
 */
function generateVitalityGrid(wuhanFc, _wuhanBBox, poiFeatures, citySeries, rng) {
  const halfLat = GRID_CELL_LAT / 2;
  const halfLng = GRID_CELL_LNG / 2;
  const gridBBox = urbanCoreBBox();
  const districtById = Object.fromEntries(citySeries.map((c) => [c.id, c]));
  const cells = [];

  for (let row = 0, lat = gridBBox.minLat + halfLat; lat <= gridBBox.maxLat + 1e-9; lat += GRID_CELL_LAT, row++) {
    for (let col = 0, lng = gridBBox.minLng + halfLng; lng <= gridBBox.maxLng + 1e-9; lng += GRID_CELL_LNG, col++) {
      if (!pointInRegion(lng, lat, wuhanFc) || !inUrbanUnit(lat, lng)) continue;

      const unit = nearestUnit(lat, lng);
      const ds = districtById[unit.id];
      if (!ds) continue;
      const base = ds.latest;
      const causal = ds.causal;

      const poiK = poiKernelAt(lat, lng, poiFeatures);
      const hs = hotspotAt(lat, lng);
      const corridor = corridorScoreAt(lat, lng);
      const microNoise = pick(rng, -2.8, 2.8);
      const tierLift = (5 - unit.tier) * 1.8;

      const poiActivityIdx = clampIndex(
        causal.poiBase * 0.22 + poiK * 13.5 + hs.poiAmp * 1.05 + tierLift + microNoise * 0.35,
      );
      const trafficReachIdx = clampIndex(
        base.trafficReachIdx * 0.32 + corridor * 0.48 + causal.accessBase * 0.18 + tierLift * 0.6 + microNoise * 0.2,
      );
      const footTrafficIdx = clampIndex(
        CAUSAL_WEIGHTS.footFromPop * causal.popBase +
          CAUSAL_WEIGHTS.footFromPoi * poiActivityIdx +
          CAUSAL_WEIGHTS.footFromTraffic * trafficReachIdx +
          hs.poiAmp * 0.75 +
          microNoise,
      );
      const activityIdx = clampIndex(
        CAUSAL_WEIGHTS.activityFromFoot * footTrafficIdx +
          CAUSAL_WEIGHTS.activityFromPoi * poiActivityIdx +
          CAUSAL_WEIGHTS.activityFromTraffic * trafficReachIdx +
          hs.poiAmp * 0.15,
      );
      let vitalityIdx = clampIndex(
        CAUSAL_WEIGHTS.vitalityFromActivity * activityIdx +
          CAUSAL_WEIGHTS.vitalityFromPoi * poiActivityIdx +
          CAUSAL_WEIGHTS.vitalityFromTraffic * trafficReachIdx +
          CAUSAL_WEIGHTS.vitalityFromPop * causal.popBase +
          hs.poiAmp * 1.35 +
          tierLift * 0.8,
      );
      const nightEconomyIdx = clampIndex(
        CAUSAL_WEIGHTS.nightFromActivity * activityIdx +
          CAUSAL_WEIGHTS.nightFromPoi * poiActivityIdx +
          hs.nightAmp * 1.05 +
          (unit.tier <= 2 ? 3 : 0),
      );
      const consumePotential = clampIndex(
        CAUSAL_WEIGHTS.consumeFromActivity * activityIdx +
          CAUSAL_WEIGHTS.consumeFromVitality * vitalityIdx +
          CAUSAL_WEIGHTS.consumeFromPoi * poiActivityIdx,
      );
      const inboundFlowIdx = clampIndex(
        CAUSAL_WEIGHTS.inboundFromActivity * activityIdx +
          CAUSAL_WEIGHTS.inboundFromVitality * vitalityIdx +
          (hs.label ? 6 : 0) +
          tierLift * 0.4,
      );

      const districtBaseVit = Math.max(base.vitalityIdx, 1);
      const localRatio = Number((vitalityIdx / districtBaseVit).toFixed(4));
      const poiDensityNorm = Number(Math.min(1, poiK / 10).toFixed(3));

      cells.push({
        row,
        col,
        lat,
        lng,
        gridId: `G-${String(row).padStart(3, '0')}-${String(col).padStart(3, '0')}`,
        districtId: unit.id,
        districtName: unit.name,
        tier: unit.tier,
        tierLabel: TIER_LABEL[unit.tier] ?? '—',
        vitalityIdx,
        footTrafficIdx,
        poiActivityIdx,
        trafficReachIdx,
        nightEconomyIdx,
        consumePotential,
        activityIdx,
        inboundFlowIdx,
        localRatio,
        poiDensityNorm,
        hotspotLabel: hs.label,
        flowLevel: flowLevelFromIdx(footTrafficIdx),
        vitalityClass: vitalityClassFromIdx(vitalityIdx),
        refMonth: GRID_REF_MONTH,
      });
    }
  }

  smoothGridCells(cells, 1);

  for (const c of cells) {
    c.flowLevel = flowLevelFromIdx(c.footTrafficIdx);
    c.vitalityClass = vitalityClassFromIdx(c.vitalityIdx);
    const ds = districtById[c.districtId];
    if (ds) c.localRatio = Number((c.vitalityIdx / Math.max(ds.latest.vitalityIdx, 1)).toFixed(4));
  }

  const vitalityValues = cells.map((c) => c.vitalityIdx).sort((a, b) => a - b);
  const quantile = (q) => vitalityValues[Math.floor((vitalityValues.length - 1) * q)] ?? 0;

  const features = cells.map((c) => ({
    type: 'Feature',
    properties: {
      gridId: c.gridId,
      row: c.row,
      col: c.col,
      districtId: c.districtId,
      districtName: c.districtName,
      tier: c.tier,
      tierLabel: c.tierLabel,
      vitalityIdx: c.vitalityIdx,
      footTrafficIdx: c.footTrafficIdx,
      poiActivityIdx: c.poiActivityIdx,
      trafficReachIdx: c.trafficReachIdx,
      nightEconomyIdx: c.nightEconomyIdx,
      consumePotential: c.consumePotential,
      activityIdx: c.activityIdx,
      inboundFlowIdx: c.inboundFlowIdx,
      localRatio: c.localRatio,
      poiDensityNorm: c.poiDensityNorm,
      hotspotLabel: c.hotspotLabel,
      flowLevel: c.flowLevel,
      vitalityClass: c.vitalityClass,
      refMonth: c.refMonth,
    },
    geometry: {
      type: 'Polygon',
      coordinates: cellSquarePolygon(c.lat, c.lng, halfLat, halfLng),
    },
  }));

  return {
    type: 'FeatureCollection',
    name: 'wuhan-vitality-grid-mock',
    meta: {
      crs: 'EPSG:4326',
      generated: new Date().toISOString(),
      scope: '武汉市区',
      cellSizeM: {
        lat: Math.round(GRID_CELL_LAT * 111000),
        lng: Math.round(GRID_CELL_LNG * 111000 * Math.cos((30.52 * Math.PI) / 180)),
      },
      referenceMonth: GRID_REF_MONTH,
      cellCount: features.length,
      quantiles: {
        p20: quantile(0.2),
        p40: quantile(0.4),
        p60: quantile(0.6),
        p80: quantile(0.8),
      },
      methodology: [
        'POI 核密度（业态权重 × 重要度 × 高斯衰减）',
        '12 个核心商圈/节点热点高斯叠加',
        '轨道交通/快速路廊道可达性',
        '区级因果链基线（与 city-units / timeseries 一致）',
        '3×3 邻域空间平滑',
      ],
      fields: [
        'vitalityIdx 综合活力',
        'footTrafficIdx / poiActivityIdx / trafficReachIdx 分项',
        'localRatio 相对所属区基期活力比（用于时序缩放）',
        'hotspotLabel 热点名称（格心落入主圈时）',
        'vitalityClass 1–5 级',
      ],
      disclaimer: '750m 示意格网，非官方统计格网；与行政区因果链及 POI 样点一致生成。',
    },
    features,
  };
}

function loadWuhanFc() {
  if (!fs.existsSync(wuhanCitiesGeojson)) {
    throw new Error(`缺少武汉市界 GeoJSON: ${wuhanCitiesGeojson}`);
  }
  const fc = JSON.parse(fs.readFileSync(wuhanCitiesGeojson, 'utf8'));
  const features = fc.features.filter((f) => {
    const p = f.properties ?? {};
    const id = String(p.id ?? p.adcode ?? '');
    const name = String(p.name ?? p.NAME ?? p.NL_NAME_2 ?? '');
    return id === WUHAN_CITY_ID || /武汉|Wuhan/i.test(name);
  });
  if (!features.length) {
    throw new Error('在 cities.geojson 中未找到武汉市要素');
  }
  return { type: 'FeatureCollection', features };
}

async function main() {
  const seed = 20260408;
  const rng = mulberry32(seed);

  fs.mkdirSync(outDir, { recursive: true });

  let wuhanFc;
  try {
    wuhanFc = loadWuhanFc();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const wuhanBBox = bboxFromFc(wuhanFc);

  const months = [];
  for (let y = 2024; y <= 2026; y++) {
    const endM = y === 2026 ? 4 : 12;
    const startM = y === 2024 ? 5 : 1;
    for (let m = startM; m <= endM; m++) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }

  const { poiFeatures, influenceFeatures, poiRejected } = generatePoiFeatures(rng, wuhanFc, wuhanBBox);
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
        parentCityId: WUHAN_CITY_ID,
        parentCityName: WUHAN_CITY_NAME,
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
        note: '武汉市区示意边界（球面圆）；活力由区内 POI/交通/人流因果链推导',
      },
      geometry: {
        type: 'Polygon',
        coordinates: circlePolygon(u.lat, u.lng, u.radiusKm),
      },
    };
  });

  const fcUnits = {
    type: 'FeatureCollection',
    name: 'wuhan-district-units-mock',
    meta: {
      crs: 'EPSG:4326',
      generated: new Date().toISOString(),
      seed,
      scope: '武汉市区 10 个行政区',
      fields: [
        'vitalityIdx 综合活力（区际对比）',
        'nightEconomyIdx 夜经济',
        'consumePotential 消费潜力',
        'popDensity 人口密度示意',
        'tier / tierLabel 城区层级（演示）',
      ],
      causalModel:
        'POI集聚→poiActivity→人流footTraffic→activity→活力/夜经济/消费；交通可达→人流与活力；人口基数→人流与人口指数',
      disclaimer: '区面为示意几何；指标由区内 POI 聚合与因果链一致生成，用于区际活力对比。',
    },
    features: cityFeatures,
  };

  const fcPoi = {
    type: 'FeatureCollection',
    name: 'wuhan-poi-sample-mock',
    meta: {
      crs: 'EPSG:4326',
      generated: new Date().toISOString(),
      seed,
      scope: '武汉市区',
      cityBoundary: 'data/geospatial/boundaries/hubei-cities/cities.geojson（武汉市域）',
      categoryKeys: POI_CATS.map((c) => c.key),
      influenceModel:
        '主商圈圆近似：金融/餐饮/生活约 60–380 m，一般零售/办公/文体约 150–650 m，高重要度商场类零售约 600–1200 m',
      disclaimer: 'POI 随机撒点于武汉市区并按最近行政区归属；半径为演示级简化。',
    },
    features: poiFeatures,
  };

  const fcInfluence = {
    type: 'FeatureCollection',
    name: 'wuhan-poi-influence-mock',
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
      region: '武汉市区',
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
      disclaimer: '阶段3因果链模拟；按行政区对比，非官方统计。',
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
      region: '武汉市区（各区平均合成）',
      unit: '合成指数（0–100）',
      seed,
      indicators: ['popIndex', 'econIndex', 'vitalityIndex', 'nightEconomyIndex', 'consumeIndex', 'trafficIndex'],
      causalModel: '全市序列为各行政区因果链结果的算术平均',
      disclaimer: '阶段3：武汉市区序列由各区因果链指数平均得到。',
    },
    monthly: provinceMonthly,
  };

  fs.writeFileSync(path.join(outDir, 'city-units.geojson'), JSON.stringify(fcUnits), 'utf8');
  fs.writeFileSync(path.join(outDir, 'poi-sample.geojson'), JSON.stringify(fcPoi), 'utf8');
  fs.writeFileSync(path.join(outDir, 'poi-influence.geojson'), JSON.stringify(fcInfluence), 'utf8');
  fs.writeFileSync(path.join(outDir, 'timeseries-cities.json'), JSON.stringify(tsCities, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'timeseries-province.json'), JSON.stringify(tsProvince, null, 2), 'utf8');

  const fcGrid = generateVitalityGrid(wuhanFc, wuhanBBox, poiFeatures, citySeries, rng);
  fs.writeFileSync(path.join(outDir, 'vitality-grid.geojson'), JSON.stringify(fcGrid), 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'vitality-grid-meta.json'),
    JSON.stringify(
      {
        ...fcGrid.meta,
        file: 'vitality-grid.geojson',
        pairedWith: ['poi-sample.geojson', 'city-units.geojson', 'timeseries-cities.json'],
      },
      null,
      2,
    ),
    'utf8',
  );

  const wuhanGeoDir = path.join(webRoot, 'public', 'geo', 'wuhan');
  fs.mkdirSync(wuhanGeoDir, { recursive: true });
  fs.writeFileSync(path.join(wuhanGeoDir, 'wuhan-boundary.geojson'), JSON.stringify(wuhanFc), 'utf8');

  const layerCatalog = [
    {
      id: 'wuhan-boundary',
      name: '武汉市区边界',
      dataSource: '基础地理',
      tableName: 'wuhan_boundary',
      geomType: 'Polygon',
      metric: '演示范围',
      ruleText: '仅武汉市区仿真数据覆盖范围',
      unit: '—',
      sortOrder: 5,
    },
    {
      id: 'wuhan-district-units',
      name: '武汉行政区',
      dataSource: '模型',
      tableName: 'city_units',
      geomType: 'Polygon',
      metric: '活力、消费、人口密度',
      ruleText: '0~100 按区设色',
      unit: '指数',
      sortOrder: 10,
    },
    {
      id: 'wuhan-vitality-grid',
      name: '武汉活力评估格网',
      dataSource: '模型',
      tableName: 'vitality_grid',
      geomType: 'Polygon',
      metric: '750m 格网综合活力与分项指数',
      ruleText: 'POI核密度+热点+廊道；localRatio 支持时序缩放',
      unit: '0~100 分',
      sortOrder: 12,
    },
    {
      id: 'uav-routes',
      name: '武汉无人机航线',
      dataSource: '无人机',
      tableName: 'uav_routes',
      geomType: 'LineString',
      metric: '航线、高度、质量、影像',
      ruleText: '质量 >= 70 进入模型候选',
      unit: '米 / m/s',
      sortOrder: 20,
    },
    {
      id: 'zhiyan-flow-heat',
      name: '武汉智眼型热力触发',
      dataSource: '演示',
      tableName: 'zhiyan_observations',
      geomType: 'Point',
      metric: '人流、车流与异常得分',
      ruleText: '70 以上触发低空复核',
      unit: '指数',
      sortOrder: 30,
    },
  ];
  fs.writeFileSync(path.join(outDir, 'layer-catalog.json'), JSON.stringify(layerCatalog, null, 2), 'utf8');

  console.log('已写入', outDir);
  const radii = poiFeatures.map((f) => f.properties.influenceRadiusM).sort((a, b) => a - b);
  const rMin = radii[0];
  const rMax = radii[radii.length - 1];
  const rMed = radii[Math.floor(radii.length / 2)];
  console.log(
    '  features:',
    cityFeatures.length,
    '个行政区面,',
    poiFeatures.length,
    '个 POI 点,',
    influenceFeatures.length,
    '个影响圆,',
    fcGrid.features.length,
    '个活力格网（均在武汉市区界内）',
  );
  console.log(
    `  格网：~${fcGrid.meta.cellSizeM.lat}m 单元，参考月 ${GRID_REF_MONTH}，活力分位 p80=${fcGrid.meta.quantiles.p80}`,
  );
  console.log(`  影响半径(m): min=${rMin} med=${rMed} max=${rMax}`);
  const jianghan = citySeries.find((c) => c.id === '420103');
  const caidian = citySeries.find((c) => c.id === '420114');
  if (jianghan && caidian) {
    console.log(
      `  区际校验：江汉活力 ${jianghan.latest.vitalityIdx} vs 蔡甸 ${caidian.latest.vitalityIdx}（POI结构 ${jianghan.causal.poiBase} vs ${caidian.causal.poiBase}）`,
    );
  }
  if (poiRejected) console.log('  未放置候选:', poiRejected, '（理论上应为 0）');
  console.log('  边界副本 → web/public/geo/wuhan/wuhan-boundary.geojson');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
