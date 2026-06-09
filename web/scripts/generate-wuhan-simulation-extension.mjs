import fs from 'node:fs';
import path from 'node:path';

const webRoot = process.cwd();
const repoRoot = path.resolve(webRoot, '..');
const publicMockDir = path.join(webRoot, 'public/data/mock/wuhan');
const backendMockDir = path.join(repoRoot, 'database/mock/backend-sim');
const sourceSimDir = path.join(repoRoot, 'data/sim/wuhan');

for (const dir of [publicMockDir, backendMockDir, sourceSimDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function featureCollection(features, extra = {}) {
  return { type: 'FeatureCollection', ...extra, features };
}

function pointFeature(id, properties, lng, lat) {
  return {
    type: 'Feature',
    id,
    properties,
    geometry: { type: 'Point', coordinates: [round(lng), round(lat)] },
  };
}

function polygonFeature(id, properties, coords) {
  return {
    type: 'Feature',
    id,
    properties,
    geometry: { type: 'Polygon', coordinates: [coords.map(([lng, lat]) => [round(lng), round(lat)])] },
  };
}

function circlePolygon(lng, lat, radiusKm, points = 40) {
  const latDeg = radiusKm / 111;
  const lngDeg = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const coords = [];
  for (let i = 0; i <= points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    coords.push([round(lng + Math.cos(a) * lngDeg), round(lat + Math.sin(a) * latDeg)]);
  }
  return coords;
}

function rectangleAround(lng, lat, widthKm, heightKm) {
  const halfLat = heightKm / 2 / 111;
  const halfLng = widthKm / 2 / (111 * Math.cos((lat * Math.PI) / 180));
  return [
    [lng - halfLng, lat + halfLat],
    [lng + halfLng, lat + halfLat],
    [lng + halfLng, lat - halfLat],
    [lng - halfLng, lat - halfLat],
    [lng - halfLng, lat + halfLat],
  ];
}

function lineDistanceKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const x = (lng2 - lng1) * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180) * 111;
    const y = (lat2 - lat1) * 111;
    total += Math.sqrt(x * x + y * y);
  }
  return total;
}

function interpolateLine(coords, t) {
  const segments = [];
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const dist = lineDistanceKm([coords[i - 1], coords[i]]);
    segments.push({ from: coords[i - 1], to: coords[i], dist });
    total += dist;
  }
  const target = total * t;
  let walked = 0;
  for (const segment of segments) {
    if (walked + segment.dist >= target) {
      const localT = segment.dist === 0 ? 0 : (target - walked) / segment.dist;
      return [
        round(segment.from[0] + (segment.to[0] - segment.from[0]) * localT),
        round(segment.from[1] + (segment.to[1] - segment.from[1]) * localT),
      ];
    }
    walked += segment.dist;
  }
  return coords.at(-1);
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const routesFile = path.join(publicMockDir, 'uav-routes.geojson');
const routes = readJson(routesFile).features.map((feature) => ({
  id: feature.properties.id,
  name: feature.properties.name,
  district: feature.properties.district,
  scene: feature.properties.scene,
  altitude: feature.properties.altitude,
  speed: feature.properties.speed,
  quality: feature.properties.quality,
  coords: feature.geometry.coordinates,
}));

const lowAltitudeRiskZones = featureCollection(
  [
    polygonFeature(
      'risk-zone-jianghan-crowd',
      {
        name: '江汉路步行街人群密集风险区',
        district: '江汉区',
        riskLevel: 'high',
        riskScore: 88,
        riskType: 'crowd_density',
        altitudeLimitM: 90,
        ruleText: '夜间客流高峰时段建议绕飞或升高至限高内安全高度',
        activeHours: '18:00-23:00',
        source: '仿真：智眼客流 + 低空运行规则',
      },
      rectangleAround(114.292, 30.596, 2.1, 1.45),
    ),
    polygonFeature(
      'risk-zone-river-bridge',
      {
        name: '武汉长江大桥跨江风场关注区',
        district: '武昌区/汉阳区',
        riskLevel: 'medium',
        riskScore: 71,
        riskType: 'cross_river_wind',
        altitudeLimitM: 120,
        ruleText: '跨江段需结合风速与桥梁净空进行动态校核',
        activeHours: '全天',
        source: '仿真：桥梁通勤 + DEM/水域环境',
      },
      rectangleAround(114.292, 30.555, 6.4, 2.2),
    ),
    polygonFeature(
      'risk-zone-optics-rail',
      {
        name: '武汉东站站城融合限高协调区',
        district: '东湖高新区',
        riskLevel: 'medium',
        riskScore: 76,
        riskType: 'rail_hub_clearance',
        altitudeLimitM: 110,
        ruleText: '靠近铁路枢纽时优先走规划航廊并降低悬停时间',
        activeHours: '06:30-22:30',
        source: '仿真：站城客流 + 低空巡检',
      },
      rectangleAround(114.425, 30.526, 3.8, 2.5),
    ),
    polygonFeature(
      'risk-zone-tianhe-approach',
      {
        name: '天河机场净空保护模拟区',
        district: '黄陂区',
        riskLevel: 'restricted',
        riskScore: 96,
        riskType: 'airport_clearance',
        altitudeLimitM: 0,
        ruleText: '演示系统中作为禁飞/审批区处理',
        activeHours: '全天',
        source: '仿真：机场净空保护',
      },
      circlePolygon(114.21, 30.784, 4.8),
    ),
    polygonFeature(
      'risk-zone-qingshan-industrial',
      {
        name: '青山工业更新带巡检关注区',
        district: '青山区',
        riskLevel: 'medium',
        riskScore: 68,
        riskType: 'industrial_facility',
        altitudeLimitM: 130,
        ruleText: '工业设施上空需按巡检白名单航线运行',
        activeHours: '08:00-20:00',
        source: '仿真：产业设施 + 巡检需求',
      },
      rectangleAround(114.436, 30.636, 5.2, 2.4),
    ),
  ],
  {
    name: 'wuhan-low-altitude-risk-zones',
    meta: {
      scope: '武汉市',
      version: 'uav-sim-2026q1',
      note: '课程展示用仿真低空风险数据，非真实空域管制数据。',
    },
  },
);

