const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const outputTargets = [
  path.join(root, 'web/public/data/mock/wuhan'),
  path.join(root, 'database/mock/backend-sim'),
];

const cityUnitsPath = path.join(root, 'web/public/data/mock/wuhan/city-units.geojson');

const units = JSON.parse(fs.readFileSync(cityUnitsPath, 'utf8')).features.map((feature) => {
  const ring = feature.geometry.coordinates[0];
  const center = ring.reduce(
    (acc, [lng, lat]) => {
      acc.lng += lng;
      acc.lat += lat;
      return acc;
    },
    { lng: 0, lat: 0 },
  );
  return {
    id: feature.properties.id,
    name: feature.properties.name,
    tier: feature.properties.tier,
    baseVitality: feature.properties.vitalityIdx,
    baseNight: feature.properties.nightEconomyIdx,
    baseConsume: feature.properties.consumePotential,
    baseFlow: feature.properties.inboundFlowIdx,
    popDensity: feature.properties.popDensity,
    center: {
      lng: Number((center.lng / ring.length).toFixed(6)),
      lat: Number((center.lat / ring.length).toFixed(6)),
    },
  };
});

const unitProfiles = {
  'wuhan-jianghan': {
    type: 'night',
    peakHours: [19, 20, 21, 22],
    vehiclePeakHours: [8, 18],
    anomaly: { date: '2026-04-05', hours: [20, 21, 22], label: '清明假期夜间消费外溢' },
    eventBoost: 10,
  },
  'wuhan-wuchang-riverside': {
    type: 'tourism',
    peakHours: [10, 15, 19, 20],
    vehiclePeakHours: [9, 17],
    anomaly: { date: '2026-04-06', hours: [10, 14, 20], label: '黄鹤楼-江滩文旅客流上升' },
    eventBoost: 9,
  },
  'wuhan-hanyang': {
    type: 'living',
    peakHours: [8, 18, 19, 20],
    vehiclePeakHours: [8, 18],
    anomaly: { date: '2026-04-12', hours: [18, 19], label: '王家湾生活消费晚高峰' },
    eventBoost: 6,
  },
  'wuhan-optics-valley': {
    type: 'commute',
    peakHours: [8, 9, 17, 18],
    vehiclePeakHours: [8, 9, 17, 18],
    anomaly: { date: '2026-04-09', hours: [17, 18], label: '武汉东站站城通勤叠加' },
    eventBoost: 8,
  },
  'wuhan-xudong': {
    type: 'office',
    peakHours: [9, 12, 17, 18],
    vehiclePeakHours: [8, 17, 18],
    anomaly: { date: '2026-04-10', hours: [17, 18], label: '商务办公晚高峰' },
    eventBoost: 6,
  },
  'wuhan-qingshan': {
    type: 'industry',
    peakHours: [7, 8, 17],
    vehiclePeakHours: [7, 8, 17],
    anomaly: { date: '2026-04-11', hours: [8, 17], label: '工业更新片区班次波动' },
    eventBoost: 5,
  },
  'wuhan-nanhu': {
    type: 'campus',
    peakHours: [12, 17, 19, 21],
    vehiclePeakHours: [8, 18],
    anomaly: { date: '2026-04-13', hours: [19, 20, 21], label: '高校生活圈夜间餐饮活跃' },
    eventBoost: 7,
  },
  'wuhan-airport': {
    type: 'hub',
    peakHours: [7, 8, 16, 20, 22],
    vehiclePeakHours: [7, 16, 20],
    anomaly: { date: '2026-04-08', hours: [20, 21, 22], label: '临空枢纽到达客流提升' },
    eventBoost: 7,
  },
  'wuhan-jinkou': {
    type: 'port',
    peakHours: [8, 14, 17],
    vehiclePeakHours: [8, 14, 17],
    anomaly: { date: '2026-04-10', hours: [14, 17], label: '南部港产物流班次加密' },
    eventBoost: 5,
  },
  'wuhan-caidian': {
    type: 'living',
    peakHours: [8, 18, 19],
    vehiclePeakHours: [8, 18],
    anomaly: { date: '2026-04-12', hours: [18, 19], label: '车谷居住消费联动' },
    eventBoost: 5,
  },
};

const eventCalendar = [
  {
    date: '2026-04-05',
    name: '清明假期夜游高峰',
    eventType: 'holiday',
    affectedUnitIds: ['wuhan-jianghan', 'wuhan-wuchang-riverside', 'wuhan-nanhu'],
    impact: 12,
    description: '文旅与夜间餐饮活动叠加，江汉路、武昌滨江和高校生活圈晚间峰值后移。',
  },
  {
    date: '2026-04-06',
    name: '滨江文旅客流回补',
    eventType: 'holiday',
    affectedUnitIds: ['wuhan-wuchang-riverside', 'wuhan-jianghan'],
    impact: 10,
    description: '黄鹤楼、武昌江滩客流集中，午后与夜间经济活力同步抬升。',
  },
  {
    date: '2026-04-09',
    name: '站城通勤观测日',
    eventType: 'commute',
    affectedUnitIds: ['wuhan-optics-valley', 'wuhan-airport'],
    impact: 8,
    description: '武汉东站与光谷核心通勤叠加，早晚高峰人车流同时增强。',
  },
  {
    date: '2026-04-12',
    name: '周末生活消费恢复',
    eventType: 'weekend',
    affectedUnitIds: ['wuhan-hanyang', 'wuhan-caidian', 'wuhan-nanhu'],
    impact: 7,
    description: '社区生活圈晚间消费增强，生活服务和餐饮类 POI 周边热度上升。',
  },
];

