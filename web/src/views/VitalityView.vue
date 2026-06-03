<template>
  <div class="page vitality">
    <aside class="left panel">
      <h3 class="title">活力评估模型</h3>
      <div class="field">
        <div class="field-label">人流数据</div>
        <select v-model="gis.dataSource" class="input">
          <option value="v2026Q1">智眼型 v2026Q1（模拟切片）</option>
          <option value="v2025Q4">智眼型 v2025Q4（模拟切片）</option>
          <option value="demo-mix">混编·演示</option>
        </select>
      </div>
      <div class="field">
        <div class="field-label">时间（与导航栏一致）</div>
        <input v-model="gis.timeSingle" type="date" class="input" />
      </div>
      <div class="field">
        <div class="field-label">人流（原始 {{ wRef.foot }}）</div>
        <input v-model.number="wRef.foot" type="range" min="0" max="1" step="0.05" />
      </div>
      <div class="field">
        <div class="field-label">POI 商业（原始 {{ wRef.poi }}）</div>
        <input v-model.number="wRef.poi" type="range" min="0" max="1" step="0.05" />
      </div>
      <div class="field">
        <div class="field-label">交通（原始 {{ wRef.acc }}）</div>
        <input v-model.number="wRef.acc" type="range" min="0" max="1" step="0.05" />
      </div>
      <div class="field">
        <div class="field-label">无人机（原始 {{ wRef.uav }}）</div>
        <input v-model.number="wRef.uav" type="range" min="0" max="1" step="0.05" />
      </div>
      <p class="small">
        归一化后：人流 {{ pct(norm.foot) }} / POI {{ pct(norm.poi) }} / 交通 {{ pct(norm.acc) }} /
        无人机{{ norm.useUav ? pct(norm.uav) : '（未纳入）' }}
        <span v-if="gis.uavInVitalityModel" class="q">+ 低空数据精度加成 {{ (gis.uavQualityBoost * 100).toFixed(0) }}%</span>
      </p>
      <label class="check">
        <input v-model="gis.uavInVitalityModel" type="checkbox" />
        纳入无人机项（与「低空数据」页参与模型复选同步）
      </label>
      <div class="btns">
        <button type="button" class="btn btn-primary" :disabled="running" @click="run">
          {{ running ? '运行中…' : '重新运行 / 全量' }}
        </button>
        <button type="button" class="btn" @click="reset">重置</button>
        <button type="button" class="btn btn-ghost" :disabled="running" @click="rerunLocal">同参重算</button>
      </div>
      <p v-if="jobMessage" :class="['job', jobError ? 'err' : 'ok']">{{ jobMessage }}</p>
      <LayerTreePanel :layers="layers" />
      <div v-if="explain" class="exp panel small">
        <h4>解释与拆解</h4>
        <p>指标来源：按「智眼型」城市感知框架归类；实际为开放/模拟/低空占位数据，非政务智眼生产库。专题：「{{ resultTopic }}」。</p>
        <p v-if="gis.uavRoute">低空路径：{{ gis.uavRoute.name }}（{{ gis.uavRoute.district }}，质量 {{ gis.uavRoute.quality }}%）已作为精细尺度观测项参与解释。</p>
        <p>主因：{{ explain.main }}；次因：{{ explain.sub }}。</p>
      </div>
    </aside>
    <div class="map-wrap">
      <div ref="mapEl" class="map"></div>
      <div class="map-legend" aria-hidden="true">
        <span class="leg-title">综合活力</span>
        <div class="leg-bar" />
        <div class="leg-ticks"><span>低</span><span>高</span></div>
      </div>
    </div>
    <aside class="right panel">
      <h3 class="title">结果与分解</h3>
      <p class="muted">专题：<strong>{{ resultTopic }}</strong></p>
      <p class="muted">区域：<strong>{{ gis.region.label }}</strong> · 数据源 {{ dataSourceLabel }}</p>
      <p v-if="indexMean != null" class="kpi-mean">综合均值 <strong>{{ indexMean }}</strong> 分</p>
      <h4 class="h4">因子贡献</h4>
      <div v-for="c in contrib" :key="c.name" class="bar-row">
        <span class="name">{{ c.name }}</span>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: c.pct + '%' }" />
        </div>
        <span class="num">{{ c.pct }}%</span>
      </div>
      <h4 class="h4">武汉行政区排名 TOP6</h4>
      <div
        v-for="(b, idx) in topZones"
        :key="b.name"
        class="bar-row rank-row"
        :class="{ active: selectedZoneName === b.name }"
        role="button"
        tabindex="0"
        :title="'定位到 ' + b.name + (b.hotspot ? '（' + b.hotspot + '）' : '')"
        @click="focusZone(b)"
        @keydown.enter="focusZone(b)"
      >
        <span class="rank">{{ idx + 1 }}</span>
        <span class="name">
          {{ b.shortName }}
          <span v-if="b.hotspot" class="hotspot">{{ b.hotspot }}</span>
        </span>
        <div class="bar-track">
          <div class="bar-fill rank-fill" :style="{ width: b.pct + '%' }" />
        </div>
        <span class="num">
          {{ b.score }}
          <span v-if="b.uavBoost && gis.uavInVitalityModel" class="boost">+{{ Math.round(b.uavBoost * 100) }}%</span>
        </span>
      </div>
      <RegionStatsCard v-if="gis.region.mode !== 'all'" :stats="regionKpiStats" />
      <p class="muted small">拖动权重或切换数据源/时间后热力即时重绘；750m 格网展示精细尺度活力，行政区面可在图层树中开启。点击排名行可定位片区。</p>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import L from 'leaflet';
