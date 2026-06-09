import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'public/data/mock/wuhan');
const geoDir = path.join(root, 'public/geo/wuhan');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(geoDir, { recursive: true });

const wuhanBoundaryCoords = [
  [113.68, 30.18],
  [113.88, 30.08],
  [114.18, 30.03],
  [114.55, 30.12],
  [114.79, 30.3],
  [114.9, 30.62],
  [114.78, 30.92],
  [114.46, 31.08],
  [114.1, 31.05],
  [113.82, 30.9],
  [113.61, 30.62],
  [113.58, 30.36],
  [113.68, 30.18],
];

const units = [
  {
    id: 'wuhan-jianghan',
    name: '江汉路-循礼门商圈',
    tier: 1,
    tierLabel: '核心商圈',
    vitalityIdx: 92,
    nightEconomyIdx: 95,
    consumePotential: 91,
    inboundFlowIdx: 94,
    popDensity: 31500,
    coords: [
      [114.274, 30.59],
      [114.286, 30.585],
      [114.298, 30.592],
      [114.295, 30.607],
      [114.28, 30.611],
      [114.271, 30.602],
      [114.274, 30.59],
    ],
  },
  {
    id: 'wuhan-wuchang-riverside',
    name: '武昌滨江-黄鹤楼片区',
    tier: 1,
    tierLabel: '文旅消费核心',
    vitalityIdx: 88,
    nightEconomyIdx: 86,
    consumePotential: 87,
    inboundFlowIdx: 89,
    popDensity: 24200,
    coords: [
      [114.29, 30.535],
      [114.318, 30.538],
      [114.329, 30.556],
      [114.318, 30.575],
      [114.292, 30.571],
      [114.281, 30.552],
      [114.29, 30.535],
    ],
  },
  {
    id: 'wuhan-hanyang',
    name: '汉阳钟家村-王家湾',
    tier: 2,
    tierLabel: '副中心商圈',
    vitalityIdx: 79,
    nightEconomyIdx: 74,
    consumePotential: 81,
    inboundFlowIdx: 76,
    popDensity: 20500,
    coords: [
      [114.205, 30.535],
      [114.242, 30.526],
      [114.261, 30.548],
      [114.246, 30.576],
      [114.211, 30.575],
      [114.19, 30.555],
      [114.205, 30.535],
    ],
  },
  {
    id: 'wuhan-optics-valley',
    name: '光谷广场-武汉东站',
    tier: 1,
    tierLabel: '产业创新核心',
    vitalityIdx: 90,
    nightEconomyIdx: 82,
    consumePotential: 89,
    inboundFlowIdx: 91,
    popDensity: 28600,
    coords: [
      [114.385, 30.495],
      [114.44, 30.5],
      [114.462, 30.535],
      [114.438, 30.568],
      [114.386, 30.559],
      [114.365, 30.525],
      [114.385, 30.495],
    ],
  },
  {
    id: 'wuhan-xudong',
    name: '徐东-岳家嘴商务圈',
    tier: 2,
    tierLabel: '滨江商务节点',
    vitalityIdx: 82,
    nightEconomyIdx: 78,
    consumePotential: 83,
    inboundFlowIdx: 84,
    popDensity: 22800,
    coords: [
      [114.333, 30.585],
      [114.365, 30.578],
      [114.385, 30.6],
      [114.372, 30.626],
      [114.337, 30.629],
      [114.319, 30.607],
      [114.333, 30.585],
    ],
  },
  {
    id: 'wuhan-qingshan',
    name: '青山滨江-工业更新带',
    tier: 3,
    tierLabel: '产业更新片区',
    vitalityIdx: 72,
    nightEconomyIdx: 65,
    consumePotential: 70,
    inboundFlowIdx: 69,
    popDensity: 17600,
    coords: [
      [114.405, 30.608],
      [114.465, 30.612],
      [114.486, 30.65],
      [114.452, 30.681],
      [114.398, 30.665],
      [114.385, 30.631],
      [114.405, 30.608],
    ],
  },
  {
    id: 'wuhan-nanhu',
    name: '南湖-街道口生活圈',
    tier: 2,
    tierLabel: '高校生活片区',
    vitalityIdx: 80,
    nightEconomyIdx: 77,
    consumePotential: 79,
    inboundFlowIdx: 81,
    popDensity: 26400,
    coords: [
      [114.31, 30.48],
      [114.355, 30.475],
      [114.372, 30.51],
      [114.351, 30.543],
      [114.307, 30.535],
      [114.29, 30.502],
      [114.31, 30.48],
    ],
  },
  {
    id: 'wuhan-airport',
    name: '天河机场-临空枢纽',
    tier: 3,
    tierLabel: '交通枢纽片区',
    vitalityIdx: 68,
    nightEconomyIdx: 56,
    consumePotential: 66,
    inboundFlowIdx: 78,
    popDensity: 9600,
    coords: [
      [114.155, 30.735],
      [114.23, 30.73],
      [114.26, 30.79],
      [114.22, 30.845],
      [114.135, 30.83],
      [114.11, 30.77],
      [114.155, 30.735],
    ],
  },
  {
    id: 'wuhan-jinkou',
    name: '江夏金口-南部港产区',
    tier: 4,
    tierLabel: '南部产业片区',
    vitalityIdx: 61,
    nightEconomyIdx: 48,
    consumePotential: 59,
    inboundFlowIdx: 58,
    popDensity: 7200,
    coords: [
      [114.165, 30.24],
      [114.27, 30.235],
      [114.315, 30.32],
      [114.245, 30.385],
      [114.135, 30.355],
      [114.11, 30.285],
      [114.165, 30.24],
    ],
  },
  {
    id: 'wuhan-caidian',
    name: '蔡甸后官湖-车谷联动区',
    tier: 3,
    tierLabel: '车谷生活片区',
    vitalityIdx: 66,
    nightEconomyIdx: 55,
    consumePotential: 64,
    inboundFlowIdx: 62,
    popDensity: 11800,
    coords: [
      [113.94, 30.45],
      [114.06, 30.43],
      [114.11, 30.52],
      [114.055, 30.61],
      [113.93, 30.6],
      [113.88, 30.52],
      [113.94, 30.45],
    ],
  },
];

