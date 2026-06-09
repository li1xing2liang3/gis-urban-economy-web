const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cityUnitsPath = path.join(root, 'web/public/data/mock/wuhan/city-units.geojson');
const targets = [path.join(root, 'web/public/data/mock/wuhan'), path.join(root, 'database/mock/backend-sim')];
const fixtureEndpoint = 'GET /api/v1/wuhan/population-consumption/sim?ds=v2026Q1';

const cityUnits = JSON.parse(fs.readFileSync(cityUnitsPath, 'utf8'));

const profiles = {
  'wuhan-jianghan': { type: '核心商圈', popBase: 88, consumeBase: 92, commute: 84, night: 96, family: 76, service: 91 },
  'wuhan-wuchang-riverside': { type: '文旅消费', popBase: 76, consumeBase: 88, commute: 72, night: 86, family: 72, service: 86 },
  'wuhan-hanyang': { type: '生活副中心', popBase: 74, consumeBase: 80, commute: 70, night: 75, family: 86, service: 82 },
  'wuhan-optics-valley': { type: '创新就业', popBase: 84, consumeBase: 89, commute: 94, night: 82, family: 72, service: 88 },
  'wuhan-xudong': { type: '商务办公', popBase: 78, consumeBase: 84, commute: 88, night: 79, family: 74, service: 83 },
  'wuhan-qingshan': { type: '产业更新', popBase: 66, consumeBase: 70, commute: 76, night: 64, family: 70, service: 68 },
  'wuhan-nanhu': { type: '高校生活', popBase: 82, consumeBase: 79, commute: 78, night: 80, family: 84, service: 85 },
  'wuhan-airport': { type: '临空枢纽', popBase: 52, consumeBase: 66, commute: 82, night: 56, family: 48, service: 64 },
  'wuhan-jinkou': { type: '港产片区', popBase: 45, consumeBase: 58, commute: 64, night: 48, family: 56, service: 55 },
  'wuhan-caidian': { type: '车谷生活', popBase: 58, consumeBase: 64, commute: 66, night: 56, family: 76, service: 66 },
};