import LayerTreePanel from '@/components/LayerTreePanel.vue';
import RegionStatsCard from '@/components/RegionStatsCard.vue';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { vitalityFillColor, poiCategoryColor, poiInfluenceRadiusM, type PoiPointProperties } from '@/utils/mockHubeiDataset';
import { gisDataService } from '@/services/gisDataService';
import { vitalityLayerCatalog } from '@/config/layerCatalog';
import {
  gis,
  pushTask,
  updateTask,
  setVitalityResult,
  normalizeWeights,
} from '@/stores/gisState';
import type { VitalityResult } from '@/types/gis';
import type { FeatureCollection } from 'geojson';
import type { LayerItem } from '@/types/layer';
import {
  buildTopZones,
  computeFactorContrib,
  computeGridVitalityScore,
  computeVitalityScore,
  topicForDataSource,
  uavBoostMapFromModelZones,
  type VitalityNormWeights,
  type VitalityTopZone,
} from '@/utils/vitalityModel';
import {
  aggregateRegionKpis,
  districtMatchesRegion,
  findDistrictFeature,
  poiMatchesRegion,
  resolveZoneDistrictName,
  type CityTimeseriesEntry,
} from '@/utils/overviewRegionStats';

const DEFAULT_WEIGHTS = { foot: 0.35, poi: 0.3, acc: 0.25, uav: 0.1 };

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);
const layers = reactive<LayerItem[]>(JSON.parse(JSON.stringify(vitalityLayerCatalog)));

const cityUnitsFc = ref<FeatureCollection | null>(null);
const vitalityGridFc = ref<FeatureCollection | null>(null);
const cityTimeseries = ref<CityTimeseriesEntry[]>([]);
const poiFc = ref<FeatureCollection | null>(null);
const uavCoverages = ref<FeatureCollection | null>(null);
const uavRoutesFile = ref<Awaited<ReturnType<typeof gisDataService.getUavRoutes>> | null>(null);
const modelUavBoostMap = ref<Record<string, number>>({});

const wRef = ref({ ...DEFAULT_WEIGHTS });
const running = ref(false);
const jobMessage = ref('');
const jobError = ref(false);
const runCount = ref(0);
const resultTopic = ref('商业分布密度');
const lastId = ref('');
const selectedZoneName = ref<string | null>(null);

const norm = computed(() =>
  normalizeWeights({
    foot: wRef.value.foot,
    poi: wRef.value.poi,
    acc: wRef.value.acc,
    uav: wRef.value.uav,
    useUav: gis.uavInVitalityModel,
  }),
);

const dataSourceLabel = computed(() => {
  if (gis.dataSource === 'v2025Q4') return 'v2025Q4';
  if (gis.dataSource === 'demo-mix') return '混编演示';
  return 'v2026Q1';
});

function scoreContext() {
  return {
    dataSource: gis.dataSource,
    timeSingle: gis.timeSingle,
    timeseries: cityTimeseries.value,
    uavQualityBoost: gis.uavQualityBoost,
  };
}

function scoreForDistrict(props: Record<string, unknown>, districtName: string, n: VitalityNormWeights): number {
  return computeVitalityScore(props, n, { ...scoreContext(), districtName });
}

function scoreForGridCell(props: Record<string, unknown>, n: VitalityNormWeights): number {
  const districtName = String(props.districtName ?? '');
  return computeGridVitalityScore(props, n, { ...scoreContext(), districtName });
}

function layerItem(id: string): LayerItem | undefined {
  return layers.find((l) => l.id === id);
}

function regionDistrictRows() {
  const fc = cityUnitsFc.value;
  if (!fc?.features?.length) return [];
  return fc.features
    .map((f) => {
      const p = f.properties as Record<string, unknown> | null;
      if (!p) return null;
      const name = String(p.name ?? '—');
      if (!districtMatchesRegion(name, fc, gis.region)) return null;
      return { name, props: p };
    })
    .filter((x): x is { name: string; props: Record<string, unknown> } => x != null);
}

