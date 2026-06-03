<template>
  <div class="page districts">
    <div ref="mapEl" class="map"></div>
    <aside class="side panel">
      <h3 class="title">商圈识别</h3>
      <div class="field">
        <div class="field-label">空间聚类阈值</div>
        <input v-model.number="threshold" type="range" min="1" max="20" step="1" />
        <span class="val">{{ threshold }}</span>
      </div>
      <div class="field">
        <div class="field-label">最小 POI 数</div>
        <input v-model.number="minPoi" type="number" min="3" max="50" class="input" />
      </div>
      <div class="field">
        <div class="field-label">POI 类别筛选（影响结果）</div>
        <label v-for="c in poiCats" :key="c.id" class="check">
          <input v-model="c.on" type="checkbox" @change="onPoiFilter" />
          {{ c.name }}
        </label>
      </div>
      <div class="field">
        <div class="field-label">商圈 2 选 1 对比</div>
        <select v-model="cmpA" class="input">
          <option v-for="z in zoneList" :key="z.id + 'a'" :value="z.id">{{ z.name }}</option>
        </select>
        <select v-model="cmpB" class="input" style="margin-top: 6px">
          <option v-for="z in zoneList" :key="z.id + 'b'" :value="z.id">{{ z.name }}</option>
        </select>
        <p v-if="cmpA && cmpB" class="cmp">人流：{{ cmpText.flow }}；业态：{{ cmpText.poi }}；活力：{{ cmpText.v }}</p>
      </div>
      <button type="button" class="btn btn-primary" :disabled="running" @click="run">
        {{ running ? '识别中…' : '执行识别' }}
      </button>
      <button type="button" class="btn btn-ghost" :disabled="running" @click="rerunLocal">同参重算</button>
      <button type="button" class="btn" :disabled="running" @click="reset">重置</button>
      <p v-if="jobMessage" :class="['job', jobError ? 'err' : 'ok']">{{ jobMessage }}</p>
      <p class="muted">运行记录：{{ history }}</p>
      <RouterLink
        class="link"
        :to="{ name: 'population', query: gisToQuery() }"
      >
        带区域前往人口与消费 →
      </RouterLink>
      <button type="button" class="btn btn-ghost" @click="exportSvg">导出结构图</button>
      <LayerTreePanel :layers="layers" />
    </aside>
    <aside class="list-panel panel">
      <h3 class="title">商圈排名</h3>
      <div v-if="activeCard" class="cardx panel">
        <strong>{{ activeCard.name }}</strong>
        <span>人流：{{ activeCard.flow }}</span>
        <span>活力等级：{{ activeCard.level }}</span>
        <span>业态：{{ activeCard.poiStr }}</span>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>名称</th>
            <th>置信度</th>
            <th>人流</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(z, idx) in zoneList"
            :key="z.id"
            :class="{ active: highlight === idx }"
            role="button"
            tabindex="0"
            @click="highlightZone(idx)"
            @keydown.enter="highlightZone(idx)"
          >
            <td>{{ z.name }}</td>
            <td>{{ z.conf.toFixed(2) }}</td>
            <td>{{ z.flow }}</td>
          </tr>
        </tbody>
      </table>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import L from 'leaflet';
import LayerTreePanel from '@/components/LayerTreePanel.vue';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { poiCategoryColor } from '@/utils/mockHubeiDataset';
import {
  clusterPoisToDistricts,
  mergeClustersWithModel,
  type PoiCluster,
  type DistrictZoneSummary,
} from '@/utils/poiDistrictClusters';
import { gis, gisToQuery, setDistrictSummaries, pushTask, updateTask, type DistrictSummary } from '@/stores/gisState';
import { districtLayerCatalog } from '@/config/layerCatalog';
import { gisDataService, type DistrictModelResult } from '@/services/gisDataService';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import type { LayerItem } from '@/types/layer';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);
const layers = reactive<LayerItem[]>(JSON.parse(JSON.stringify(districtLayerCatalog)));

