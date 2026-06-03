import type { DataSourceId } from '@/types/gis';
import type { CityTimeseriesEntry } from '@/utils/overviewRegionStats';
import { factorAtMonth, vitalityAtMonth } from '@/utils/overviewRegionStats';
import { timeFactorFromPeriod } from '@/stores/gisState';

export type VitalityNormWeights = {
  foot: number;
  poi: number;
  acc: number;
  uav: number;
  useUav: boolean;
};

export type VitalityTopZone = {
  name: string;
  shortName: string;
  score: number;
  pct: number;
  uavBoost?: number;
  hotspot?: string;
};

function numProp(props: Record<string, unknown>, key: string, fallback: number): number {
  const v = Number(props[key]);
  return Number.isFinite(v) ? v : fallback;
}

export function dataSourceFactor(source: DataSourceId): number {
  if (source === 'v2026Q1') return 1.03;
  if (source === 'v2025Q4') return 0.97;
  return 1.0;
}

export function topicForDataSource(source: DataSourceId, runCount: number): string {
  if (source === 'demo-mix') return runCount % 2 === 0 ? '混编·集聚程度' : '混编·商业密度';
  if (source === 'v2025Q4') return '2025Q4 切片·活力格局';
  return runCount % 2 === 0 ? '商业分布密度' : '集聚程度';
}

type FactorBundle = { foot: number; poi: number; acc: number; composite: number };

function blendFactors(
  props: Record<string, unknown>,
  norm: VitalityNormWeights,
  opts: {
    districtName: string;
    timeseries: CityTimeseriesEntry[];
    timeSingle: string;
  },
): FactorBundle {
  const base = numProp(props, 'vitalityIdx', 50);
  let foot = numProp(props, 'footTrafficIdx', base * 0.92);
  let poi = numProp(props, 'poiActivityIdx', base * 0.88);
  let acc = numProp(props, 'trafficReachIdx', base * 0.95);

  const tsFoot = factorAtMonth(opts.timeseries, opts.districtName, opts.timeSingle, 'footTrafficIdx');
  const tsPoi = factorAtMonth(opts.timeseries, opts.districtName, opts.timeSingle, 'poiActivityIdx');
  const tsAcc = factorAtMonth(opts.timeseries, opts.districtName, opts.timeSingle, 'trafficReachIdx');
  if (tsFoot != null) foot = foot * 0.65 + tsFoot * 0.35;
  if (tsPoi != null) poi = poi * 0.65 + tsPoi * 0.35;
  if (tsAcc != null) acc = acc * 0.65 + tsAcc * 0.35;

  const wSum = norm.foot + norm.poi + norm.acc || 1;
  const composite = (foot * norm.foot + poi * norm.poi + acc * norm.acc) / wSum;
  return { foot, poi, acc, composite };
}