const topZones = computed((): VitalityTopZone[] => {
  const n = norm.value;
  const ctx = scoreContext();
  const rows = regionDistrictRows();
  if (rows.length) {
    const zones = buildTopZones(rows, n, ctx, 6, modelUavBoostMap.value);
    const hotspotByDistrict: Record<string, string> = {};
    for (const z of gis.vitality?.topZones ?? []) {
      const district = z.districtName ?? resolveZoneDistrictName(z.name, cityUnitsFc.value);
      if (district && z.hotspot) hotspotByDistrict[district] = z.hotspot;
      else if (district && z.name !== district) hotspotByDistrict[district] = z.name;
    }
    return zones.map((z) => ({
      ...z,
      hotspot: hotspotByDistrict[z.name],
      uavBoost: z.uavBoost ?? modelUavBoostMap.value[z.name],
    }));
  }
  const t = 0.96 + 0.04 * (gis.timeSingle ? 1 : 0.5);
  const base = runCount.value ? 58 * t : 52;
  return [
    { name: '江汉区', shortName: '江汉', score: Math.round(base + 12), pct: 100, hotspot: '江汉路-循礼门', uavBoost: 0.08 },
    { name: '洪山区', shortName: '洪山', score: Math.round(base + 8), pct: 92, hotspot: '光谷广场', uavBoost: 0.08 },
    { name: '武昌区', shortName: '武昌', score: Math.round(base + 4), pct: 88, hotspot: '武昌滨江', uavBoost: 0.08 },
    { name: '汉阳区', shortName: '汉阳', score: Math.round(base - 2), pct: 78, hotspot: '钟家村-王家湾', uavBoost: 0.08 },
    { name: '江岸区', shortName: '江岸', score: Math.round(base - 8), pct: 70 },
    { name: '青山区', shortName: '青山', score: Math.round(base - 14), pct: 64, hotspot: '青山滨江', uavBoost: 0.03 },
  ];
});

const indexMean = computed(() => {
  const fc = cityUnitsFc.value;
  const n = norm.value;
  if (!fc?.features?.length) return gis.vitality?.indexMean ?? null;
  const scores: number[] = [];
  for (const f of fc.features) {
    const p = f.properties as Record<string, unknown> | null;
    if (!p) continue;
    const name = String(p.name ?? '');
    if (!districtMatchesRegion(name, fc, gis.region)) continue;
    scores.push(scoreForDistrict(p, name, n));
  }
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
});

const contrib = computed(() => {
  const rows = regionDistrictRows();
  if (rows.length) {
    return computeFactorContrib(rows, norm.value, scoreContext());
  }
  const n = norm.value;
  const u = n.useUav
    ? [
        { name: '人流', pct: Math.round(100 * n.foot) },
        { name: 'POI', pct: Math.round(100 * n.poi) },
        { name: '交通', pct: Math.round(100 * n.acc) },
        { name: '无人机', pct: Math.round(100 * n.uav) },
      ]
    : [
        { name: '人流', pct: Math.round(100 * n.foot) },
        { name: 'POI', pct: Math.round(100 * n.poi) },
        { name: '交通', pct: Math.round(100 * n.acc) },
      ];
  const s = u.reduce((a, c) => a + c.pct, 0);
  if (s <= 0) return u;
  return u.map((c) => ({ ...c, pct: Math.round((c.pct / s) * 100) }));
});

const regionKpiStats = computed(() => {
  if (!poiFc.value?.features?.length) return null;
  return aggregateRegionKpis(
    poiFc.value.features.filter((f) => f.geometry?.type === 'Point') as import('geojson').Feature<import('geojson').Point>[],
    gis.region,
    cityUnitsFc.value,
    gis.uavInVitalityModel,
  );
});

const explain = computed(() => {
  const c = [...contrib.value].sort((a, b) => b.pct - a.pct);
  if (!c.length) return null;
  return { main: `${c[0]!.name}（${c[0]!.pct}%）`, sub: `${c[1]!.name} / ${c[2]?.name || '其他'}` };
});

function pct(x: number) {
  return (x * 100).toFixed(1) + '%';
}

function restoreWeightsFromResult(v: VitalityResult) {
  wRef.value = {
    foot: v.weights.foot,
    poi: v.weights.poi,
    acc: v.weights.acc,
    uav: v.weights.uav,
  };
  gis.uavInVitalityModel = v.weights.useUav;
  resultTopic.value = v.topic;
}

function persistLocalVitalityResult() {
  const res: VitalityResult = {
    updatedAt: new Date().toISOString(),
    topic: resultTopic.value,
    topZones: topZones.value.map(({ name, score, pct: p, uavBoost, hotspot }) => ({
      name,
      score,
      pct: p,
      uavBoost,
      hotspot,
      districtName: name,
    })),
    indexMean: indexMean.value ?? 0,
    weights: {
      foot: wRef.value.foot,
      poi: wRef.value.poi,
      acc: wRef.value.acc,
      uav: wRef.value.uav,
      useUav: gis.uavInVitalityModel,
    },
  };
  setVitalityResult(res);
}

function reset() {
  wRef.value = { ...DEFAULT_WEIGHTS };
  gis.uavInVitalityModel = true;
  jobMessage.value = '已恢复默认权重与图层设置。';
  jobError.value = false;
  runCount.value = 0;
  selectedZoneName.value = null;
  resultTopic.value = topicForDataSource(gis.dataSource, 0);
  const defaults = JSON.parse(JSON.stringify(vitalityLayerCatalog)) as LayerItem[];
  layers.splice(0, layers.length, ...defaults);
  persistLocalVitalityResult();
  syncAllMapLayers();
}