/** 与 generate-hubei-mock-datasets.mjs / poi-sample.geojson meta.categoryKeys 一致 */
const DEFAULT_THRESHOLD = 8;
const DEFAULT_MIN_POI = 12;
const DEFAULT_POI_CATS = [
  { id: 'retail', name: '零售', on: true },
  { id: 'food', name: '餐饮', on: true },
  { id: 'office', name: '办公', on: true },
  { id: 'life', name: '生活', on: false },
  { id: 'culture', name: '文体', on: false },
  { id: 'hotel', name: '住宿', on: false },
  { id: 'finance', name: '金融', on: false },
];

const threshold = ref(DEFAULT_THRESHOLD);
const minPoi = ref(DEFAULT_MIN_POI);
const poiCats = ref(JSON.parse(JSON.stringify(DEFAULT_POI_CATS)) as typeof DEFAULT_POI_CATS);
const running = ref(false);
const jobMessage = ref('');
const jobError = ref(false);
const history = ref('—');
const highlight = ref(0);
const activeCard = ref<{
  name: string;
  flow: string;
  level: string;
  poiStr: string;
} | null>(null);
const cmpA = ref('1');
const cmpB = ref('2');

const poiClusters = ref<PoiCluster[]>([]);
const mapClusters = ref<PoiCluster[]>([]);
const zoneColors = ['#3dd68c', '#3d9cf5', '#f5a623', '#a78bfa', '#38bdf8', '#fb7185', '#4ade80', '#f472b6'];
const zoneList = ref<DistrictSummary[]>([]);
const poiSampleFc = ref<FeatureCollection<Point> | null>(null);
const poiInfluenceFc = ref<FeatureCollection<Polygon> | null>(null);
const latestModel = ref<DistrictModelResult | null>(null);
let districtLayer: L.LayerGroup | null = null;
let poiLayer: L.LayerGroup | null = null;
let influenceLayer: L.Layer | null = null;

const activeOn = computed(() => poiCats.value.filter((c) => c.on).length);

const cmpText = computed(() => {
  const a = zoneList.value.find((z) => z.id === cmpA.value);
  const b = zoneList.value.find((z) => z.id === cmpB.value);
  if (!a || !b) return { flow: '—', poi: '—', v: '—' };
  const poiA = a.poiStr ?? '—';
  const poiB = b.poiStr ?? '—';
  return {
    flow: a.flow === b.flow ? '相近' : `${a.flow} vs ${b.flow}`,
    poi: poiA === poiB ? poiA : `${poiA} vs ${poiB}`,
    v: a.level === b.level ? a.level : `${a.level} vs ${b.level}`,
  };
});

function layerItem(id: string): LayerItem | undefined {
  return layers.find((l) => l.id === id);
}

function displayClusters(): PoiCluster[] {
  return mapClusters.value.length ? mapClusters.value : poiClusters.value;
}

function syncCompareIds() {
  gis.compareDistrictIds = [cmpA.value, cmpB.value].filter(Boolean);
}

function applyZoneList() {
  const modelRows = modelDistrictsToSummaries(latestModel.value);
  const merged = mergeClustersWithModel(poiClusters.value, modelRows, { minPoi: minPoi.value });
  mapClusters.value = merged.clusters;
  zoneList.value = merged.summaries;
  if (zoneList.value.length) {
    if (!zoneList.value.some((z) => z.id === cmpA.value)) cmpA.value = zoneList.value[0]!.id;
    if (!zoneList.value.some((z) => z.id === cmpB.value)) {
      cmpB.value = zoneList.value[1]?.id ?? zoneList.value[0]!.id;
    }
  }
  syncCompareIds();
  setDistrictSummaries([...zoneList.value]);
}

function onPoiFilter() {
  recomputeFromPoi();
}

function activeCategoryKeys(): Set<string> {
  return new Set(poiCats.value.filter((c) => c.on).map((c) => c.id));
}

function recomputeFromPoi() {
  const keys = activeCategoryKeys();
  const features = poiSampleFc.value?.features ?? [];
  poiClusters.value = clusterPoisToDistricts(features, {
    threshold: threshold.value,
    minPoi: minPoi.value,
    categoryKeys: keys,
  });
  applyZoneList();
  syncMapLayers();
}