export function computeVitalityScore(
  props: Record<string, unknown>,
  norm: VitalityNormWeights,
  opts: {
    dataSource: DataSourceId;
    timeSingle: string;
    districtName: string;
    timeseries: CityTimeseriesEntry[];
    uavQualityBoost: number;
  },
): number {
  const base = numProp(props, 'vitalityIdx', 50);
  const { composite } = blendFactors(props, norm, opts);

  let score = base * 0.28 + composite * 0.52;

  const ts = vitalityAtMonth(opts.timeseries, opts.districtName, opts.timeSingle);
  if (ts != null) {
    score = score * 0.72 + ts * 0.28;
  }

  const weightBlend = 0.9 + 0.1 * ((norm.foot + norm.poi + norm.acc) / 3);
  score *= weightBlend * (0.96 + 0.04 * timeFactorFromPeriod()) * dataSourceFactor(opts.dataSource);

  if (norm.useUav) {
    score *= 1 + opts.uavQualityBoost * 0.12 * (0.45 + norm.uav * 0.55);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/** 格网单元：按所属区时序缩放 + 多因子得分（与行政区模型一致） */
export function computeGridVitalityScore(
  props: Record<string, unknown>,
  norm: VitalityNormWeights,
  opts: Parameters<typeof computeVitalityScore>[2],
): number {
  const districtName = String(props.districtName ?? opts.districtName);
  const refMonth = String(props.refMonth ?? '2026-04');
  const localRatio = Number(props.localRatio ?? 1);
  const refVit = vitalityAtMonth(opts.timeseries, districtName, refMonth);
  const monthVit = vitalityAtMonth(opts.timeseries, districtName, opts.timeSingle);
  const timeScale =
    refVit != null && monthVit != null && refVit > 0
      ? monthVit / refVit
      : monthVit != null && refVit == null
        ? monthVit / 50
        : 1;

  const scaledProps = { ...props };
  for (const key of [
    'vitalityIdx',
    'footTrafficIdx',
    'poiActivityIdx',
    'trafficReachIdx',
    'nightEconomyIdx',
    'consumePotential',
    'activityIdx',
    'inboundFlowIdx',
  ] as const) {
    const v = Number(props[key]);
    if (Number.isFinite(v)) {
      scaledProps[key] = Math.min(100, Math.max(0, Math.round(v * timeScale * (0.85 + 0.15 * localRatio))));
    }
  }

  return computeVitalityScore(scaledProps, norm, { ...opts, districtName });
}

/** 按当前区域样本与权重，计算数据驱动的因子贡献占比 */
export function computeFactorContrib(
  rows: Array<{ name: string; props: Record<string, unknown> }>,
  norm: VitalityNormWeights,
  opts: Parameters<typeof computeVitalityScore>[2],
): Array<{ name: string; pct: number }> {
  if (!rows.length) return [];
  let footSum = 0;
  let poiSum = 0;
  let accSum = 0;
  let uavSum = 0;
  for (const { name, props } of rows) {
    const f = blendFactors(props, norm, { ...opts, districtName: name });
    footSum += f.foot * norm.foot;
    poiSum += f.poi * norm.poi;
    accSum += f.acc * norm.acc;
    if (norm.useUav) uavSum += opts.uavQualityBoost * 100 * norm.uav;
  }
  const parts = norm.useUav
    ? [
        { name: '人流', v: footSum },
        { name: 'POI', v: poiSum },
        { name: '交通', v: accSum },
        { name: '无人机', v: uavSum },
      ]
    : [
        { name: '人流', v: footSum },
        { name: 'POI', v: poiSum },
        { name: '交通', v: accSum },
      ];
  const total = parts.reduce((a, p) => a + p.v, 0) || 1;
  return parts.map((p) => ({ name: p.name, pct: Math.round((100 * p.v) / total) }));
}

export function buildTopZones(
  features: Array<{ name: string; props: Record<string, unknown> }>,
  norm: VitalityNormWeights,
  opts: Parameters<typeof computeVitalityScore>[2],
  limit = 6,
  uavBoostByDistrict?: Record<string, number>,
): VitalityTopZone[] {
  const rows = features
    .map(({ name, props }) => ({
      name,
      shortName: name.replace(/区$/g, ''),
      score: computeVitalityScore(props, norm, { ...opts, districtName: name }),
      pct: 0,
      uavBoost: uavBoostByDistrict?.[name],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const top = rows[0]?.score || 1;
  return rows.map((r) => ({ ...r, pct: Math.round((100 * r.score) / top) }));
}

/** 将模型返回的热点排名转为行政区 uavBoost 查找表 */
export function uavBoostMapFromModelZones(
  zones: Array<{ name?: string; districtName?: string; uavBoost?: number }> | undefined,
  cityUnits: import('geojson').FeatureCollection | null,
): Record<string, number> {
  const map: Record<string, number> = {};
  if (!zones?.length) return map;
  for (const z of zones) {
    const boost = Number(z.uavBoost);
    if (!Number.isFinite(boost)) continue;
    const district = z.districtName ?? resolveDistrictFromZoneName(String(z.name ?? ''), cityUnits);
    if (district) map[district] = Math.max(map[district] ?? 0, boost);
  }
  return map;
}

function resolveDistrictFromZoneName(zoneName: string, cityUnits: import('geojson').FeatureCollection | null): string {
  if (!zoneName) return '';
  if (cityUnits?.features?.some((f) => String((f.properties as { name?: string })?.name ?? '') === zoneName)) {
    return zoneName;
  }
  const hints: Array<[RegExp, string]> = [
    [/江汉路|循礼门/, '江汉区'],
    [/武昌|黄鹤楼|徐东|岳家嘴|街道口|滨江/, '武昌区'],
    [/汉阳|钟家村|王家湾/, '汉阳区'],
    [/光谷|武汉东站|南湖/, '洪山区'],
    [/青山|工业更新/, '青山区'],
  ];
  for (const [re, district] of hints) {
    if (re.test(zoneName)) return district;
  }
  return zoneName.endsWith('区') ? zoneName : '';
}