function rerunLocal() {
  running.value = true;
  jobError.value = false;
  const id = pushTask({ name: '经济活力（同参重算）', page: 'vitality' });
  lastId.value = id;
  window.setTimeout(() => {
    resultTopic.value = topicForDataSource(gis.dataSource, runCount.value + 1);
    runCount.value += 1;
    persistLocalVitalityResult();
    updateTask(id, {
      status: 'success',
      message: '同参数本地重算完成',
      finishedAt: new Date().toISOString(),
    });
    jobMessage.value = '同参重算：已按当前权重、时序与区域本地更新，未调用后端。';
    running.value = false;
    syncAllMapLayers();
  }, 380);
}

function run() {
  running.value = true;
  jobMessage.value = '';
  jobError.value = false;
  const id = pushTask({ name: '经济活力', page: 'vitality' });
  lastId.value = id;
  const weights = {
    flow: wRef.value.foot,
    poi: wRef.value.poi,
    traffic: wRef.value.acc,
    uav: gis.uavInVitalityModel ? wRef.value.uav : 0,
  };
  gisDataService
    .runVitalityModel({
      dataSource: gis.dataSource,
      time: gis.timeSingle,
      region: gis.region.label,
      weights,
      uavRoutes: gis.uavRoute ? [gis.uavRoute.id] : [],
    })
    .then((model) => {
      updateTask(id, { status: 'success', message: '后端模型完成，结果已写全局。', finishedAt: new Date().toISOString() });
      runCount.value += 1;
      resultTopic.value =
        model.taskType === 'vitality_assessment'
          ? model.result?.explanation?.slice(0, 12) ?? '后端活力模型'
          : topicForDataSource(gis.dataSource, runCount.value);
      const modelTop = model.result?.topZones
        ?.filter((zone) => zone.name && Number.isFinite(Number(zone.score)))
        .slice(0, 6)
        .map((zone) => ({
          name: String(zone.name),
          districtName: zone.districtName ?? resolveZoneDistrictName(String(zone.name), cityUnitsFc.value),
          hotspot: zone.hotspot ?? String(zone.name),
          score: Math.round(Number(zone.score)),
          pct: Math.round((Number(zone.score) / Math.max(Number(model.result?.topZones?.[0]?.score ?? 100), 1)) * 100),
          uavBoost: zone.uavBoost != null ? Number(zone.uavBoost) : undefined,
        }));
      modelUavBoostMap.value = uavBoostMapFromModelZones(model.result?.topZones, cityUnitsFc.value);
      jobMessage.value = model.result?.explanation ?? '分析完成。全局状态已更新。';
      const localTop = topZones.value.map(({ name, shortName, score, pct: p, uavBoost, hotspot }) => ({
        name,
        shortName,
        score,
        pct: p,
        uavBoost,
        hotspot,
        districtName: name,
      }));
      const res: VitalityResult = {
        updatedAt: model.finishedAt ?? new Date().toISOString(),
        topic: resultTopic.value,
        topZones: localTop.length ? localTop : (modelTop ?? []),
        indexMean: Math.round(Number(model.result?.indexMean ?? indexMean.value ?? 0)),
        weights: {
          foot: wRef.value.foot,
          poi: wRef.value.poi,
          acc: wRef.value.acc,
          uav: wRef.value.uav,
          useUav: gis.uavInVitalityModel,
        },
      };
      setVitalityResult(res);
      syncAllMapLayers();
    })
    .catch((e) => {
      jobError.value = true;
      jobMessage.value = '后端模型调用失败，已保留本地热力结果。';
      updateTask(id, {
        status: 'error',
        message: e instanceof Error ? e.message : '模型接口失败',
        errorCode: 'MODEL_API_FAILED',
        finishedAt: new Date().toISOString(),
      });
      persistLocalVitalityResult();
      syncAllMapLayers();
    })
    .finally(() => {
      running.value = false;
    });
}

function focusZone(zone: { name: string; hotspot?: string }) {
  const districtName = resolveZoneDistrictName(zone.name, cityUnitsFc.value);
  selectedZoneName.value = districtName;
  const map = mapInstance.value;
  if (!map) return;
  const feat = findDistrictFeature(cityUnitsFc.value, districtName);
  if (feat) {
    syncSelectedZoneHighlight();
    try {
      const bounds = L.geoJSON(feat).getBounds();
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } catch {
      /* ignore */
    }
    jobMessage.value = zone.hotspot ? `已定位 ${districtName}（${zone.hotspot}）` : `已定位 ${districtName}`;
    jobError.value = false;
    return;
  }
  jobMessage.value = `未找到「${districtName}」边界，已高亮排名项。`;
}

let vitalityLayer: L.LayerGroup | null = null;
let vitalityGridLayer: L.GeoJSON | null = null;
let poiLayer: L.LayerGroup | null = null;
let zhiyanLayer: L.LayerGroup | null = null;
let uavFactorLayer: L.LayerGroup | null = null;
let regionLayer: L.LayerGroup | null = null;
let adminHighlightLayer: L.GeoJSON | null = null;
let selectedZoneLayer: L.GeoJSON | null = null;