function rerunLocal() {
  running.value = true;
  jobError.value = false;
  const id = pushTask({ name: '商圈识别（同参重算）', page: 'districts' });
  window.setTimeout(() => {
    recomputeFromPoi();
    updateTask(id, {
      status: 'success',
      message: '同参数本地聚类完成',
      finishedAt: new Date().toISOString(),
    });
    jobMessage.value = '同参重算：已按当前阈值与 POI 筛选本地更新，未调用后端。';
    history.value = `POI 激活 ${activeOn.value} 类 / 最小 ${minPoi.value} / 阈 ${threshold.value} · ${new Date().toLocaleTimeString('zh-CN')}`;
    running.value = false;
  }, 420);
}

function reset() {
  threshold.value = DEFAULT_THRESHOLD;
  minPoi.value = DEFAULT_MIN_POI;
  poiCats.value = JSON.parse(JSON.stringify(DEFAULT_POI_CATS));
  const defaults = JSON.parse(JSON.stringify(districtLayerCatalog)) as LayerItem[];
  layers.splice(0, layers.length, ...defaults);
  highlight.value = 0;
  activeCard.value = null;
  jobError.value = false;
  jobMessage.value = '已恢复默认参数与图层设置。';
  history.value = '—';
  recomputeFromPoi();
}

function run() {
  running.value = true;
  jobMessage.value = '';
  jobError.value = false;
  const j = pushTask({ name: '商圈识别', page: 'districts' });
  gisDataService
    .runDistrictModel({
      minPoi: minPoi.value,
      threshold: threshold.value,
      categories: poiCats.value.filter((cat) => cat.on).map((cat) => cat.id),
      uavRouteId: gis.selectedUavRouteId,
    })
    .then((result) => {
      latestModel.value = result;
      recomputeFromPoi();
      updateTask(j, {
        status: 'success',
        message: '后端聚类结果已刷新',
        finishedAt: new Date().toISOString(),
      });
      jobMessage.value = result.districts?.length
        ? `识别完成：${result.districts.length} 个商圈，已与 POI 聚类合并展示。`
        : '识别完成，已刷新本地 POI 聚类。';
      history.value = `POI 激活 ${activeOn.value} 类 / 最小 ${minPoi.value} / 阈 ${threshold.value} · ${new Date().toLocaleTimeString('zh-CN')}`;
    })
    .catch((e) => {
      jobError.value = true;
      recomputeFromPoi();
      updateTask(j, {
        status: 'error',
        message: e instanceof Error ? e.message : '模型接口失败',
        errorCode: 'MODEL_API_FAILED',
        finishedAt: new Date().toISOString(),
      });
      jobMessage.value = '后端模型调用失败，已保留本地 POI 聚类结果。';
      history.value = `本地聚类 · ${new Date().toLocaleTimeString('zh-CN')}`;
    })
    .finally(() => {
      running.value = false;
    });
}

function drawDistricts() {
  const map = mapInstance.value;
  if (!map) return;
  if (districtLayer) map.removeLayer(districtLayer);
  districtLayer = null;
  const po = layerItem('district-cluster');
  if (!po?.visible) return;

  const g = L.layerGroup();
  const clusters = displayClusters();
  const op = po.opacity ?? 0.65;
  if (!clusters.length) {
    g.addTo(map);
    districtLayer = g;
    return;
  }
  clusters.forEach((cluster, i) => {
    const color = zoneColors[i % zoneColors.length];
    L.polygon(cluster.ring, {
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: (0.08 + 0.14 * op) * (0.85 + 0.03 * activeOn.value),
    })
      .on('click', () => highlightZone(i))
      .bindTooltip(`${cluster.name} · POI ${cluster.poiCount} · 置信 ${(cluster.confidence * 100).toFixed(0)}%`)
      .addTo(g);
  });
  g.addTo(map);
  districtLayer = g;
  if (highlight.value >= clusters.length) highlight.value = 0;
  highlightZone(highlight.value, false);
}