const takeoffSites = featureCollection(
  [
    ['takeoff-jianghan-roof', '江汉路屋顶微型起降点', '江汉区', 114.2892, 30.5965, 'rooftop', 12, 86, ['巡检', '夜间经济复核']],
    ['takeoff-wuchang-riverfront', '武昌江滩应急起降点', '武昌区', 114.3095, 30.5568, 'riverside_pad', 18, 82, ['江滩巡航', '应急保障']],
    ['takeoff-optics-hub', '光谷站城低空服务点', '东湖高新区', 114.4218, 30.5227, 'service_hub', 20, 88, ['三维建模', '物流试飞']],
    ['takeoff-qingshan-industrial', '青山工业巡检起降点', '青山区', 114.4315, 30.6368, 'industrial_pad', 16, 79, ['设施巡检', '安全巡查']],
    ['takeoff-hanyang-park', '汉阳滨江临时起降点', '汉阳区', 114.252, 30.551, 'temporary_pad', 8, 73, ['文旅巡检', '跨江联动']],
  ].map(([id, name, district, lng, lat, siteType, dailyCapacity, readinessScore, scenes]) =>
    pointFeature(id, {
      name,
      district,
      siteType,
      dailyCapacity,
      readinessScore,
      scenes,
      charging: readinessScore >= 80,
      status: readinessScore >= 80 ? '可用' : '待复核',
      source: '仿真：低空起降服务网络',
    }, lng, lat),
  ),
  {
    name: 'wuhan-uav-takeoff-sites',
    meta: { scope: '武汉市', version: 'uav-sim-2026q1' },
  },
);

const routeById = Object.fromEntries(routes.map((route) => [route.id, route]));

const taskTakeoffByDrone = Object.fromEntries(
  [
    ['WH-UAV-M30T-006', 'takeoff-jianghan-roof'],
    ['WH-UAV-P4RTK-011', 'takeoff-optics-hub'],
    ['WH-UAV-M3E-018', 'takeoff-wuchang-riverfront'],
    ['WH-UAV-M3E-019', 'takeoff-jianghan-roof'],
  ],
);

function fleetDrone({
  droneId,
  droneName,
  routeId,
  startOffsetSec,
  altitudeLayerM,
  color,
  status = 'idle',
  batteryPct,
  takeoffSiteId,
}) {
  const route = routeById[routeId];
  return {
    droneId,
    droneName,
    routeId,
    routeName: route?.name ?? routeId,
    district: route?.district ?? '武汉市',
    takeoffSiteId: takeoffSiteId ?? taskTakeoffByDrone[droneId] ?? 'takeoff-jianghan-roof',
    startOffsetSec,
    altitudeLayerM,
    color,
    status,
    batteryPct,
  };
}