const days = Array.from({ length: 14 }, (_, index) => {
  const day = index + 1;
  return `2026-04-${String(day).padStart(2, '0')}`;
});

const hours = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function dayOfWeek(date) {
  return new Date(`${date}T00:00:00+08:00`).getDay();
}

function isWeekend(date) {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

function distanceToPeak(hour, peakHours) {
  return Math.min(...peakHours.map((peak) => Math.abs(hour - peak)));
}

function peakBoost(hour, peakHours, strength) {
  const distance = distanceToPeak(hour, peakHours);
  return Math.max(0, strength - distance * 5);
}

function deterministicNoise(unitId, date, hour) {
  const seed = `${unitId}-${date}-${hour}`;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return (hash % 11) - 5;
}

function eventFor(date, unitId) {
  return eventCalendar.find((event) => event.date === date && event.affectedUnitIds.includes(unitId));
}

function flowRecord(unit, date, hourLabel) {
  const hour = Number(hourLabel.slice(0, 2));
  const profile = unitProfiles[unit.id] ?? unitProfiles['wuhan-jianghan'];
  const nightHours = hour >= 18 || hour <= 2;
  const commuteBoost = peakBoost(hour, profile.peakHours, profile.type === 'commute' ? 24 : 18);
  const vehicleBoost = peakBoost(hour, profile.vehiclePeakHours, 20);
  const weekendBoost = isWeekend(date) ? (profile.type === 'office' || profile.type === 'industry' ? -8 : 7) : 0;
  const event = eventFor(date, unit.id);
  const localAnomaly = profile.anomaly.date === date && profile.anomaly.hours.includes(hour) ? profile.eventBoost : 0;
  const nightBoost = nightHours ? (unit.baseNight - 65) * 0.28 : -4;
  const middayDip = hour >= 11 && hour <= 14 ? (profile.type === 'office' ? 5 : 2) : 0;
  const earlyLow = hour <= 5 ? (hour === 0 ? -12 : -28) : 0;
  const base = unit.baseFlow * 0.62 + unit.baseVitality * 0.22 + unit.baseConsume * 0.08;
  const people = clamp(
    base + commuteBoost + weekendBoost + nightBoost + middayDip + earlyLow + (event?.impact ?? 0) + localAnomaly + deterministicNoise(unit.id, date, hour),
    8,
    99,
  );
  const vehicle = clamp(
    unit.baseFlow * 0.52 + vehicleBoost + (profile.type === 'hub' ? 8 : 0) + (profile.type === 'port' ? 7 : 0) + earlyLow * 0.42 + deterministicNoise(`${unit.id}-v`, date, hour),
    6,
    96,
  );
  const vitality = clamp(people * 0.48 + vehicle * 0.2 + unit.baseConsume * 0.22 + (nightHours ? unit.baseNight * 0.1 : 0));
  const anomaly = clamp(Math.max(0, people - unit.baseFlow - 9) + localAnomaly + (event ? event.impact * 0.7 : 0), 0, 40);
  return {
    hour: hourLabel,
    peopleFlowIndex: people,
    vehicleFlowIndex: vehicle,
    vitalityIndex: vitality,
    consumeIndex: clamp(vitality * 0.58 + unit.baseConsume * 0.42 + (event ? 4 : 0)),
    nightEconomyIndex: clamp((nightHours ? vitality * 0.62 + unit.baseNight * 0.38 : unit.baseNight * 0.72) + deterministicNoise(`${unit.id}-n`, date, hour) * 0.4),
    anomalyScore: anomaly,
    eventName: event?.name ?? (localAnomaly ? profile.anomaly.label : ''),
  };
}

function dailyUnitRecord(unit, date) {
  const hourly = hours.map((hour) => flowRecord(unit, date, hour));
  const avg = (key) => hourly.reduce((sum, item) => sum + item[key], 0) / hourly.length;
  const night = hourly.filter((item) => Number(item.hour.slice(0, 2)) >= 18 || Number(item.hour.slice(0, 2)) <= 2);
  const peak = hourly.reduce((best, item) => (item.peopleFlowIndex > best.peopleFlowIndex ? item : best), hourly[0]);
  const event = eventFor(date, unit.id);
  return {
    unitId: unit.id,
    name: unit.name,
    vitalityIndex: clamp(avg('vitalityIndex') + (event ? 3 : 0)),
    consumeIndex: clamp(avg('consumeIndex') + (event ? 3 : 0)),
    nightEconomyIndex: clamp(night.reduce((sum, item) => sum + item.nightEconomyIndex, 0) / night.length + (event ? 4 : 0)),
    peopleFlowAvg: clamp(avg('peopleFlowIndex')),
    vehicleFlowAvg: clamp(avg('vehicleFlowIndex')),
    peakHour: peak.hour,
    anomalyScore: clamp(hourly.reduce((sum, item) => sum + item.anomalyScore, 0) / hourly.length),
    eventName: event?.name ?? '',
  };
}

const hourlyFlow = {
  date: '2026-04-08',
  hours,
  records: units.map((unit) => ({
    unitId: unit.id,
    name: unit.name,
    center: unit.center,
    hourly: hours.map((hour) => flowRecord(unit, '2026-04-08', hour)),
  })),
  meta: {
    scope: '武汉市',
    version: 'v2026Q1',
    source: '仿真：武汉经济动态小时级人流、车流、活力指数',
    simulated: true,
    note: '首屏轻量数据，仅含默认日期 24 小时；多日切片见 hourly-flow-daily-slices.json。用于课程/项目展示，不代表真实智眼、运营商、支付或交通管理数据。',
  },
};

const hourlyFlowDailySlices = {
  hours,
  dailySlices: days.map((date) => ({
    date,
    dayType: isWeekend(date) ? 'weekend' : 'weekday',
    events: eventCalendar.filter((event) => event.date === date),
    records: units.map((unit) => ({
      unitId: unit.id,
      name: unit.name,
      center: unit.center,
      hourly: hours.map((hour) => flowRecord(unit, date, hour)),
    })),
  })),
  meta: {
    scope: '武汉市',
    version: 'v2026Q1',
    source: '仿真：武汉经济动态多日小时切片',
    simulated: true,
    note: '按需用于周内周期、节假日和事件回放，不代表真实智眼、运营商、支付或交通管理数据。',
  },
};

const businessDaily = {
  days: days.map((date) => ({
    date,
    dayType: isWeekend(date) ? 'weekend' : 'weekday',
    events: eventCalendar.filter((event) => event.date === date),
    units: units.map((unit) => dailyUnitRecord(unit, date)),
  })),
  baselines: [
    {
      baselineId: 'weekday-average',
      label: '平日均值',
      units: units.map((unit) => {
        const weekdayDays = days.filter((date) => !isWeekend(date));
        const records = weekdayDays.map((date) => dailyUnitRecord(unit, date));
        return averageDaily(unit, records);
      }),
    },
    {
      baselineId: 'weekend-average',
      label: '周末均值',
      units: units.map((unit) => {
        const weekendDays = days.filter((date) => isWeekend(date));
        const records = weekendDays.map((date) => dailyUnitRecord(unit, date));
        return averageDaily(unit, records);
      }),
    },
    {
      baselineId: 'holiday-event',
      label: '节假日/事件日均值',
      units: units.map((unit) => {
        const eventDays = days.filter((date) => eventFor(date, unit.id));
        const records = (eventDays.length ? eventDays : days).map((date) => dailyUnitRecord(unit, date));
        return averageDaily(unit, records);
      }),
    },
  ],
  events: eventCalendar,
  meta: {
    scope: '武汉市',
    version: 'v2026Q1',
    source: '仿真：武汉商圈日级活力、消费和夜间经济趋势',
    simulated: true,
    note: '用于课程/项目展示，不代表真实交易、税务、支付或平台订单数据。',
  },
};

function averageDaily(unit, records) {
  const avg = (key) => records.reduce((sum, item) => sum + item[key], 0) / records.length;
  return {
    unitId: unit.id,
    name: unit.name,
    vitalityIndex: clamp(avg('vitalityIndex')),
    consumeIndex: clamp(avg('consumeIndex')),
    nightEconomyIndex: clamp(avg('nightEconomyIndex')),
    peopleFlowAvg: clamp(avg('peopleFlowAvg')),
    vehicleFlowAvg: clamp(avg('vehicleFlowAvg')),
    anomalyScore: clamp(avg('anomalyScore')),
  };
}

const economicEvents = {
  events: eventCalendar,
  meta: {
    scope: '武汉市',
    version: 'v2026Q1',
    source: '仿真：经济动态事件标注',
    simulated: true,
  },
};

function writeJson(dir, filename, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

for (const dir of outputTargets) {
  writeJson(dir, 'hourly-flow-timeseries.json', hourlyFlow);
  writeJson(dir, 'hourly-flow-daily-slices.json', hourlyFlowDailySlices);
  writeJson(dir, 'business-vitality-daily.json', businessDaily);
  writeJson(dir, 'economic-dynamic-events.json', economicEvents);
}

console.log(`Generated economic dynamics simulation data for ${units.length} units, ${days.length} days, ${hours.length} hours.`);