function showCard(i: number) {
  const z = zoneList.value[i];
  if (!z) {
    activeCard.value = null;
    return;
  }
  gis.selectedDistrictId = z.id;
  activeCard.value = {
    name: z.name,
    flow: z.flow,
    level: z.level,
    poiStr: z.poiStr ?? (activeOn.value < 2 ? '业态筛选较少' : poiCats.value.filter((c) => c.on).map((c) => c.name).join('、')),
  };
}

function drawPoi() {
  const map = mapInstance.value;
  if (!map) return;
  if (poiLayer) map.removeLayer(poiLayer);
  poiLayer = null;
  if (influenceLayer) {
    map.removeLayer(influenceLayer);
    influenceLayer = null;
  }
  const po = layerItem('district-poi');
  if (!po?.visible || activeOn.value < 1) return;

  const activeKeys = activeCategoryKeys();
  const op = po.opacity ?? 1;
  const g = L.layerGroup();
  const poiFeatures = poiSampleFc.value?.features ?? [];
  const filtered = poiFeatures.filter((feature) => activeKeys.has(String(feature.properties?.categoryKey ?? '')));
  const filteredPoiIds = new Set(filtered.map((feature) => String(feature.properties?.poiId ?? '')));
  filtered.forEach((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const p = feature.properties as Record<string, unknown>;
    const color = poiCategoryColor(String(p.categoryKey ?? ''));
    L.circleMarker([lat, lng], {
      radius: 3 + Math.round(Number(p.importance ?? 0.5) * 4),
      color,
      fillColor: color,
      fillOpacity: 0.9 * op,
      weight: 1,
    })
      .bindTooltip(`${p.name ?? 'POI'} · ${p.category ?? ''}`)
      .addTo(g);
  });
  const infl = poiInfluenceFc.value;
  if (infl?.features?.length) {
    const influenceSubset: FeatureCollection<Polygon> = {
      ...infl,
      features: infl.features.filter((feature) => {
        const p = feature.properties as Record<string, unknown> | null;
        return activeKeys.has(String(p?.categoryKey ?? '')) && filteredPoiIds.has(String(p?.poiId ?? ''));
      }),
    };
    influenceLayer = L.geoJSON(influenceSubset, {
      style: (feature) => {
        const color = poiCategoryColor(String(feature?.properties?.categoryKey ?? ''));
        return {
          color,
          weight: 0.8,
          fillColor: color,
          fillOpacity: 0.055 * op,
          opacity: 0.35 * op,
        };
      },
    }).addTo(map);
  }
  g.addTo(map);
  poiLayer = g;
}

function highlightZone(idx: number, fit = true) {
  if (!zoneList.value.length) return;
  highlight.value = Math.max(0, Math.min(idx, zoneList.value.length - 1));
  gis.selectedDistrictId = zoneList.value[highlight.value]?.id ?? null;
  const clusters = displayClusters();
  if (districtLayer) {
    let i = 0;
    districtLayer.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        const color = zoneColors[i % zoneColors.length];
        layer.setStyle({
          weight: highlight.value === i ? 4 : 2,
          color: highlight.value === i ? '#f5a623' : color,
          fillOpacity: highlight.value === i ? 0.28 : (layer.options.fillOpacity ?? 0.15),
        });
        i += 1;
      }
    });
  }
  showCard(highlight.value);
  const map = mapInstance.value;
  const cluster = clusters[highlight.value];
  if (fit && map && cluster?.ring?.length) {
    try {
      map.fitBounds(L.polygon(cluster.ring).getBounds(), { padding: [36, 36], maxZoom: 15 });
    } catch {
      /* ignore */
    }
  }
}

function syncMapLayers() {
  drawDistricts();
  drawPoi();
}