const fleetDispatchPlan = {
  meta: {
    scope: '武汉市',
    version: 'uav-fleet-sim-2026q1',
    generatedAt: new Date().toISOString(),
    source: '仿真：多无人机协同调度方案',
    note: '编队调度演示数据，关联 uav-routes / uav-task-records / uav-takeoff-sites，非真实空域批复数据。',
  },
  scenarios: [
    {
      id: 'scenario-jianghan-optics-dual',
      name: '江汉—光谷双机错峰巡检',
      summary: '一机覆盖江汉路夜间商圈，一机同步光谷建模航段；通过起飞时序与高度层分离避免航廊冲突。',
      district: '江汉区 / 东湖高新区',
      strategy: '时间错峰 + 高度分层',
      droneCount: 2,
      durationSec: 108,
      routeIds: ['route-jianghan-night', 'route-optics-valley'],
      drones: [
        fleetDrone({
          droneId: 'WH-UAV-M30T-006',
          droneName: 'M30T · 江汉巡检',
          routeId: 'route-jianghan-night',
          startOffsetSec: 0,
          altitudeLayerM: 120,
          color: '#38bdf8',
          status: 'queued',
          batteryPct: 92,
        }),
        fleetDrone({
          droneId: 'WH-UAV-P4RTK-011',
          droneName: 'P4RTK · 光谷建模',
          routeId: 'route-optics-valley',
          startOffsetSec: 18,
          altitudeLayerM: 150,
          color: '#fbbf24',
          batteryPct: 88,
        }),
      ],
      schedule: [
        { id: 'ev-1', droneId: 'WH-UAV-M30T-006', label: '江汉起飞', startSec: 0, durationSec: 12, kind: 'takeoff' },
        { id: 'ev-2', droneId: 'WH-UAV-M30T-006', label: '商圈巡航', startSec: 12, durationSec: 48, kind: 'cruise' },
        { id: 'ev-3', droneId: 'WH-UAV-P4RTK-011', label: '光谷起飞', startSec: 18, durationSec: 14, kind: 'takeoff' },
        { id: 'ev-4', droneId: 'WH-UAV-P4RTK-011', label: '建模航段', startSec: 32, durationSec: 56, kind: 'cruise' },
        { id: 'ev-5', droneId: 'WH-UAV-M30T-006', label: '返航降落', startSec: 60, durationSec: 18, kind: 'landing' },
        { id: 'ev-6', droneId: 'WH-UAV-P4RTK-011', label: '返航降落', startSec: 88, durationSec: 20, kind: 'landing' },
      ],
      rules: [
        { id: 'r-alt', label: '垂直间隔 ≥ 30m', description: '同空域交叉段保持 120m / 150m 高度层', enabled: true },
        { id: 'r-time', label: '起飞错峰 18s', description: '第二架延迟起飞，避免同一起降点拥堵', enabled: true },
        { id: 'r-corridor', label: '航廊互斥', description: '跨江段与光谷东向段不同时占用低空空域', enabled: true },
      ],
      metrics: { coverageKm2: 6.2, conflictResolved: 2, avgSeparationM: 420 },
    },
    {
      id: 'scenario-river-triple',
      name: '两江四岸三机协同观测',
      summary: '三机沿江分布执行通勤流、江滩客流与桥梁风险提示，中间机承担空域协调与临时悬停。',
      district: '两江四岸',
      strategy: '分区负责 + 中心协调',
      droneCount: 3,
      durationSec: 132,
      routeIds: ['route-river-crossing', 'route-jianghan-night', 'route-optics-valley'],
      drones: [
        fleetDrone({
          droneId: 'WH-UAV-M3E-018',
          droneName: 'M3E · 江北观测',
          routeId: 'route-river-crossing',
          startOffsetSec: 0,
          altitudeLayerM: 100,
          color: '#34d399',
          status: 'queued',
          batteryPct: 95,
        }),
        fleetDrone({
          droneId: 'WH-UAV-M30T-006',
          droneName: 'M30T · 协调中继',
          routeId: 'route-jianghan-night',
          startOffsetSec: 8,
          altitudeLayerM: 130,
          color: '#a78bfa',
          batteryPct: 90,
        }),
        fleetDrone({
          droneId: 'WH-UAV-P4RTK-011',
          droneName: 'P4RTK · 江南补采',
          routeId: 'route-optics-valley',
          startOffsetSec: 24,
          altitudeLayerM: 110,
          color: '#fb7185',
          batteryPct: 86,
        }),
      ],
      schedule: [
        { id: 'ev-r1', droneId: 'WH-UAV-M3E-018', label: '江北起飞', startSec: 0, durationSec: 10, kind: 'takeoff' },
        { id: 'ev-r2', droneId: 'WH-UAV-M3E-018', label: '跨江巡航', startSec: 10, durationSec: 52, kind: 'cruise' },
        { id: 'ev-r3', droneId: 'WH-UAV-M30T-006', label: '协调起飞', startSec: 8, durationSec: 12, kind: 'takeoff' },
        { id: 'ev-r4', droneId: 'WH-UAV-M30T-006', label: '空域悬停', startSec: 42, durationSec: 16, kind: 'hold' },
        { id: 'ev-r5', droneId: 'WH-UAV-P4RTK-011', label: '江南起飞', startSec: 24, durationSec: 12, kind: 'takeoff' },
        { id: 'ev-r6', droneId: 'WH-UAV-P4RTK-011', label: '南岸补采', startSec: 36, durationSec: 58, kind: 'cruise' },
        { id: 'ev-r7', droneId: 'WH-UAV-M30T-006', label: '任务交接', startSec: 58, durationSec: 14, kind: 'handoff' },
        { id: 'ev-r8', droneId: 'WH-UAV-M3E-018', label: '返航', startSec: 72, durationSec: 20, kind: 'landing' },
      ],
      rules: [
        { id: 'r-zone', label: '分区空域', description: '江北 / 中枢 / 江南 三段空域由不同机体负责', enabled: true },
        { id: 'r-hold', label: '协调悬停点', description: 'M30T 在跨江交汇点承担 16s 悬停让行', enabled: true },
        { id: 'r-handoff', label: '覆盖交接', description: '桥梁周边风险提示由协调机交接至江南补采机', enabled: true },
      ],
      metrics: { coverageKm2: 9.8, conflictResolved: 4, avgSeparationM: 380 },
    },
    {
      id: 'scenario-vitality-sync',
      name: '活力模型联动四机编队',
      summary: '面向经济活力与商圈识别模型，四机按 POI 热点优先级依次进入，质量达标后同步写入模型输入。',
      district: '全市重点片区',
      strategy: '优先级队列 + 模型回写',
      droneCount: 4,
      durationSec: 156,
      routeIds: ['route-jianghan-night', 'route-optics-valley', 'route-river-crossing'],
      drones: [
        fleetDrone({
          droneId: 'WH-UAV-M30T-006',
          droneName: 'M30T · P1 江汉',
          routeId: 'route-jianghan-night',
          startOffsetSec: 0,
          altitudeLayerM: 120,
          color: '#38bdf8',
          status: 'queued',
          batteryPct: 94,
        }),
        fleetDrone({
          droneId: 'WH-UAV-M3E-018',
          droneName: 'M3E · P2 两江',
          routeId: 'route-river-crossing',
          startOffsetSec: 12,
          altitudeLayerM: 100,
          color: '#34d399',
          batteryPct: 91,
        }),
        fleetDrone({
          droneId: 'WH-UAV-P4RTK-011',
          droneName: 'P4RTK · P3 光谷',
          routeId: 'route-optics-valley',
          startOffsetSec: 28,
          altitudeLayerM: 150,
          color: '#fbbf24',
          batteryPct: 87,
        }),
        fleetDrone({
          droneId: 'WH-UAV-M3E-019',
          droneName: 'M3E · P4 补位',
          routeId: 'route-jianghan-night',
          startOffsetSec: 44,
          altitudeLayerM: 140,
          color: '#fb7185',
          batteryPct: 89,
        }),
      ],
      schedule: [
        { id: 'ev-v1', droneId: 'WH-UAV-M30T-006', label: 'P1 起飞', startSec: 0, durationSec: 10, kind: 'takeoff' },
        { id: 'ev-v2', droneId: 'WH-UAV-M30T-006', label: '商圈采集', startSec: 10, durationSec: 40, kind: 'cruise' },
        { id: 'ev-v3', droneId: 'WH-UAV-M3E-018', label: 'P2 起飞', startSec: 12, durationSec: 10, kind: 'takeoff' },
        { id: 'ev-v4', droneId: 'WH-UAV-P4RTK-011', label: 'P3 起飞', startSec: 28, durationSec: 12, kind: 'takeoff' },
        { id: 'ev-v5', droneId: 'WH-UAV-M3E-019', label: 'P4 补位', startSec: 44, durationSec: 10, kind: 'takeoff' },
        { id: 'ev-v6', droneId: 'WH-UAV-M30T-006', label: '模型回写', startSec: 50, durationSec: 8, kind: 'handoff' },
      ],
      rules: [
        { id: 'r-priority', label: '热点优先', description: '按活力指数排序依次放行', enabled: true },
        { id: 'r-quality', label: '质量门槛', description: '路径质量 ≥ 85% 才写入活力模型', enabled: true },
        { id: 'r-sync', label: '智眼联动', description: '热力异常区触发补位机进入', enabled: false },
      ],
      metrics: { coverageKm2: 11.4, conflictResolved: 3, avgSeparationM: 510 },
    },
  ],
};