const months = [
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function centerOf(feature) {
  const ring = feature.geometry.coordinates[0];
  const sum = ring.reduce(
    (acc, [lng, lat]) => {
      acc.lng += lng;
      acc.lat += lat;
      return acc;
    },
    { lng: 0, lat: 0 },
  );
  return {
    lng: Number((sum.lng / ring.length).toFixed(6)),
    lat: Number((sum.lat / ring.length).toFixed(6)),
  };
}

function noise(seed) {
  let h = 0;
  for (const char of seed) h = (h * 33 + char.charCodeAt(0)) % 7919;
  return (h % 9) - 4;
}

function monthlyRows(unitId, profile, baseDensity) {
  return months.map((month, index) => {
    const seasonal = index <= 2 ? -2 : index <= 4 ? 1 : 3;
    const growth = index * 1.15;
    const popIndex = clamp(profile.popBase + growth * 0.7 + seasonal + noise(`${unitId}-${month}-p`) * 0.5);
    const daytimePopulationIndex = clamp(profile.commute + growth * 0.55 + noise(`${unitId}-${month}-d`) * 0.7);
    const nightPopulationIndex = clamp(profile.night + growth * 0.35 + noise(`${unitId}-${month}-n`) * 0.7);
    const consumeIndex = clamp(profile.consumeBase + growth * 0.95 + seasonal + noise(`${unitId}-${month}-c`) * 0.6);
    const familyConsumeIndex = clamp(profile.family + growth * 0.55 + noise(`${unitId}-${month}-f`) * 0.7);
    const serviceDemandIndex = clamp(profile.service + growth * 0.75 + noise(`${unitId}-${month}-s`) * 0.6);
    const density = Math.round(baseDensity * (0.95 + popIndex / 1000 + index * 0.006));
    return {
      month,
      popIndex,
      residentPopulationIndex: popIndex,
      daytimePopulationIndex,
      nightPopulationIndex,
      consumeIndex,
      familyConsumeIndex,
      serviceDemandIndex,
      perCapitaConsumeIndex: clamp(consumeIndex * 0.62 + popIndex * 0.22 + profile.night * 0.16),
      rentPressureIndex: clamp(daytimePopulationIndex * 0.46 + consumeIndex * 0.34 + popIndex * 0.2),
      estimatedPopulation: density,
    };
  });
}

const referenceTemplates = [
  { label: '商业综合体', category: 'retail', categoryLabel: '零售商业', role: '消费集聚', metric: 'consumeBase', base: 0.78, floor: 9, radius: 620 },
  { label: '餐饮夜间街区', category: 'food', categoryLabel: '餐饮夜间消费', role: '夜间消费', metric: 'night', base: 0.74, floor: 4, radius: 460 },
  { label: '写字楼办公群', category: 'office', categoryLabel: '办公楼宇', role: '就业承载', metric: 'commute', base: 0.76, floor: 18, radius: 520 },
  { label: '社区服务中心', category: 'life', categoryLabel: '社区服务', role: '生活服务', metric: 'service', base: 0.7, floor: 5, radius: 420 },
  { label: '轨道交通节点', category: 'transport', categoryLabel: '轨道/交通', role: '客流换乘', metric: 'commute', base: 0.8, floor: 3, radius: 680 },
  { label: '文旅客流点', category: 'culture', categoryLabel: '文旅休闲', role: '文旅消费', metric: 'night', base: 0.68, floor: 6, radius: 500 },
  { label: '教育培训节点', category: 'education', categoryLabel: '教育培训', role: '学习服务', metric: 'family', base: 0.64, floor: 7, radius: 360 },
  { label: '医疗健康服务点', category: 'medical', categoryLabel: '医疗健康', role: '公共服务', metric: 'service', base: 0.66, floor: 8, radius: 400 },
  { label: '高密居住社区', category: 'residential', categoryLabel: '居住社区', role: '居住人口', metric: 'popBase', base: 0.72, floor: 25, radius: 560 },
  { label: '仓配物流节点', category: 'logistics', categoryLabel: '仓配物流', role: '即时配送', metric: 'commute', base: 0.62, floor: 4, radius: 760 },
  { label: '酒店会展节点', category: 'hospitality', categoryLabel: '酒店会展', role: '商务接待', metric: 'consumeBase', base: 0.67, floor: 16, radius: 450 },
  { label: '公园休闲入口', category: 'leisure', categoryLabel: '公园休闲', role: '休闲消费', metric: 'service', base: 0.6, floor: 2, radius: 520 },
];

function polygonAnchors(feature, center) {
  const ring = feature.geometry.coordinates[0].slice(0, -1);
  return referenceTemplates.map((_, index) => {
    const a = ring[index % ring.length] ?? [center.lng, center.lat];
    const b = ring[(index + 1) % ring.length] ?? a;
    const anchor = index % 2 === 0
      ? { lng: a[0], lat: a[1] }
      : { lng: (a[0] + b[0]) / 2, lat: (a[1] + b[1]) / 2 };
    const scale = 0.36 + (index % 4) * 0.07;
    return {
      lng: center.lng + (anchor.lng - center.lng) * scale,
      lat: center.lat + (anchor.lat - center.lat) * scale,
    };
  });
}

function references(unit, center, feature, profile) {
  const anchors = polygonAnchors(feature, center);
  return referenceTemplates.map((template, index) => {
    const anchor = anchors[index];
    const categoryNoise = noise(`${unit.id}-${template.category}`);
    const lng = anchor.lng + categoryNoise * 0.00018 + (index % 3 - 1) * 0.00035;
    const lat = anchor.lat + noise(`${template.category}-${unit.id}`) * 0.00016 + ((index + 1) % 3 - 1) * 0.00032;
    const metricValue = Number(profile[template.metric] ?? profile.service ?? 70);
    const importance = Math.min(0.98, Math.max(0.46, template.base + (metricValue - 70) / 190 + categoryNoise * 0.008));
    const floorBoost = Math.max(0, 5 - Number(unit.tier ?? 3)) * 2;
    const buildingFloor = Math.max(1, template.floor + floorBoost + Math.abs(noise(`${unit.id}-${index}-floor`)) % 5);
    return {
      id: `${unit.id}-ref-${String(index + 1).padStart(2, '0')}`,
      unitId: unit.id,
      name: `${unit.name}${template.label}`,
      category: template.category,
      categoryLabel: template.categoryLabel,
      economicRole: template.role,
      lng: Number(lng.toFixed(6)),
      lat: Number(lat.toFixed(6)),
      importance: Number(importance.toFixed(2)),
      buildingFloor,
      serviceRadiusM: Math.round(template.radius * (0.92 + importance * 0.22)),
      dailyFootfallIndex: clamp(metricValue * 0.48 + profile.popBase * 0.28 + profile.commute * 0.24 + categoryNoise),
      consumerSpendIndex: clamp(profile.consumeBase * 0.52 + metricValue * 0.28 + profile.night * 0.2 + categoryNoise),
      simulated: true,
    };
  });
}

const units = cityUnits.features.map((feature) => {
  const props = feature.properties;
  const profile = profiles[props.id] ?? {
    type: props.tierLabel ?? '武汉片区',
    popBase: props.vitalityIdx ?? 60,
    consumeBase: props.consumePotential ?? 60,
    commute: props.inboundFlowIdx ?? 60,
    night: props.nightEconomyIdx ?? 60,
    family: props.consumePotential ?? 60,
    service: props.vitalityIdx ?? 60,
  };
  const center = centerOf(feature);
  const monthly = monthlyRows(props.id, profile, Number(props.popDensity ?? 10000));
  const latest = monthly.find((row) => row.month === '2026-04') ?? monthly.at(-1);
  return {
    unitId: props.id,
    name: props.name,
    tier: props.tier,
    tierLabel: props.tierLabel,
    profileType: profile.type,
    center,
    baseline: {
      populationDensity: props.popDensity,
      residentPopulationIndex: profile.popBase,
      daytimePopulationIndex: profile.commute,
      nightPopulationIndex: profile.night,
      consumePotentialIndex: profile.consumeBase,
      serviceDemandIndex: profile.service,
    },
    latest,
    monthly,
    references: references({ id: props.id, name: props.name, tier: props.tier }, center, feature, profile),
  };
});

const monthly = months.map((month) => {
  const rows = units.map((unit) => unit.monthly.find((row) => row.month === month));
  const avg = (key) => Math.round(rows.reduce((sum, row) => sum + row[key], 0) / rows.length);
  return {
    month,
    popIndex: avg('popIndex'),
    consumeIndex: avg('consumeIndex'),
    serviceDemandIndex: avg('serviceDemandIndex'),
    daytimePopulationIndex: avg('daytimePopulationIndex'),
    nightPopulationIndex: avg('nightPopulationIndex'),
  };
});

const file = {
  units,
  monthly,
  compareDefaults: {
    a: 'wuhan-jianghan',
    b: 'wuhan-optics-valley',
  },
  meta: {
    scope: '武汉市',
    version: 'population-consumption-sim-2026q1',
    source: '仿真：武汉人口密度、消费潜力与服务需求',
    simulated: true,
    note: '用于课程/项目展示，不代表真实人口普查、运营商、支付、税务或平台订单数据。',
  },
};

function writeJson(dir, name, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

for (const target of targets) {
  writeJson(target, 'population-consumption-sim.json', file);
  const fixturePath = path.join(target, 'api-fixtures.json');
  if (fs.existsSync(fixturePath)) {
    const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    fixtures.endpoints = fixtures.endpoints ?? {};
    fixtures.endpoints[fixtureEndpoint] = file;
    writeJson(target, 'api-fixtures.json', fixtures);
  }
}

const referenceCount = units.reduce((sum, unit) => sum + unit.references.length, 0);
console.log(`Generated population-consumption simulation data for ${units.length} Wuhan units and ${referenceCount} reference POIs.`);