function exportSvg() {
  const w = 480;
  const h = 320;
  const nodes = zoneList.value.slice(0, 6);
  const circles = nodes
    .map((z, i) => {
      const cx = 80 + (i % 3) * 140;
      const cy = 70 + Math.floor(i / 3) * 120;
      return `<circle cx="${cx}" cy="${cy}" r="36" fill="none" stroke="#3d9cf5" stroke-width="2"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" fill="#e2e8f0">${z.name.slice(0, 6)}</text>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#0f172a"/><text x="16" y="24" fill="#94a3b8" font-size="13">武汉商圈结构 · ${new Date().toLocaleDateString('zh-CN')}</text>${circles}</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wuhan-district-structure.svg';
  a.click();
  URL.revokeObjectURL(url);
}

function modelDistrictsToSummaries(result: DistrictModelResult | null): DistrictZoneSummary[] {
  return (
    result?.districts?.map((district, idx) => ({
      id: district.id ?? String(idx + 1),
      name: district.name ?? `商圈 ${idx + 1}`,
      conf: Number(district.confidence ?? 0.75),
      flow: district.flowLevel ?? '中',
      level: district.vitalityLevel ?? '识别',
      poiStr: district.dominantCategories?.join('、'),
    })) ?? []
  );
}

function applyModelParams(result: DistrictModelResult | null) {
  const params = result?.params as { minPoi?: number; threshold?: number } | undefined;
  if (params?.minPoi != null && Number.isFinite(Number(params.minPoi))) {
    minPoi.value = Number(params.minPoi);
  }
  if (params?.threshold != null && Number.isFinite(Number(params.threshold))) {
    threshold.value = Number(params.threshold);
  }
}

async function loadBackendData() {
  try {
    const [model, poi, influence] = await Promise.all([
      gisDataService.getLatestDistrictModel(),
      gisDataService.getPoiSample(),
      gisDataService.getPoiInfluence(),
    ]);
    latestModel.value = model;
    applyModelParams(model);
    poiSampleFc.value = poi as FeatureCollection<Point>;
    poiInfluenceFc.value = influence as FeatureCollection<Polygon>;
    if (gis.districts.length) {
      zoneList.value = [...gis.districts];
      syncCompareIds();
    }
    recomputeFromPoi();
    if (gis.selectedDistrictId) {
      const idx = zoneList.value.findIndex((z) => z.id === gis.selectedDistrictId);
      if (idx >= 0) highlightZone(idx);
    }
  } catch (e) {
    console.warn('[GIS] 商圈后端数据未完全加载，保留本地演示', e);
    recomputeFromPoi();
  }
}

onMounted(() => {
  void loadBackendData();
});

watch([threshold, minPoi], () => {
  recomputeFromPoi();
});

watch([cmpA, cmpB], syncCompareIds);

watch(
  layers,
  () => {
    syncMapLayers();
  },
  { deep: true },
);

watch(
  mapInstance,
  (m) => {
    if (m) syncMapLayers();
  },
  { immediate: true },
);
</script>

<style scoped>
.page {
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 8px;
  gap: 8px;
}
.map {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.side {
  width: 270px;
  flex-shrink: 0;
  padding: 12px;
  overflow: auto;
}
.list-panel {
  width: 250px;
  flex-shrink: 0;
  padding: 12px;
  overflow: auto;
}
.title {
  margin: 0 0 12px;
  font-size: 15px;
}
.field {
  margin-bottom: 12px;
}
.val {
  margin-left: 8px;
  font-size: 12px;
  color: var(--accent);
}
.input {
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-deep);
  color: var(--text);
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 4px;
}
.muted {
  font-size: 11px;
  color: var(--text-muted);
  margin: 10px 0;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.table th,
.table td {
  border-bottom: 1px solid var(--border);
  padding: 6px 4px;
  text-align: left;
}
.table tr {
  cursor: pointer;
}
.table tr:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}
.job {
  font-size: 12px;
  margin: 8px 0 0;
}
.job.ok {
  color: var(--success);
}
.job.err {
  color: var(--danger);
}
.table tr:hover {
  background: var(--bg-panel-hover);
}
.table tr.active {
  background: rgba(245, 166, 35, 0.12);
}
.cmp {
  font-size: 11px;
  line-height: 1.3;
  color: var(--accent);
  margin-top: 4px;
}
.cardx {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid var(--border);
}
.cardx strong {
  font-size: 13px;
}
.link {
  display: inline-block;
  font-size: 12px;
  margin: 6px 0 8px;
}
</style>