const poiTemplates = [
  ['retail', '零售', 0.9],
  ['food', '餐饮', 0.88],
  ['office', '办公', 0.78],
  ['life', '生活服务', 0.7],
  ['culture', '文旅', 0.74],
  ['hotel', '住宿', 0.62],
  ['finance', '金融', 0.58],
];

const districtCenters = [
  ['江汉路', 30.596, 114.292],
  ['循礼门', 30.59, 114.285],
  ['武昌滨江', 30.556, 114.308],
  ['光谷', 30.514, 114.414],
  ['武汉东站', 30.526, 114.425],
  ['徐东', 30.604, 114.356],
  ['王家湾', 30.558, 114.215],
  ['南湖', 30.505, 114.335],
  ['青山滨江', 30.636, 114.436],
  ['天河机场', 30.784, 114.21],
];

function featureCollection(features, extra = {}) {
  return { type: 'FeatureCollection', ...extra, features };
}

function polygonFeature(id, properties, coords) {
  return {
    type: 'Feature',
    id,
    properties,
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

function pointFeature(id, properties, lng, lat) {
  return {
    type: 'Feature',
    id,
    properties,
    geometry: { type: 'Point', coordinates: [Number(lng.toFixed(6)), Number(lat.toFixed(6))] },
  };
}

function circlePolygon(lng, lat, radiusKm, points = 28) {
  const latDeg = radiusKm / 111;
  const lngDeg = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const coords = [];
  for (let i = 0; i <= points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    coords.push([Number((lng + Math.cos(a) * lngDeg).toFixed(6)), Number((lat + Math.sin(a) * latDeg).toFixed(6))]);
  }
  return coords;
}

const boundary = featureCollection(
  [polygonFeature('wuhan-boundary', { name: '武汉市', level: 'city', adcode: '420100' }, wuhanBoundaryCoords)],
  { name: 'wuhan-boundary-schematic', meta: { note: '武汉市演示边界，用于课程项目展示。' } },
);

const cityUnits = featureCollection(
  units.map((unit) => {
    const { coords, ...properties } = unit;
    return polygonFeature(unit.id, properties, coords);
  }),
  { name: 'wuhan-functional-units' },
);

const poiFeatures = [];
for (const [areaIdx, [areaName, lat, lng]] of districtCenters.entries()) {
  for (let i = 0; i < poiTemplates.length; i += 1) {
    const [categoryKey, category, baseImportance] = poiTemplates[i];
    const dx = ((i % 3) - 1) * 0.006 + ((areaIdx % 2) ? 0.002 : -0.002);
    const dy = (Math.floor(i / 3) - 1) * 0.005 + ((areaIdx % 3) - 1) * 0.0015;
    const importance = Number(Math.min(0.98, baseImportance + (areaIdx % 4) * 0.015).toFixed(2));
    const influenceRadiusM = Math.round(160 + importance * 260 + (i % 3) * 35);
    const poiId = `poi-wuhan-${String(areaIdx + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    poiFeatures.push(
      pointFeature(
        poiId,
        {
          poiId,
          name: `${areaName}${category}样点`,
          categoryKey,
          category,
          cityId: '420100',
          cityName: '武汉市',
          districtName: areaName,
          importance,
          influenceRadiusM,
          influenceRadiusKm: Number((influenceRadiusM / 1000).toFixed(3)),
          influenceBasis: '武汉核心区 POI 密度与商圈半径模拟',
        },
        lng + dx,
        lat + dy,
      ),
    );
  }
}

const poiInfluence = featureCollection(
  poiFeatures.map((poi) => {
    const [lng, lat] = poi.geometry.coordinates;
    const p = poi.properties;
    return polygonFeature(
      `${p.poiId}-influence`,
      {
        ...p,
        influenceRing: 'core',
      },
      circlePolygon(lng, lat, p.influenceRadiusKm),
    );
  }),
  { name: 'wuhan-poi-influence' },
);

const monthly = [
  ['2025-11', 63, 66, 64, 60, 62, 65],
  ['2025-12', 68, 70, 69, 72, 67, 69],
  ['2026-01', 72, 73, 74, 78, 71, 70],
  ['2026-02', 65, 66, 67, 62, 64, 66],
  ['2026-03', 77, 79, 80, 82, 78, 81],
  ['2026-04', 83, 86, 85, 88, 84, 87],
  ['2026-05', 86, 88, 87, 90, 86, 89],
  ['2026-06', 88, 90, 89, 92, 88, 91],
].map(([month, popIndex, econIndex, vitalityIndex, nightEconomyIndex, consumeIndex, trafficIndex]) => ({
  month,
  popIndex,
  econIndex,
  vitalityIndex,
  nightEconomyIndex,
  consumeIndex,
  trafficIndex,
}));

const cityTimeseries = {
  units: units.map((u, idx) => ({
    id: u.id,
    name: u.name,
    monthly: monthly.map((m, mi) => ({
      month: m.month,
      vitalityIndex: Math.max(30, Math.min(100, Math.round(u.vitalityIdx * (0.92 + mi * 0.012) + (idx % 3) * 1.5))),
      consumeIndex: Math.max(30, Math.min(100, Math.round(u.consumePotential * (0.93 + mi * 0.01)))),
    })),
  })),
};

const routes = [
  {
    id: 'route-jianghan-night',
    name: '江汉路夜间商圈航拍巡检',
    district: '江汉路-循礼门',
    scene: '夜间经济 / 商圈客流复核',
    status: '已入库',
    time: '2026-04-08 19:30',
    altitude: 120,
    speed: 8,
    res: '5 cm',
    quality: 90,
    zhiyanSync: true,
    model: true,
    overlay: true,
    imageUrl: '/data/uav-images/wuhan-night-aerial.jpg',
    imageTitle: '武汉城市夜景航拍',
    imageCredit: 'Wikimedia Commons',
    imageLicense: 'Commons 许可，项目演示引用',
    imageSource: 'https://commons.wikimedia.org/wiki/File:20231209_Aerial_night_view_of_Wuhan.jpg',
    waypoints: [
      [30.6026, 114.2772],
      [30.6008, 114.2886],
      [30.5964, 114.2995],
      [30.5905, 114.3068],
      [30.5842, 114.3012],
    ],
  },
  {
    id: 'route-optics-valley',
    name: '光谷-武汉东站低空建模航线',
    district: '光谷',
    scene: '三维建模 / 站城融合',
    status: '待复核',
    time: '2026-04-09 15:10',
    altitude: 150,
    speed: 7,
    res: 'LOD2',
    quality: 76,
    zhiyanSync: true,
    model: true,
    overlay: true,
    imageUrl: '/data/uav-images/wuhan-east-station-preview.jpg',
    imageTitle: '武汉东站片区俯瞰航拍',
    imageCredit: 'Wikimedia Commons',
    imageLicense: 'Commons 许可，项目演示引用',
    imageSource: 'https://commons.wikimedia.org/wiki/File:%E6%AD%A6%E6%B1%89%E4%B8%9C%E7%AB%99%E4%B8%9C%E5%B9%BF%E5%9C%BA.png',
    waypoints: [
      [30.5102, 114.4022],
      [30.5164, 114.4188],
      [30.5248, 114.432],
      [30.5345, 114.424],
      [30.529, 114.406],
    ],
  },
  {
    id: 'route-river-crossing',
    name: '两江四岸通勤航拍观测',
    district: '长江大桥-武昌滨江',
    scene: '通勤流 / 江滩客流',
    status: '已入库',
    time: '2026-04-10 08:00',
    altitude: 100,
    speed: 9,
    res: '8 cm',
    quality: 82,
    zhiyanSync: true,
    model: true,
    overlay: true,
    imageUrl: '/data/uav-images/wuhan-yangtze-bridge-preview.jpg',
    imageTitle: '武汉长江大桥俯瞰航拍',
    imageCredit: 'Wikimedia Commons',
    imageLicense: 'Commons 许可，项目演示引用',
    imageSource: 'https://commons.wikimedia.org/wiki/File:%E5%A4%8F%E5%AD%A3%E7%9A%84%E6%AD%A6%E6%B1%89%E9%95%BF%E6%B1%9F%E5%A4%A7%E6%A1%A5.png',
    waypoints: [
      [30.575, 114.255],
      [30.572, 114.279],
      [30.568, 114.305],
      [30.562, 114.332],
      [30.558, 114.36],
    ],
  },
];

function routeToLine(route) {
  return {
    type: 'Feature',
    properties: {
      id: route.id,
      name: route.name,
      district: route.district,
      scene: route.scene,
      status: route.status,
      time: route.time,
      altitude: route.altitude,
      speed: route.speed,
      resolution: route.res,
      quality: route.quality,
      zhiyanSync: route.zhiyanSync,
      participatesModel: route.model,
      overlay: route.overlay,
      imageUrl: route.imageUrl,
      imageTitle: route.imageTitle,
      imageCredit: route.imageCredit,
      imageLicense: route.imageLicense,
      imageSource: route.imageSource,
    },
    geometry: {
      type: 'LineString',
      coordinates: route.waypoints.map(([lat, lng]) => [lng, lat]),
    },
  };
}

function routeCoverage(route) {
  const lats = route.waypoints.map((p) => p[0]);
  const lngs = route.waypoints.map((p) => p[1]);
  const north = Math.max(...lats) + 0.006;
  const south = Math.min(...lats) - 0.006;
  const east = Math.max(...lngs) + 0.008;
  const west = Math.min(...lngs) - 0.008;
  return polygonFeature(
    `${route.id}-coverage`,
    {
      routeId: route.id,
      routeName: route.name,
      district: route.district,
      quality: route.quality,
      source: '武汉无人机航拍模拟覆盖',
    },
    [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
      [west, north],
    ],
  );
}

const zhiyanPoints = [
  ['江汉路晚高峰客流', 114.292, 30.596, 91, 88, true],
  ['光谷站城换乘热力', 114.425, 30.526, 84, 79, true],
  ['长江大桥通勤流', 114.305, 30.568, 78, 82, true],
  ['徐东商务圈午间流', 114.356, 30.604, 72, 65, false],
  ['南湖生活圈夜间流', 114.335, 30.505, 69, 62, false],
  ['天河机场枢纽流', 114.21, 30.784, 76, 71, true],
].map(([name, lng, lat, flowIndex, vehicleIndex, triggerUav], idx) =>
  pointFeature(`zhiyan-wuhan-${idx + 1}`, {
    cityName: '武汉市',
    districtName: String(name).replace(/(晚高峰客流|站城换乘热力|通勤流|午间流|夜间流|枢纽流)/, ''),
    name,
    flowIndex,
    vehicleIndex,
    anomalyScore: Math.round((Number(flowIndex) + Number(vehicleIndex)) / 2),
    triggerUav,
  }, lng, lat),
);

const vitalityModel = {
  id: 'vitality-wuhan-2026q1',
  taskType: 'vitality_assessment',
  status: 'success',
  result: {
    indexMean: 82,
    topZones: units.slice(0, 6).map((u) => ({ name: u.name, score: u.vitalityIdx, uavBoost: u.tier <= 2 ? 0.08 : 0.03 })),
    explanation: '武汉核心商圈、两江四岸与光谷片区活力较高；无人机航拍覆盖用于校核热点范围。',
  },
  params: { scope: 'wuhan', dataSource: 'v2026Q1' },
  createdAt: '2026-04-08T10:00:00.000Z',
  finishedAt: '2026-04-08T10:00:01.000Z',
};

const districtModel = {
  id: 'district-wuhan-2026q1',
  taskType: 'business_district_detection',
  status: 'success',
  districts: [
    { id: '1', name: '江汉路-循礼门商圈', confidence: 0.93, dominantCategories: ['零售', '餐饮', '金融'], flowLevel: '高', vitalityLevel: '核心', uavEvidence: '夜景航拍覆盖' },
    { id: '2', name: '光谷-武汉东站商圈', confidence: 0.9, dominantCategories: ['办公', '餐饮', '生活服务'], flowLevel: '高', vitalityLevel: '核心', uavEvidence: '低空建模航线' },
    { id: '3', name: '武昌滨江文旅商圈', confidence: 0.86, dominantCategories: ['文旅', '餐饮', '住宿'], flowLevel: '中高', vitalityLevel: '次核心', uavEvidence: '两江四岸航拍' },
  ],
  params: { scope: 'wuhan', minPoi: 12, threshold: 8 },
  createdAt: '2026-04-08T10:05:00.000Z',
  finishedAt: '2026-04-08T10:05:01.000Z',
};

const dataSources = [
  {
    id: 'v2026Q1',
    label: '武汉智眼型 v2026Q1（模拟）',
    description: '武汉市范围的城市感知指标体系模拟切片，非政务生产数据。',
    isActive: true,
  },
  {
    id: 'uav-sim-2026q1',
    label: '武汉低空航拍 v2026Q1',
    description: '武汉商圈、两江四岸、光谷等区域的无人机航线与航拍预览。',
    isActive: true,
  },
  {
    id: 'poi-open-mock',
    label: '武汉开放 POI 样例',
    description: '武汉市范围内按零售、餐饮、办公、文旅等业态生成的空间样点。',
    isActive: true,
  },
];

const layerCatalog = [
  { id: 'wuhan-boundary', name: '武汉市边界', dataSource: '基础地理', tableName: 'wuhan_boundary', geomType: 'Polygon', metric: '市域展示范围', ruleText: '仅武汉市范围', unit: '—', sortOrder: 5 },
  { id: 'wuhan-functional-units', name: '武汉功能片区', dataSource: '模型', tableName: 'city_units', geomType: 'Polygon', metric: '活力、消费、人口密度', ruleText: '0~100 分级', unit: '指数', sortOrder: 10 },
  { id: 'uav-routes', name: '武汉无人机航线', dataSource: '无人机', tableName: 'uav_routes', geomType: 'LineString', metric: '航线、高度、质量、影像', ruleText: '质量 >= 70 进入模型候选', unit: '米 / m/s', sortOrder: 20 },
  { id: 'zhiyan-flow-heat', name: '武汉智眼型热力触发', dataSource: '演示', tableName: 'zhiyan_observations', geomType: 'Point', metric: '人流、车流与异常得分', ruleText: '70 以上触发低空复核', unit: '指数', sortOrder: 30 },
];

const apiFixtures = {
  endpoints: {
    'GET /api/v1/wuhan/metadata/data-sources': dataSources,
    'GET /api/v1/wuhan/metadata/layers': layerCatalog,
    'GET /api/v1/wuhan/geo/city-units?ds=v2026Q1': cityUnits,
    'GET /api/v1/wuhan/poi/sample?ds=v2026Q1': featureCollection(poiFeatures, { name: 'wuhan-poi-sample' }),
    'GET /api/v1/wuhan/poi/influence?ds=v2026Q1': poiInfluence,
    'GET /api/v1/wuhan/timeseries/wuhan?ds=v2026Q1': { monthly, meta: { scope: '武汉市', unit: 'index' } },
    'GET /api/v1/wuhan/timeseries/cities?ds=v2026Q1': cityTimeseries,
    'GET /api/v1/wuhan/uav/routes?ds=v2026Q1': featureCollection(routes.map(routeToLine), { name: 'wuhan-uav-routes' }),
    'GET /api/v1/wuhan/uav/coverages?ds=v2026Q1': featureCollection(routes.map(routeCoverage), { name: 'wuhan-uav-coverages' }),
    'GET /api/v1/wuhan/sensing/zhiyan-observations?ds=v2026Q1&date=2026-04-08': featureCollection(zhiyanPoints, { name: 'wuhan-zhiyan-observations' }),
    'GET /api/v1/wuhan/models/vitality/latest': vitalityModel,
    'GET /api/v1/wuhan/models/districts/latest': districtModel,
  },
};

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

writeJson(path.join(geoDir, 'wuhan-boundary.geojson'), boundary);
writeJson(path.join(dataDir, 'city-units.geojson'), cityUnits);
writeJson(path.join(dataDir, 'poi-sample.geojson'), featureCollection(poiFeatures, { name: 'wuhan-poi-sample' }));
writeJson(path.join(dataDir, 'poi-influence.geojson'), poiInfluence);
writeJson(path.join(dataDir, 'timeseries-wuhan.json'), { monthly, meta: { scope: '武汉市', unit: 'index' } });
writeJson(path.join(dataDir, 'timeseries-cities.json'), cityTimeseries);
writeJson(path.join(dataDir, 'uav-routes.json'), { routes });
writeJson(path.join(dataDir, 'uav-routes.geojson'), featureCollection(routes.map(routeToLine), { name: 'wuhan-uav-routes' }));
writeJson(path.join(dataDir, 'uav-coverages.geojson'), featureCollection(routes.map(routeCoverage), { name: 'wuhan-uav-coverages' }));
writeJson(path.join(dataDir, 'zhiyan-observations.geojson'), featureCollection(zhiyanPoints, { name: 'wuhan-zhiyan-observations' }));
writeJson(path.join(dataDir, 'model-vitality-result.json'), vitalityModel);
writeJson(path.join(dataDir, 'model-district-result.json'), districtModel);
writeJson(path.join(dataDir, 'data-sources.json'), dataSources);
writeJson(path.join(dataDir, 'layer-catalog.json'), layerCatalog);
writeJson(path.join(dataDir, 'api-fixtures.json'), apiFixtures);

console.log(`Generated Wuhan mock datasets in ${dataDir}`);