function removeMapLayer(layer: L.Layer | null) {
  const map = mapInstance.value;
  if (map && layer) map.removeLayer(layer);
}

function tierStrokeWeight(tier: unknown): number {
  const t = Number(tier);
  if (t === 1) return 2.4;
  if (t === 2) return 1.8;
  if (t === 3) return 1.35;
  return 1;
}

function popupHtml(props: Record<string, unknown>, effScore: number): string {
  const row = (k: string, v: string | number) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;font-size:12px;"><span style="opacity:.85">${k}</span><b style="color:#38bdf8">${v}</b></div>`;
  const name = String(props.name ?? '—');
  const tier = props.tierLabel ? String(props.tierLabel) : '';
  return `<div style="min-width:200px;color:#e2e8f0;line-height:1.35;">
    <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid rgba(148,163,184,.35);padding-bottom:4px;">${name}</div>
    ${tier ? `<div style="font-size:11px;opacity:.8;margin-bottom:6px;">${tier}</div>` : ''}
    ${row('综合活力（当前权重）', effScore)}
    ${row('基础指数', Number(props.vitalityIdx ?? '—'))}
    ${row('人流指数', Number(props.footTrafficIdx ?? '—'))}
    ${row('POI 活跃', Number(props.poiActivityIdx ?? '—'))}
    ${row('交通可达', Number(props.trafficReachIdx ?? '—'))}
    ${row('夜经济', Number(props.nightEconomyIdx ?? '—'))}
    ${row('消费潜力', Number(props.consumePotential ?? '—'))}
    ${row('客流吸引', Number(props.inboundFlowIdx ?? '—'))}
    <div style="font-size:10px;opacity:.65;margin-top:6px;">${gis.region.label} · ${dataSourceLabel.value}</div>
  </div>`;
}

function gridPopupHtml(props: Record<string, unknown>, effScore: number): string {
  const row = (k: string, v: string | number) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;font-size:12px;"><span style="opacity:.85">${k}</span><b style="color:#38bdf8">${v}</b></div>`;
  const title = props.hotspotLabel ? String(props.hotspotLabel) : String(props.districtName ?? '格网单元');
  const sub = props.hotspotLabel ? `${props.districtName ?? ''} · ${props.gridId ?? ''}` : String(props.gridId ?? '');
  return `<div style="min-width:210px;color:#e2e8f0;line-height:1.35;">
    <div style="font-weight:600;margin-bottom:4px;border-bottom:1px solid rgba(148,163,184,.35);padding-bottom:4px;">${title}</div>
    ${sub ? `<div style="font-size:10px;opacity:.75;margin-bottom:6px;">${sub}</div>` : ''}
    ${row('综合活力（当前权重）', effScore)}
    ${row('格网基期活力', Number(props.vitalityIdx ?? '—'))}
    ${row('人流', `${props.footTrafficIdx ?? '—'} · ${props.flowLevel ?? '—'}`)}
    ${row('POI 活跃', Number(props.poiActivityIdx ?? '—'))}
    ${row('交通可达', Number(props.trafficReachIdx ?? '—'))}
    ${row('活力等级', `${props.vitalityClass ?? '—'} 级`)}
    ${row('POI 密度', Number(props.poiDensityNorm ?? 0))}
    <div style="font-size:10px;opacity:.65;margin-top:6px;">${gis.region.label} · ${dataSourceLabel.value}</div>
  </div>`;
}

function syncVitalityGridLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(vitalityGridLayer);
  vitalityGridLayer = null;
  const po = layerItem('vitality-grid');
  if (!po?.visible || !vitalityGridFc.value?.features?.length) return;

  const n = norm.value;
  const fc = cityUnitsFc.value;
  const op = po.opacity ?? 0.78;
  const regionFiltered = gis.region.mode !== 'all' && gis.region.adminName !== '武汉市（全市）';
  const gridRenderer = L.canvas({ padding: 0.5 });

  vitalityGridLayer = L.geoJSON(vitalityGridFc.value, {
    renderer: gridRenderer,
    style: (feat) => {
      const p = feat.properties as Record<string, unknown> | undefined;
      const districtName = String(p?.districtName ?? '');
      const inRegion = districtMatchesRegion(districtName, fc, gis.region);
      const eff = p ? scoreForGridCell(p, n) : 50;
      const dim = regionFiltered && !inRegion;
      const selected = selectedZoneName.value === districtName;
      return {
        fillColor: vitalityFillColor(eff),
        fillOpacity: dim ? 0.04 : 0.12 + 0.32 * op,
        color: selected ? 'rgba(251,191,36,0.85)' : 'rgba(15,23,42,0.25)',
        weight: selected ? 1.2 : 0.35,
      };
    },
    onEachFeature: (feat, layer) => {
      const p = feat.properties as Record<string, unknown> | undefined;
      if (!p) return;
      const eff = scoreForGridCell(p, n);
      layer.bindPopup(gridPopupHtml(p, eff), { maxWidth: 300, className: 'gis-city-popup' });
      layer.on('click', () => {
        selectedZoneName.value = String(p.districtName ?? '');
        syncSelectedZoneHighlight();
      });
    },
  }).addTo(map);
}

function syncVitalityLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(vitalityLayer);
  vitalityLayer = null;
  const po = layerItem('vitality-model');
  if (!po?.visible) return;

  const n = norm.value;
  const fc = cityUnitsFc.value;
  const op = po.opacity ?? 0.7;
  const g = L.layerGroup();
  const regionFiltered = gis.region.mode !== 'all' && gis.region.adminName !== '武汉市（全市）';

  if (fc?.features?.length) {
    L.geoJSON(fc, {
      style: (feat) => {
        const p = feat.properties as Record<string, unknown> | undefined;
        const name = String(p?.name ?? '');
        const inRegion = districtMatchesRegion(name, fc, gis.region);
        const eff = p ? scoreForDistrict(p, name, n) : 50;
        const selected = selectedZoneName.value === name;
        const dim = regionFiltered && !inRegion;
        const tw = tierStrokeWeight(p?.tier);
        return {
          fillColor: vitalityFillColor(eff),
          fillOpacity: dim ? 0.08 : (0.22 + 0.38 * op) * (0.85 + 0.15 * n.foot),
          color: selected ? '#fbbf24' : dim ? 'rgba(100,116,139,0.5)' : 'rgba(148,163,184,0.95)',
          weight: selected ? tw + 1.2 : tw,
        };
      },
      onEachFeature: (feat, layer) => {
        const p = feat.properties as Record<string, unknown> | undefined;
        if (!p) return;
        const name = String(p.name ?? '');
        const eff = scoreForDistrict(p, name, n);
        layer.bindPopup(popupHtml(p, eff), { maxWidth: 280, className: 'gis-city-popup' });
        layer.on('click', () => {
          selectedZoneName.value = name;
          syncSelectedZoneHighlight();
        });
      },
    }).addTo(g);
  }
  g.addTo(map);
  vitalityLayer = g;
}

function syncPoiLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(poiLayer);
  poiLayer = null;
  const po = layerItem('vitality-poi');
  if (!po?.visible || !poiFc.value?.features?.length) return;

  const g = L.layerGroup();
  const poiRenderer = L.canvas({ padding: 0.5 });
  const op = po.opacity ?? 0.85;

  for (const feat of poiFc.value.features) {
    if (feat.geometry?.type !== 'Point') continue;
    const coords = feat.geometry.coordinates as [number, number];
    const latlng = L.latLng(coords[1], coords[0]);
    const p = (feat.properties ?? {}) as PoiPointProperties;
    if (!poiMatchesRegion(coords[0], coords[1], p, gis.region, cityUnitsFc.value)) continue;

    const col = poiCategoryColor(p.categoryKey ?? '');
    const inflM = poiInfluenceRadiusM(p);
    const popupHtml = `<div style="font-size:12px;"><strong>${p.name ?? ''}</strong><br/><span style="opacity:.85">${p.category ?? ''}</span> · ${p.districtName ?? ''}</div>`;

    L.circle(latlng, {
      radius: inflM,
      renderer: poiRenderer,
      color: col,
      weight: 1,
      fillColor: col,
      fillOpacity: 0.08 * op,
      opacity: 0.45 * op,
    })
      .bindPopup(popupHtml)
      .addTo(g);

    L.circleMarker(latlng, {
      radius: 3 + Math.round((p.importance ?? 0.55) * 5),
      renderer: poiRenderer,
      color: col,
      fillColor: col,
      fillOpacity: 0.85 * op,
      weight: 1,
    })
      .bindPopup(popupHtml)
      .addTo(g);
  }
  g.addTo(map);
  poiLayer = g;
}

async function syncZhiyanLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(zhiyanLayer);
  zhiyanLayer = null;
  const po = layerItem('vitality-zhiyan');
  if (!po?.visible) return;

  try {
    const fc = await gisDataService.getZhiyanObservations();
    const op = po.opacity ?? 0.75;
    const g = L.layerGroup();
    for (const feat of fc.features) {
      if (feat.geometry?.type !== 'Point') continue;
      const [lng, lat] = feat.geometry.coordinates;
      const p = feat.properties as { name?: string; flowIndex?: number; anomalyScore?: number };
      const r = 4 + Math.round((p.flowIndex ?? 50) / 15);
      L.circleMarker([lat, lng], {
        radius: r,
        color: '#a855f7',
        fillColor: '#c084fc',
        fillOpacity: 0.85 * op,
        weight: 1,
      })
        .bindPopup(`<strong>${p.name ?? '智眼观测'}</strong><br/>客流 ${p.flowIndex ?? '—'} · 异常 ${p.anomalyScore ?? '—'}`)
        .addTo(g);
    }
    g.addTo(map);
    zhiyanLayer = g;
  } catch {
    /* ignore */
  }
}

function syncUavFactorLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(uavFactorLayer);
  uavFactorLayer = null;
  const po = layerItem('uav-factor');
  if (!po?.visible || !gis.uavInVitalityModel) return;

  const op = po.opacity ?? 0.55;
  const g = L.layerGroup();

  if (uavCoverages.value?.features?.length) {
    L.geoJSON(uavCoverages.value, {
      style: {
        color: '#22d3ee',
        weight: 2,
        fillColor: '#06b6d4',
        fillOpacity: 0.12 * op,
        dashArray: '4 6',
      },
      onEachFeature: (feat, lyr) => {
        const p = feat.properties as Record<string, unknown>;
        const q = Number(p.quality ?? p.coverageQuality ?? 80);
        lyr.bindPopup(
          `<strong>${p.routeName ?? '无人机覆盖'}</strong><br/>${p.district ?? ''}<br/>质量 ${q}%`,
        );
      },
    }).addTo(g);
  }

  if (gis.uavRoute || uavRoutesFile.value?.routes?.length) {
    const routes = uavRoutesFile.value?.routes ?? [];
    const route = gis.uavRoute
      ? routes.find((r) => r.id === gis.uavRoute?.id) ?? routes[0]
      : routes.find((r) => r.model) ?? routes[0];
    if (route?.waypoints?.length) {
      L.polyline(route.waypoints, {
        color: '#38bdf8',
        weight: 3,
        opacity: 0.85 * op,
        dashArray: '8 6',
      })
        .bindPopup(`<strong>${route.name}</strong><br/>质量 ${route.quality}%`)
        .addTo(g);
    }
  }

  g.addTo(map);
  uavFactorLayer = g;
}

function syncRegionOverlays() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(regionLayer);
  regionLayer = null;
  const g = L.layerGroup();
  if (gis.region.mode === 'point' && gis.region.point) {
    const c = gis.region.point;
    L.circle([c.lat, c.lng], { radius: 1000, color: '#3dd68c', fillOpacity: 0.1, weight: 2 }).addTo(g);
    L.circleMarker([c.lat, c.lng], { radius: 5, color: '#3dd68c', fillColor: '#3dd68c' }).addTo(g);
  } else if (gis.region.mode === 'box' && gis.region.box) {
    const b = gis.region.box;
    L.rectangle(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      { color: '#f5a623', weight: 2, fillOpacity: 0.08 },
    ).addTo(g);
  }
  g.addTo(map);
  regionLayer = g;
}

function syncAdminHighlight() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(adminHighlightLayer);
  adminHighlightLayer = null;
  if (gis.region.mode !== 'admin' || gis.region.adminName === '武汉市（全市）') return;
  const feat = findDistrictFeature(cityUnitsFc.value, gis.region.adminName);
  if (!feat) return;
  adminHighlightLayer = L.geoJSON(feat, {
    style: {
      fillColor: '#38bdf8',
      fillOpacity: 0.06,
      color: '#38bdf8',
      weight: 3,
      dashArray: '6 4',
    },
  }).addTo(map);
}

function syncSelectedZoneHighlight() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(selectedZoneLayer);
  selectedZoneLayer = null;
  if (!selectedZoneName.value) return;
  const feat = findDistrictFeature(cityUnitsFc.value, selectedZoneName.value);
  if (!feat) return;
  selectedZoneLayer = L.geoJSON(feat, {
    style: {
      fillColor: '#fbbf24',
      fillOpacity: 0.12,
      color: '#fbbf24',
      weight: 3,
    },
  }).addTo(map);
}

function syncAllMapLayers() {
  syncRegionOverlays();
  syncAdminHighlight();
  syncVitalityGridLayer();
  syncVitalityLayer();
  syncPoiLayer();
  void syncZhiyanLayer();
  syncUavFactorLayer();
  syncSelectedZoneHighlight();
}