const taskRecords = {
  tasks: [
    {
      taskId: 'task-20260408-jianghan-night-001',
      routeId: 'route-jianghan-night',
      routeName: '江汉路夜间商圈航拍巡检',
      taskType: 'night_economy_audit',
      district: '江汉区',
      startTime: '2026-04-08T19:30:00+08:00',
      endTime: '2026-04-08T19:48:00+08:00',
      status: 'finished',
      droneId: 'WH-UAV-M30T-006',
      pilotMode: 'remote-supervised',
      takeoffSiteId: 'takeoff-jianghan-roof',
      imageCount: 286,
      videoMinutes: 18,
      coverageKm2: 2.36,
      distanceKm: 3.21,
      avgAltitudeM: 120,
      avgSpeedMps: 8.1,
      batteryUsedPct: 38,
      riskEvents: 1,
      outputProducts: ['正射预览', '夜间客流热力校核', '商圈边界修正建议'],
      qualityScore: 90,
    },
    {
      taskId: 'task-20260409-optics-model-001',
      routeId: 'route-optics-valley',
      routeName: '光谷-武汉东站低空建模航线',
      taskType: 'lod2_reconstruction',
      district: '东湖高新区',
      startTime: '2026-04-09T15:10:00+08:00',
      endTime: '2026-04-09T15:36:00+08:00',
      status: 'reviewing',
      droneId: 'WH-UAV-P4RTK-011',
      pilotMode: 'planned-route',
      takeoffSiteId: 'takeoff-optics-hub',
      imageCount: 412,
      videoMinutes: 26,
      coverageKm2: 3.84,
      distanceKm: 5.04,
      avgAltitudeM: 150,
      avgSpeedMps: 7.2,
      batteryUsedPct: 54,
      riskEvents: 2,
      outputProducts: ['倾斜影像序列', '建筑白模更新', '站城人流核验'],
      qualityScore: 76,
    },
    {
      taskId: 'task-20260410-river-commute-001',
      routeId: 'route-river-crossing',
      routeName: '两江四岸通勤航拍观测',
      taskType: 'commute_flow_review',
      district: '两江四岸',
      startTime: '2026-04-10T08:00:00+08:00',
      endTime: '2026-04-10T08:19:00+08:00',
      status: 'finished',
      droneId: 'WH-UAV-M3E-018',
      pilotMode: 'planned-route',
      takeoffSiteId: 'takeoff-wuchang-riverfront',
      imageCount: 198,
      videoMinutes: 19,
      coverageKm2: 4.12,
      distanceKm: 10.21,
      avgAltitudeM: 100,
      avgSpeedMps: 9.0,
      batteryUsedPct: 47,
      riskEvents: 1,
      outputProducts: ['跨江通勤流校核', '江滩客流范围', '桥梁周边风险提示'],
      qualityScore: 82,
    },
  ],
  meta: {
    scope: '武汉市',
    version: 'uav-sim-2026q1',
    source: '仿真：低空任务调度与成果管理',
  },
};

const telemetry = {
  flights: routes.map((route) => {
    const samples = Array.from({ length: 16 }, (_, idx) => {
      const t = idx / 15;
      const [lng, lat] = interpolateLine(route.coords, t);
      const routeWave = Math.sin(t * Math.PI * 2);
      return {
        ts: `2026-04-${route.id === 'route-jianghan-night' ? '08' : route.id === 'route-optics-valley' ? '09' : '10'}T${route.id === 'route-river-crossing' ? '08' : route.id === 'route-optics-valley' ? '15' : '19'}:${String(Math.round(10 + idx * 1.7)).padStart(2, '0')}:00+08:00`,
        lng,
        lat,
        altitudeM: Math.round(route.altitude + routeWave * 8),
        speedMps: round(route.speed + Math.cos(t * Math.PI * 2) * 0.8, 1),
        batteryPct: Math.max(34, Math.round(96 - idx * 3.2 - (route.id === 'route-optics-valley' ? 8 : 0))),
        signalPct: Math.max(72, Math.round(96 - Math.abs(routeWave) * 14)),
        headingDeg: Math.round(40 + t * 210),
        riskScore: Math.round(30 + Math.abs(routeWave) * 22 + (route.quality < 80 ? 12 : 0)),
      };
    });
    return {
      routeId: route.id,
      routeName: route.name,
      droneId: route.id === 'route-jianghan-night' ? 'WH-UAV-M30T-006' : route.id === 'route-optics-valley' ? 'WH-UAV-P4RTK-011' : 'WH-UAV-M3E-018',
      samples,
    };
  }),
  meta: {
    scope: '武汉市',
    version: 'uav-sim-2026q1',
    intervalSeconds: 102,
    source: '仿真：无人机飞行遥测',
  },
};

const terrainProfilesPath = path.join(publicMockDir, 'uav-route-terrain-profiles.json');
const terrainProfiles = fs.existsSync(terrainProfilesPath) ? readJson(terrainProfilesPath) : { routes: [] };
const profileByRouteId = Object.fromEntries((terrainProfiles.routes ?? []).map((item) => [item.routeId, item.samples]));

const takeoffById = Object.fromEntries(
  takeoffSites.features.map((feature) => [
    feature.id,
    { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1], name: feature.properties.name },
  ]),
);

const FLEET_SAMPLE_INTERVAL_SEC = 2;
const FLEET_SIMULATION_START = '2026-04-08T19:00:00+08:00';

function lerpValue(a, b, t) {
  return a + (b - a) * t;
}

