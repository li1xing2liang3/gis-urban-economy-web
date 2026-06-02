import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const webMockDir = path.join(root, 'web/public/data/mock/hubei');
const outDir = path.join(root, 'database/mock/backend-sim');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(webMockDir, file), 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(outDir, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function hashText(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
}

function centerOfFeature(feature) {
  const coords = feature.geometry.coordinates[0];
  let lng = 0;
  let lat = 0;
  for (const p of coords) {
    lng += p[0];
    lat += p[1];
  }
  return [lng / coords.length, lat / coords.length];
}

function rectangleAround([lng, lat], dx, dy) {
  return [
    [
      [lng - dx, lat - dy],
      [lng + dx, lat - dy],
      [lng + dx, lat + dy],
      [lng - dx, lat + dy],
      [lng - dx, lat - dy],
    ],
  ];
}

function routeToLineString(route) {
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
    },
    geometry: {
      type: 'LineString',
      coordinates: route.waypoints.map(([lat, lng]) => [lng, lat]),
    },
  };
}

function routeCoverage(route) {
  const lngs = route.waypoints.map((p) => p[1]);
  const lats = route.waypoints.map((p) => p[0]);
  const west = Math.min(...lngs) - 0.008;
  const east = Math.max(...lngs) + 0.008;
  const south = Math.min(...lats) - 0.006;
  const north = Math.max(...lats) + 0.006;
  return {
    type: 'Feature',
    properties: {
      id: `${route.id}-coverage`,
      routeId: route.id,
      routeName: route.name,
      quality: route.quality,
      status: route.quality >= 70 ? 'qualified' : 'review_required',
      areaKm2Estimate: Number((((east - west) * 85) * ((north - south) * 111)).toFixed(2)),
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
}

fs.mkdirSync(outDir, { recursive: true });

const cityUnits = readJson('city-units.geojson');
const poiSample = readJson('poi-sample.geojson');
const wuhanTs = readJson('timeseries-wuhan.json');
const cityTs = readJson('timeseries-cities.json');
const uavRoutes = readJson('uav-routes.json').routes;
const cityTsUnits = cityTs.units ?? cityTs.cities ?? [];

const dataSources = [
  {
    id: 'v2026Q1',
    label: '武汉智眼型 v2026Q1（模拟）',
    description: '面向项目演示的武汉城市感知指标体系模拟切片，非政务生产数据。',
    isActive: true,
  },
  {
    id: 'uav-sim-2026q1',
    label: '武汉低空无人机仿真 v2026Q1',
    description: '包含武汉无人机航线、覆盖范围、质检指标和模型参与状态。',
    isActive: true,
  },
  {
    id: 'poi-open-mock',
    label: '武汉开放 POI 样例',
    description: '按零售、餐饮、办公、生活等业态生成的武汉空间样点。',
    isActive: true,
  },
];

const layerCatalog = [
  {
    id: 'zhiyan-flow-heat',
    name: '武汉智眼型人车融合热力',
    dataSource: '智眼',
    tableName: 'zhiyan_observations',
    geomType: 'Point',
    metric: '人流、车流、拥堵、活力合成指数',
    ruleText: '0~100 分级，70 以上触发重点复核',
    unit: '指数',
    sortOrder: 10,
  },
  {
    id: 'uav-routes',
    name: '武汉无人机航线',
    dataSource: '无人机',
    tableName: 'uav_routes',
    geomType: 'LineString',
    metric: '航点、飞行高度、速度、路径质量',
    ruleText: '质量 >= 70 可进入模型候选',
    unit: '米 / m/s',
    sortOrder: 20,
  },
  {
    id: 'uav-coverage',
    name: '武汉无人机覆盖面',
    dataSource: '无人机',
    tableName: 'uav_coverages',
    geomType: 'Polygon',
    metric: '航线外扩形成的影像覆盖范围',
    ruleText: '按覆盖质量与面积估算分级',
    unit: 'km²',
    sortOrder: 21,
  },
  {
    id: 'model-vitality-result',
    name: '经济活力模型结果',
    dataSource: '模型',
    tableName: 'model_vitality_results',
    geomType: 'Polygon',
    metric: '人流、POI、交通、低空观测融合得分',
    ruleText: '0~100 分，按高/中/低风险或活力分级',
    unit: '分',
    sortOrder: 30,
  },
];

const observations = [];
for (const feature of cityUnits.features) {
  const p = feature.properties;
  const [lng, lat] = centerOfFeature(feature);
  const base = hashText(p.id + p.name);
  const hours = [8, 12, 18, 21];
  for (const hour of hours) {
    const commuteBoost = hour === 8 ? 12 : hour === 18 ? 16 : 0;
    const nightBoost = hour === 21 ? Math.round(p.nightEconomyIdx * 0.16) : 0;
    const flowIndex = clamp(Math.round(p.inboundFlowIdx * 0.65 + p.popIdx * 0.25 + commuteBoost + nightBoost), 0, 100);
    const vehicleIndex = clamp(Math.round(p.trafficReachIdx * 0.72 + commuteBoost * 0.8 + (base % 9)), 0, 100);
    const anomalyScore = clamp(Math.round((flowIndex + vehicleIndex + p.vitalityIdx) / 3 + (hour === 21 ? 6 : 0)), 0, 100);
    observations.push({
      id: `obs-${p.id}-${hour}`,
      cityId: p.id,
      cityName: p.name,
      observedAt: `2026-04-08T${String(hour).padStart(2, '0')}:00:00+08:00`,
      source: 'zhiyan-framework-sim',
      flowIndex,
      vehicleIndex,
      congestionIndex: clamp(Math.round(vehicleIndex * 0.8 + (base % 13)), 0, 100),
      vitalityIndex: p.vitalityIdx,
      anomalyScore,
      triggerUav: anomalyScore >= 75,
      geometry: {
        type: 'Point',
        coordinates: [Number(lng.toFixed(6)), Number(lat.toFixed(6))],
      },
    });
  }
}

const observationGeojson = {
  type: 'FeatureCollection',
  name: 'backend-zhiyan-observations-sim',
  meta: {
    crs: 'EPSG:4326',
    generatedAt: new Date().toISOString(),
    disclaimer: '智眼型数据为指标体系仿真，不代表真实政务系统数据。',
  },
  features: observations.map(({ geometry, ...properties }) => ({
    type: 'Feature',
    properties,
    geometry,
  })),
};

const uavRouteGeojson = {
  type: 'FeatureCollection',
  name: 'backend-uav-routes-sim',
  meta: {
    crs: 'EPSG:4326',
    generatedAt: new Date().toISOString(),
    note: 'waypoints in source are [lat,lng], GeoJSON coordinates are [lng,lat].',
  },
  features: uavRoutes.map(routeToLineString),
};

const uavCoverageGeojson = {
  type: 'FeatureCollection',
  name: 'backend-uav-coverages-sim',
  meta: {
    crs: 'EPSG:4326',
    generatedAt: new Date().toISOString(),
  },
  features: uavRoutes.map(routeCoverage),
};

const modelVitalityResults = {
  id: 'vitality-run-20260408-uav',
  taskType: 'vitality_assessment',
  status: 'success',
  params: {
    dataSource: 'v2026Q1',
    time: '2026-04-08',
    weights: {
      flow: 0.35,
      poi: 0.3,
      traffic: 0.25,
      uav: 0.1,
    },
    uavRoutes: uavRoutes.filter((r) => r.model).map((r) => r.id),
  },
  result: {
    indexMean: Math.round(cityUnits.features.reduce((sum, f) => sum + f.properties.vitalityIdx, 0) / cityUnits.features.length),
    topZones: cityUnits.features
      .map((f) => ({
        cityId: f.properties.id,
        name: f.properties.name,
        score: clamp(Math.round(f.properties.vitalityIdx + (f.properties.inboundFlowIdx - 50) * 0.12), 0, 100),
        uavBoost: uavRoutes.some((r) => r.model && r.district && f.properties.name.includes(r.district)) ? 8 : 0,
      }))
      .sort((a, b) => b.score + b.uavBoost - (a.score + a.uavBoost))
      .slice(0, 8),
    explanation: '武汉人流/车流热力作为宏观触发，无人机路径覆盖作为精细尺度校正项。',
  },
  createdAt: '2026-04-08T09:30:00+08:00',
  finishedAt: '2026-04-08T09:30:08+08:00',
};

const districtResults = {
  id: 'district-run-20260408-poi-uav',
  taskType: 'district_clustering',
  status: 'success',
  params: {
    minPoi: 12,
    threshold: 8,
    categories: ['retail', 'food', 'office'],
    uavRouteId: 'route-jianghan-night',
  },
  districts: [
    {
      id: 'bd-jianghan-road',
      name: '江汉路商圈',
      confidence: 0.95,
      dominantCategories: ['零售', '餐饮'],
      flowLevel: '高',
      vitalityLevel: '核心',
      uavEvidence: 'route-jianghan-night',
    },
    {
      id: 'bd-optics-valley',
      name: '光谷商圈',
      confidence: 0.91,
      dominantCategories: ['办公', '餐饮', '生活'],
      flowLevel: '高',
      vitalityLevel: '核心',
      uavEvidence: 'route-optics-valley',
    },
  ],
};

const apiFixtures = {
  endpoints: {
    'GET /api/v1/wuhan/metadata/data-sources': dataSources,
    'GET /api/v1/wuhan/metadata/layers': layerCatalog,
    'GET /api/v1/wuhan/sensing/zhiyan-observations?ds=v2026Q1&date=2026-04-08': observationGeojson,
    'GET /api/v1/wuhan/uav/routes?ds=v2026Q1': uavRouteGeojson,
    'GET /api/v1/wuhan/uav/coverages?ds=v2026Q1': uavCoverageGeojson,
    'GET /api/v1/wuhan/models/vitality/latest': modelVitalityResults,
    'GET /api/v1/wuhan/models/districts/latest': districtResults,
  },
};

const sql = `-- Backend simulation extension tables
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

CREATE INDEX IF NOT EXISTS idx_zhiyan_observations_geom ON gis.zhiyan_observations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_uav_routes_geom ON gis.uav_routes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_uav_coverages_geom ON gis.uav_coverages USING GIST (geom);
`;

writeJson('data-sources.json', dataSources);
writeJson('layer-catalog.json', layerCatalog);
writeJson('zhiyan-observations.geojson', observationGeojson);
writeJson('uav-routes.geojson', uavRouteGeojson);
writeJson('uav-coverages.geojson', uavCoverageGeojson);
writeJson('model-vitality-result.json', modelVitalityResults);
writeJson('model-district-result.json', districtResults);
writeJson('api-fixtures.json', apiFixtures);

fs.writeFileSync(path.join(outDir, 'schema-extension.sql'), sql, 'utf8');

const readme = `# 后端仿真数据包

生成时间：${new Date().toISOString()}

本目录为后端 API、PostGIS 或接口联调准备仿真数据。数据只用于课程/项目展示，不代表真实武汉智眼或无人机生产数据。

## 文件清单

| 文件 | 用途 |
| --- | --- |
| data-sources.json | 数据源元数据 |
| layer-catalog.json | 图层目录元数据 |
| zhiyan-observations.geojson | 智眼型人车流感知点，含 anomalyScore 与 triggerUav |
| uav-routes.geojson | 无人机航线 LineString |
| uav-coverages.geojson | 无人机覆盖面 Polygon |
| model-vitality-result.json | 经济活力模型仿真结果 |
| model-district-result.json | 商圈识别模型仿真结果 |
| api-fixtures.json | 按接口路径组织的响应样例 |
| schema-extension.sql | 后端可选扩展表：智眼观测、无人机航线、覆盖面 |

## 数据规模

- 智眼型观测点：${observationGeojson.features.length}
- 无人机航线：${uavRouteGeojson.features.length}
- 无人机覆盖面：${uavCoverageGeojson.features.length}
- POI 样点来源：${poiSample.features.length}
- 武汉功能片区来源：${cityUnits.features.length}
- 武汉聚合时序月份：${wuhanTs.monthly.length}
- 武汉片区时序数量：${cityTsUnits.length}

## 后端接入建议

1. 先执行 \`database/sql/02_schema.sql\`。
2. 如需无人机与智眼仿真表，执行 \`schema-extension.sql\`。
3. GeoJSON 可直接由后端接口返回，也可通过 GDAL/ogr2ogr 或 PostGIS \`ST_GeomFromGeoJSON\` 入库。
4. 接口可先按 \`api-fixtures.json\` 的路径返回静态响应，前端后续只需替换 \`gisDataService\` 内部 URL。
`;

fs.writeFileSync(path.join(outDir, 'README.md'), readme, 'utf8');

console.log(`Generated backend simulation data in ${outDir}`);
console.log(`zhiyan observations: ${observationGeojson.features.length}`);
console.log(`uav routes: ${uavRouteGeojson.features.length}`);
console.log(`uav coverages: ${uavCoverageGeojson.features.length}`);