onMounted(async () => {
  try {
    const [units, grid, tsRaw, latest, cov, routes, poi] = await Promise.all([
      gisDataService.getCityUnits(),
      gisDataService.getVitalityGrid().catch(() => null),
      gisDataService.getCityTimeseries(),
      gisDataService.getLatestVitalityModel().catch(() => null),
      gisDataService.getUavCoverages().catch(() => null),
      gisDataService.getUavRoutes().catch(() => null),
      gisDataService.getPoiSample().catch(() => null),
    ]);
    cityUnitsFc.value = units;
    vitalityGridFc.value = grid;
    const tsBody = tsRaw as { cities?: CityTimeseriesEntry[] };
    cityTimeseries.value = tsBody.cities ?? [];
    uavCoverages.value = cov;
    uavRoutesFile.value = routes;
    poiFc.value = poi;

    if (gis.vitality) {
      restoreWeightsFromResult(gis.vitality);
      modelUavBoostMap.value = uavBoostMapFromModelZones(gis.vitality.topZones, cityUnitsFc.value);
      runCount.value = 1;
    } else if (latest?.result) {
      resultTopic.value = latest.result.explanation?.slice(0, 16) ?? '后端活力模型';
      modelUavBoostMap.value = uavBoostMapFromModelZones(latest.result.topZones, cityUnitsFc.value);
      if (latest.result.indexMean != null) {
        setVitalityResult({
          updatedAt: latest.finishedAt ?? new Date().toISOString(),
          topic: resultTopic.value,
          topZones:
            latest.result.topZones?.slice(0, 6).map((z, i, arr) => ({
              name: z.districtName ?? resolveZoneDistrictName(String(z.name), cityUnitsFc.value),
              districtName: z.districtName ?? resolveZoneDistrictName(String(z.name), cityUnitsFc.value),
              hotspot: z.hotspot ?? String(z.name),
              score: Math.round(Number(z.score)),
              pct: Math.round((Number(z.score) / Math.max(Number(arr[0]?.score ?? 100), 1)) * 100),
              uavBoost: z.uavBoost != null ? Number(z.uavBoost) : undefined,
            })) ?? [],
          indexMean: Math.round(Number(latest.result.indexMean)),
          weights: { ...DEFAULT_WEIGHTS, useUav: true },
        });
        runCount.value = 1;
      }
    } else {
      resultTopic.value = topicForDataSource(gis.dataSource, 0);
    }
    syncAllMapLayers();
  } catch (e) {
    console.warn('[GIS] 经济活力页数据加载失败', e);
    syncAllMapLayers();
  }
});

watch(
  [
    norm,
    mapInstance,
    cityUnitsFc,
    vitalityGridFc,
    cityTimeseries,
    poiFc,
    uavCoverages,
    () => wRef.value.foot,
    () => wRef.value.poi,
    () => wRef.value.acc,
    () => wRef.value.uav,
    () => gis.dataSource,
    () => gis.timeSingle,
    () => gis.uavInVitalityModel,
    () => gis.uavQualityBoost,
    () => gis.region.mode,
    () => gis.region.adminName,
    () => gis.region.point,
    () => gis.region.box,
    () => gis.uavRoute?.id,
    uavRoutesFile,
    layers,
    selectedZoneName,
  ],
  () => {
    if (mapInstance.value) syncAllMapLayers();
  },
  { deep: true },
);

watch(
  () => gis.dataSource,
  () => {
    if (runCount.value === 0) resultTopic.value = topicForDataSource(gis.dataSource, 0);
  },
);

watch(mapInstance, (m) => {
  if (m) syncAllMapLayers();
});
</script>

<style scoped>
.page {
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 8px;
  gap: 8px;
}
.left,
.right {
  width: 280px;
  flex-shrink: 0;
  padding: 12px;
  overflow: auto;
}
.title {
  margin: 0 0 12px;
  font-size: 15px;
}
.h4 {
  margin: 12px 0 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.field {
  margin-bottom: 12px;
}
.field-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.input {
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-deep);
  color: var(--text);
}
.small {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-muted);
  margin: 0 0 10px;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 12px;
}
.btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.job {
  font-size: 12px;
  margin-top: 10px;
}
.job.ok {
  color: var(--success);
}
.job.err {
  color: var(--danger);
}
.map-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.map {
  flex: 1;
  min-height: 0;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.map-legend {
  position: absolute;
  bottom: 14px;
  left: 14px;
  z-index: 1000;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.35);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
.leg-title {
  display: block;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.leg-bar {
  height: 10px;
  width: 160px;
  border-radius: 4px;
  background: linear-gradient(90deg, #1d4ed8, #38bdf8, #fbbf24, #f97316);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.leg-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 4px;
}
.muted {
  color: var(--text-muted);
  font-size: 13px;
}
.muted.small {
  font-size: 11px;
  margin-top: 12px;
  line-height: 1.4;
}
.kpi-mean {
  margin: 8px 0;
  font-size: 14px;
  color: var(--text);
}
.kpi-mean strong {
  font-size: 22px;
  color: var(--accent-hot);
  margin-left: 4px;
}
.bar-row {
  display: grid;
  grid-template-columns: 64px 1fr 32px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}
.rank-row {
  grid-template-columns: 22px minmax(0, 1fr) 1fr 40px;
  cursor: pointer;
  border-radius: 6px;
  padding: 2px 4px;
  margin-left: -4px;
  transition: background 0.15s;
}
.rank-row:hover,
.rank-row.active {
  background: rgba(56, 189, 248, 0.12);
}
.rank-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.rank {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  opacity: 0.9;
}
.rank-row .name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hotspot {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
}
.boost {
  display: block;
  font-size: 9px;
  color: #22d3ee;
  font-weight: 500;
}
.rank-fill {
  background: linear-gradient(90deg, #0ea5e9, #a855f7 55%, #f97316);
}
.bar-track {
  height: 8px;
  background: var(--bg-deep);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #1f5f9a, var(--accent));
}
.num {
  text-align: right;
  color: var(--accent-hot);
}
.exp {
  margin-top: 10px;
  padding: 8px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text);
}
.exp h4 {
  margin: 0 0 4px;
  font-size: 12px;
}
.q {
  color: var(--accent);
}
</style>