function sampleProfileAtProgress(samples, progress) {
  if (!samples?.length) return null;
  const p = Math.max(0, Math.min(1, progress));
  const idx = p * (samples.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(samples.length - 1, i0 + 1);
  const localT = idx - i0;
  const a = samples[i0];
  const b = samples[i1];
  return {
    lng: lerpValue(a.lng, b.lng, localT),
    lat: lerpValue(a.lat, b.lat, localT),
    flightAltitudeM: lerpValue(a.flightAltitudeM, b.flightAltitudeM, localT),
    groundElevationM: lerpValue(a.groundElevationM, b.groundElevationM, localT),
    progress: p,
  };
}

function headingBetween(from, to) {
  const dLng = to.lng - from.lng;
  const dLat = to.lat - from.lat;
  if (Math.abs(dLng) < 1e-8 && Math.abs(dLat) < 1e-8) return 0;
  return Math.round((Math.atan2(dLng, dLat) * 180) / Math.PI);
}

function formatFleetSimTs(simSec) {
  const baseMin = 19 * 60;
  const totalMin = baseMin + Math.floor(simSec / 60);
  const sec = simSec % 60;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `2026-04-08T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}+08:00`;
}

function routeProgressForEvent(kind, eventT) {
  if (kind === 'takeoff') return lerpValue(0, 0.1, eventT);
  if (kind === 'landing') return lerpValue(0.88, 1, eventT);
  if (kind === 'hold' || kind === 'handoff') return 0.52;
  return eventT;
}

function buildFleetTrack(drone, scenario) {
  const route = routeById[drone.routeId];
  const profile = profileByRouteId[drone.routeId] ?? [];
  const site = takeoffById[drone.takeoffSiteId] ?? takeoffById['takeoff-jianghan-roof'];
  const altDelta = drone.altitudeLayerM - (route?.altitude ?? 120);
  const events = scenario.schedule.filter((event) => event.droneId === drone.droneId).sort((a, b) => a.startSec - b.startSec);
  const samples = [];
  let lastPos = { lng: site.lng, lat: site.lat };

  for (let simSec = 0; simSec <= scenario.durationSec; simSec += FLEET_SAMPLE_INTERVAL_SEC) {
    let phase = 'ground';
    let lng = site.lng;
    let lat = site.lat;
    let altitudeM = 15;
    let speedMps = 0;

    if (simSec >= drone.startOffsetSec) {
      const event = events.find((item) => simSec >= item.startSec && simSec < item.startSec + item.durationSec);
      if (!event) {
        phase = 'done';
        altitudeM = 12;
      } else {
        const eventT = (simSec - event.startSec) / Math.max(event.durationSec, 1);
        phase = event.kind === 'hold' ? 'holding' : event.kind;
        if (event.kind === 'takeoff') {
          const target = sampleProfileAtProgress(profile, 0.08) ?? { lng: site.lng, lat: site.lat, flightAltitudeM: drone.altitudeLayerM };
          lng = lerpValue(site.lng, target.lng, eventT);
          lat = lerpValue(site.lat, target.lat, eventT);
          altitudeM = lerpValue(15, target.flightAltitudeM + altDelta, eventT);
          speedMps = round(lerpValue(0, route?.speed ?? 8, eventT), 1);
        } else if (event.kind === 'landing') {
          const start = sampleProfileAtProgress(profile, 0.94) ?? { lng: site.lng, lat: site.lat, flightAltitudeM: drone.altitudeLayerM };
          lng = lerpValue(start.lng, site.lng, eventT);
          lat = lerpValue(start.lat, site.lat, eventT);
          altitudeM = lerpValue(start.flightAltitudeM + altDelta, 12, eventT);
          speedMps = round(lerpValue(route?.speed ?? 8, 0, eventT), 1);
        } else {
          const routeProgress = routeProgressForEvent(event.kind, eventT);
          const point = sampleProfileAtProgress(profile, routeProgress);
          if (point) {
            lng = point.lng;
            lat = point.lat;
            altitudeM = round(point.flightAltitudeM + altDelta, 1);
          }
          if (event.kind === 'hold') {
            speedMps = 0;
            phase = 'holding';
          } else if (event.kind === 'handoff') {
            speedMps = round((route?.speed ?? 8) * 0.35, 1);
          } else {
            speedMps = round((route?.speed ?? 8) + Math.sin(routeProgress * Math.PI * 2) * 0.6, 1);
          }
        }
      }
    }

    samples.push({
      simSec,
      ts: formatFleetSimTs(simSec),
      phase,
      lng: round(lng),
      lat: round(lat),
      altitudeM: round(altitudeM, 1),
      speedMps,
      headingDeg: headingBetween(lastPos, { lng, lat }),
      batteryPct: Math.max(28, Math.round(drone.batteryPct - simSec * 0.22 - (phase === 'airborne' ? 2 : 0))),
      signalPct: Math.max(72, Math.round(94 - Math.abs(Math.sin(simSec / 8)) * 12)),
      riskScore: Math.round(24 + (phase === 'holding' ? 18 : 10) + (route?.quality < 80 ? 8 : 0)),
    });
    lastPos = { lng, lat };
  }

  return {
    droneId: drone.droneId,
    routeId: drone.routeId,
    color: drone.color,
    startOffsetSec: drone.startOffsetSec,
    takeoffSiteId: drone.takeoffSiteId,
    samples,
  };
}

function buildFleetFrames(tracks) {
  const simSecs = [...new Set(tracks.flatMap((track) => track.samples.map((sample) => sample.simSec)))].sort((a, b) => a - b);
  return simSecs.map((simSec) => {
    const positions = tracks
      .map((track) => {
        const sample = track.samples.find((item) => item.simSec === simSec);
        if (!sample || sample.phase === 'ground' || sample.phase === 'done') return null;
        return {
          droneId: track.droneId,
          color: track.color,
          lng: sample.lng,
          lat: sample.lat,
          altitudeM: sample.altitudeM,
          phase: sample.phase,
        };
      })
      .filter(Boolean);
    return { simSec, activeCount: positions.length, positions };
  });
}

const fleetRegistrySpecs = {
  'WH-UAV-M30T-006': {
    model: 'DJI M30T',
    vendor: '大疆行业',
    maxFlightMin: 41,
    maxSpeedMps: 12,
    defaultTakeoffSiteId: 'takeoff-jianghan-roof',
    payloads: ['可见光', '热成像', '激光测距'],
    readinessScore: 92,
  },
  'WH-UAV-P4RTK-011': {
    model: 'Phantom 4 RTK',
    vendor: '大疆航测',
    maxFlightMin: 30,
    maxSpeedMps: 10,
    defaultTakeoffSiteId: 'takeoff-optics-hub',
    payloads: ['RTK 正射', '倾斜摄影'],
    readinessScore: 88,
  },
  'WH-UAV-M3E-018': {
    model: 'DJI M3E',
    vendor: '大疆行业',
    maxFlightMin: 45,
    maxSpeedMps: 11,
    defaultTakeoffSiteId: 'takeoff-wuchang-riverfront',
    payloads: ['可见光', '快速巡检'],
    readinessScore: 90,
  },
  'WH-UAV-M3E-019': {
    model: 'DJI M3E',
    vendor: '大疆行业',
    maxFlightMin: 45,
    maxSpeedMps: 11,
    defaultTakeoffSiteId: 'takeoff-jianghan-roof',
    payloads: ['可见光', '补位复核'],
    readinessScore: 86,
  },
};

const fleetRegistry = {
  meta: {
    scope: '武汉市',
    version: 'uav-fleet-sim-2026q1',
    generatedAt: new Date().toISOString(),
    source: '仿真：低空机队注册与就绪状态',
  },
  drones: Object.entries(fleetRegistrySpecs).map(([droneId, spec]) => ({
    droneId,
    ...spec,
    status: 'available',
  })),
};

const fleetTelemetry = {
  meta: {
    scope: '武汉市',
    version: 'uav-fleet-sim-2026q1',
    generatedAt: new Date().toISOString(),
    sampleIntervalSec: FLEET_SAMPLE_INTERVAL_SEC,
    source: '仿真：多机协同统一时钟遥测',
    note: '基于 uav-route-terrain-profiles 与编队方案 schedule 生成，供三维动画与 Gantt 同步回放。',
  },
  scenarios: fleetDispatchPlan.scenarios.map((scenario) => {
    const tracks = scenario.drones.map((drone) => buildFleetTrack(drone, scenario));
    return {
      scenarioId: scenario.id,
      durationSec: scenario.durationSec,
      simulationStart: FLEET_SIMULATION_START,
      sampleIntervalSec: FLEET_SAMPLE_INTERVAL_SEC,
      tracks,
      frames: buildFleetFrames(tracks),
    };
  }),
};

const fleetConflictTemplates = {
  'scenario-jianghan-optics-dual': [
    {
      id: 'c-dual-1',
      simSec: 32,
      droneIds: ['WH-UAV-M30T-006', 'WH-UAV-P4RTK-011'],
      conflictType: 'corridor',
      minSeparationM: 26,
      resolvedBy: 'r-corridor',
      resolution: '航廊互斥：江汉段与光谷东向段错峰进入，垂直间隔同步生效',
    },
    {
      id: 'c-dual-2',
      simSec: 48,
      droneIds: ['WH-UAV-M30T-006', 'WH-UAV-P4RTK-011'],
      conflictType: 'altitude',
      minSeparationM: 30,
      resolvedBy: 'r-alt',
      resolution: '高度分层：120m / 150m，满足 ≥30m 垂直间隔',
    },
  ],
  'scenario-river-triple': [
    {
      id: 'c-triple-1',
      simSec: 42,
      droneIds: ['WH-UAV-M3E-018', 'WH-UAV-M30T-006'],
      conflictType: 'time',
      minSeparationM: 18,
      resolvedBy: 'r-hold',
      resolution: 'M30T 在交汇点悬停 16s，江北机优先通过',
    },
    {
      id: 'c-triple-2',
      simSec: 58,
      droneIds: ['WH-UAV-M30T-006', 'WH-UAV-P4RTK-011'],
      conflictType: 'corridor',
      minSeparationM: 22,
      resolvedBy: 'r-handoff',
      resolution: '桥梁风险提示覆盖由协调机交接至江南补采机',
    },
    {
      id: 'c-triple-3',
      simSec: 36,
      droneIds: ['WH-UAV-M3E-018', 'WH-UAV-P4RTK-011'],
      conflictType: 'altitude',
      minSeparationM: 32,
      resolvedBy: 'r-zone',
      resolution: '分区空域：江北 100m / 江南 110m，中枢 130m',
    },
    {
      id: 'c-triple-4',
      simSec: 64,
      droneIds: ['WH-UAV-M3E-018', 'WH-UAV-P4RTK-011'],
      conflictType: 'time',
      minSeparationM: 24,
      resolvedBy: 'r-zone',
      resolution: '江南机延迟 24s 起飞，避免跨江段同时占用',
    },
  ],
  'scenario-vitality-sync': [
    {
      id: 'c-vit-1',
      simSec: 28,
      droneIds: ['WH-UAV-M30T-006', 'WH-UAV-M3E-018'],
      conflictType: 'time',
      minSeparationM: 20,
      resolvedBy: 'r-priority',
      resolution: 'P1 江汉优先，P2 两江延迟 12s 进入',
    },
    {
      id: 'c-vit-2',
      simSec: 44,
      droneIds: ['WH-UAV-P4RTK-011', 'WH-UAV-M3E-019'],
      conflictType: 'altitude',
      minSeparationM: 28,
      resolvedBy: 'r-alt',
      resolution: 'P3 150m / P4 140m 分层，避免同域交叉',
    },
    {
      id: 'c-vit-3',
      simSec: 50,
      droneIds: ['WH-UAV-M30T-006', 'WH-UAV-M3E-019'],
      conflictType: 'corridor',
      minSeparationM: 24,
      resolvedBy: 'r-quality',
      resolution: 'P1 质量 90% 达标后触发模型回写，P4 补位进入',
    },
  ],
};

const fleetConflicts = {
  meta: {
    scope: '武汉市',
    version: 'uav-fleet-sim-2026q1',
    generatedAt: new Date().toISOString(),
    source: '仿真：多机空域冲突检测与消解记录',
  },
  scenarios: fleetDispatchPlan.scenarios.map((scenario) => ({
    scenarioId: scenario.id,
    conflicts: fleetConflictTemplates[scenario.id] ?? [],
  })),
};

const hourlyFlow = {
  date: '2026-04-08',
  records: [
    ['江汉路-循礼门商圈', 'wuhan-jianghan', 114.292, 30.596, 64, 58, 61, 69, 78, 91],
    ['武昌滨江-黄鹤楼片区', 'wuhan-wuchang-riverside', 114.308, 30.556, 52, 55, 64, 72, 80, 86],
    ['光谷广场-武汉东站', 'wuhan-optics-valley', 114.421, 30.523, 59, 73, 81, 84, 79, 76],
    ['徐东-岳家嘴商务圈', 'wuhan-xudong', 114.356, 30.604, 46, 62, 75, 72, 68, 63],
    ['南湖-街道口生活圈', 'wuhan-nanhu', 114.335, 30.505, 42, 55, 70, 74, 76, 72],
  ].map(([name, unitId, lng, lat, h8, h10, h14, h17, h19, h21]) => ({
    unitId,
    name,
    center: { lng, lat },
    hourly: [
      { hour: '08:00', peopleFlowIndex: h8, vehicleFlowIndex: Math.round(h8 * 0.92), anomalyScore: Math.max(0, h8 - 58) },
      { hour: '10:00', peopleFlowIndex: h10, vehicleFlowIndex: Math.round(h10 * 0.86), anomalyScore: Math.max(0, h10 - 62) },
      { hour: '14:00', peopleFlowIndex: h14, vehicleFlowIndex: Math.round(h14 * 0.8), anomalyScore: Math.max(0, h14 - 68) },
      { hour: '17:00', peopleFlowIndex: h17, vehicleFlowIndex: Math.round(h17 * 0.97), anomalyScore: Math.max(0, h17 - 70) },
      { hour: '19:00', peopleFlowIndex: h19, vehicleFlowIndex: Math.round(h19 * 0.72), anomalyScore: Math.max(0, h19 - 72) },
      { hour: '21:00', peopleFlowIndex: h21, vehicleFlowIndex: Math.round(h21 * 0.58), anomalyScore: Math.max(0, h21 - 74) },
    ],
  })),
  meta: {
    scope: '武汉市',
    version: 'v2026Q1',
    source: '仿真：智眼小时级人车流',
  },
};

const businessDaily = {
  days: Array.from({ length: 14 }, (_, idx) => {
    const day = String(idx + 1).padStart(2, '0');
    const weekendBoost = idx % 7 >= 4 ? 6 : 0;
    return {
      date: `2026-04-${day}`,
      units: [
        { unitId: 'wuhan-jianghan', name: '江汉路-循礼门商圈', vitalityIndex: 86 + weekendBoost + (idx % 3), consumeIndex: 84 + weekendBoost, nightEconomyIndex: 88 + weekendBoost },
        { unitId: 'wuhan-optics-valley', name: '光谷广场-武汉东站', vitalityIndex: 82 + Math.round(weekendBoost * 0.45) + (idx % 4), consumeIndex: 80 + Math.round(weekendBoost * 0.5), nightEconomyIndex: 75 + Math.round(weekendBoost * 0.6) },
        { unitId: 'wuhan-wuchang-riverside', name: '武昌滨江-黄鹤楼片区', vitalityIndex: 78 + weekendBoost + (idx % 2), consumeIndex: 76 + weekendBoost, nightEconomyIndex: 80 + weekendBoost },
        { unitId: 'wuhan-xudong', name: '徐东-岳家嘴商务圈', vitalityIndex: 73 + Math.round(weekendBoost * 0.5), consumeIndex: 74 + Math.round(weekendBoost * 0.4), nightEconomyIndex: 70 + Math.round(weekendBoost * 0.5) },
      ],
    };
  }),
  meta: {
    scope: '武汉市',
    version: 'v2026Q1',
    source: '仿真：商圈日级活力与消费指数',
  },
};

const buildingModels = featureCollection(
  [
    ['building-jianghan-01', '江汉路商业综合体白模', '江汉区', 114.2925, 30.5962, 0.42, 0.28, 96, 'commercial'],
    ['building-jianghan-02', '循礼门办公塔楼白模', '江汉区', 114.2865, 30.5908, 0.34, 0.24, 118, 'office'],
    ['building-optics-01', '光谷站城综合体白模', '东湖高新区', 114.4235, 30.524, 0.58, 0.34, 86, 'transport_commerce'],
    ['building-optics-02', '光谷创新办公楼白模', '东湖高新区', 114.414, 30.516, 0.44, 0.3, 102, 'office'],
    ['building-river-01', '武昌滨江文旅设施白模', '武昌区', 114.306, 30.557, 0.5, 0.26, 54, 'culture'],
    ['building-xudong-01', '徐东商务楼群白模', '武昌区', 114.356, 30.604, 0.52, 0.32, 92, 'office'],
  ].map(([id, name, district, lng, lat, widthKm, heightKm, heightM, usage]) =>
    polygonFeature(id, {
      name,
      district,
      usage,
      heightM,
      floors: Math.round(heightM / 3.6),
      confidence: 0.74,
      source: '仿真：三维城市建筑白模',
    }, rectangleAround(lng, lat, widthKm, heightKm)),
  ),
  {
    name: 'wuhan-building-white-models',
    meta: { scope: '武汉市', version: 'uav-sim-2026q1' },
  },
);

const datasets = {
  'low-altitude-risk-zones.geojson': lowAltitudeRiskZones,
  'uav-takeoff-sites.geojson': takeoffSites,
  'uav-task-records.json': taskRecords,
  'uav-fleet-dispatch-plan.json': fleetDispatchPlan,
  'uav-fleet-registry.json': fleetRegistry,
  'uav-fleet-telemetry.json': fleetTelemetry,
  'uav-fleet-conflicts.json': fleetConflicts,
  'uav-telemetry.json': telemetry,
  'hourly-flow-timeseries.json': hourlyFlow,
  'business-vitality-daily.json': businessDaily,
  'building-white-models.geojson': buildingModels,
};

for (const [file, value] of Object.entries(datasets)) {
  for (const dir of [sourceSimDir, publicMockDir, backendMockDir]) {
    writeJson(path.join(dir, file), value);
  }
}

const legacyReadmeJson = path.join(sourceSimDir, 'README.json');
if (fs.existsSync(legacyReadmeJson)) {
  fs.unlinkSync(legacyReadmeJson);
}

const extraLayers = [
  { id: 'low-altitude-risk-zones', name: '武汉低空风险区', dataSource: '无人机', tableName: 'low_altitude_risk_zones', geomType: 'Polygon', metric: '风险等级、限高、规则', ruleText: '高风险与禁飞区优先避让', unit: '指数 / 米', sortOrder: 24 },
  { id: 'uav-takeoff-sites', name: '武汉无人机起降点', dataSource: '无人机', tableName: 'uav_takeoff_sites', geomType: 'Point', metric: '容量、就绪度、场景', ruleText: '就绪度 >= 80 可调度', unit: '架次 / 分', sortOrder: 25 },
  { id: 'uav-fleet-dispatch-plan', name: '武汉多机协同调度方案', dataSource: '无人机', tableName: 'uav_fleet_dispatch_plan', geomType: 'None', metric: '编队、时序、协同规则', ruleText: '关联航线与起降点生成调度方案', unit: '套', sortOrder: 27 },
  { id: 'uav-fleet-registry', name: '武汉无人机机队注册', dataSource: '无人机', tableName: 'uav_fleet_registry', geomType: 'None', metric: '机型、续航、就绪度', ruleText: '就绪度 >= 85 可编入协同任务', unit: '架', sortOrder: 28 },
  { id: 'uav-fleet-telemetry', name: '武汉多机协同遥测', dataSource: '无人机', tableName: 'uav_fleet_telemetry', geomType: 'None', metric: '统一时钟轨迹帧', ruleText: 'simSec 与 schedule 对齐', unit: '秒', sortOrder: 29 },
  { id: 'uav-fleet-conflicts', name: '武汉多机冲突消解', dataSource: '无人机', tableName: 'uav_fleet_conflicts', geomType: 'None', metric: '冲突类型、间隔、规则', ruleText: '演示空域冲突检测与消解', unit: '次', sortOrder: 30 },
  { id: 'building-white-models', name: '武汉三维建筑白模', dataSource: '模型', tableName: 'building_white_models', geomType: 'Polygon', metric: '建筑高度、用途', ruleText: '用于三维展示与航线净空校核', unit: '米', sortOrder: 26 },
  { id: 'hourly-flow-timeseries', name: '武汉小时级人车流', dataSource: '智眼', tableName: 'hourly_flow_timeseries', geomType: 'None', metric: '人流、车流、异常得分', ruleText: '异常得分触发无人机复核', unit: '指数', sortOrder: 31 },
  { id: 'business-vitality-daily', name: '武汉商圈日活力', dataSource: '模型', tableName: 'business_vitality_daily', geomType: 'None', metric: '活力、消费、夜间经济', ruleText: '用于趋势展示与模型回放', unit: '指数', sortOrder: 32 },
];

const layerCatalogFile = path.join(publicMockDir, 'layer-catalog.json');
const layerCatalog = readJson(layerCatalogFile);
const mergedLayers = [
  ...layerCatalog.filter((layer) => !extraLayers.some((extra) => extra.id === layer.id)),
  ...extraLayers,
].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
writeJson(layerCatalogFile, mergedLayers);
writeJson(path.join(backendMockDir, 'layer-catalog.json'), mergedLayers);

const dataSourcesFile = path.join(publicMockDir, 'data-sources.json');
const dataSources = readJson(dataSourcesFile);
const simSource = {
  id: 'low-altitude-business-sim',
  label: '武汉低空业务仿真数据',
  description: '起降点、风险区、任务记录、飞行遥测、小时级人车流与商圈日活力的联调数据。',
  isActive: true,
};
const mergedSources = [
  ...dataSources.filter((source) => source.id !== simSource.id),
  simSource,
];
writeJson(dataSourcesFile, mergedSources);
writeJson(path.join(backendMockDir, 'data-sources.json'), mergedSources);

const endpointMap = {
  'GET /api/v1/wuhan/uav/risk-zones?ds=v2026Q1': lowAltitudeRiskZones,
  'GET /api/v1/wuhan/uav/takeoff-sites?ds=v2026Q1': takeoffSites,
  'GET /api/v1/wuhan/uav/tasks?ds=v2026Q1': taskRecords,
  'GET /api/v1/wuhan/uav/fleet-dispatch-plans?ds=v2026Q1': fleetDispatchPlan,
  'GET /api/v1/wuhan/uav/fleet-registry?ds=v2026Q1': fleetRegistry,
  'GET /api/v1/wuhan/uav/fleet-telemetry?ds=v2026Q1': fleetTelemetry,
  'GET /api/v1/wuhan/uav/fleet-conflicts?ds=v2026Q1': fleetConflicts,
  'GET /api/v1/wuhan/uav/telemetry?ds=v2026Q1': telemetry,
  'GET /api/v1/wuhan/timeseries/hourly-flow?ds=v2026Q1&date=2026-04-08': hourlyFlow,
  'GET /api/v1/wuhan/timeseries/business-daily?ds=v2026Q1': businessDaily,
  'GET /api/v1/wuhan/scene3d/buildings?ds=v2026Q1': buildingModels,
};

for (const apiFixtureFile of [path.join(publicMockDir, 'api-fixtures.json'), path.join(backendMockDir, 'api-fixtures.json')]) {
  const fixtures = fs.existsSync(apiFixtureFile) ? readJson(apiFixtureFile) : { endpoints: {} };
  fixtures.endpoints = { ...(fixtures.endpoints ?? {}), ...endpointMap };
  fixtures.endpoints['GET /api/v1/wuhan/metadata/data-sources'] = mergedSources;
  fixtures.endpoints['GET /api/v1/wuhan/metadata/layers'] = mergedLayers;
  writeJson(apiFixtureFile, fixtures);
}

writeJson(path.join(sourceSimDir, 'manifest.json'), {
  title: '武汉低空经济与城市运行仿真数据',
  generatedAt: new Date().toISOString(),
  scope: '武汉市',
  files: Object.keys(datasets),
  note: '这些数据为前后端联调和项目展示使用，不代表真实政务、飞控或空域管制数据。',
});

fs.writeFileSync(
  path.join(sourceSimDir, 'README.md'),
  `# 武汉低空经济与城市运行仿真数据

本目录由 \`web/scripts/generate-wuhan-simulation-extension.mjs\` 生成，数据用于课程项目展示、前后端接口联调和页面功能演示，不代表真实政务、飞控或空域管制数据。

## 文件清单

| 文件 | 用途 |
| --- | --- |
| \`low-altitude-risk-zones.geojson\` | 低空风险区、禁飞/限高与规则 |
| \`uav-takeoff-sites.geojson\` | 无人机起降点、容量与就绪度 |
| \`uav-task-records.json\` | 无人机任务记录、成果、质量与耗电 |
| \`uav-fleet-dispatch-plan.json\` | 多无人机协同调度方案、编组与时序 |
| \`uav-fleet-registry.json\` | 机队注册表、机型与就绪度 |
| \`uav-fleet-telemetry.json\` | 多机统一时钟遥测与同步帧 |
| \`uav-fleet-conflicts.json\` | 空域冲突检测与消解记录 |
| \`uav-telemetry.json\` | 无人机飞行遥测轨迹点 |
| \`hourly-flow-timeseries.json\` | 小时级人流、车流与异常得分 |
| \`business-vitality-daily.json\` | 商圈日级活力、消费、夜间经济趋势 |
| \`building-white-models.geojson\` | 三维城市建筑白模 |
| \`manifest.json\` | 数据包清单 |

## 重新生成

\`\`\`powershell
cd web
npm.cmd run generate:sim-wuhan
\`\`\`
`,
  'utf8',
);

console.log(`Generated Wuhan simulation extension in ${sourceSimDir}`);
