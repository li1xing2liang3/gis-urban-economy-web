<template>
  <div class="page population">
    <div class="top">
      <div ref="mapEl" class="map"></div>
      <aside class="side panel">
        <h3>人口与消费潜力</h3>
        <div class="field">
          <div class="field-label">时间（与全局一致）</div>
          <input v-model="timeMonth" type="month" class="input" @change="syncGis" />
        </div>
        <div class="field">
          <div class="field-label">专题图层</div>
          <label class="check">
            <input v-model="showPop" type="checkbox" @change="sync" />
            人口密度（市州分级）
          </label>
          <label class="check">
            <input v-model="showPot" type="checkbox" @change="sync" />
            消费潜力（市州分级）
          </label>
          <label class="check">
            <input v-model="showRef" type="checkbox" @change="sync" />
            建筑 / POI 参考
          </label>
        </div>
        <p class="muted small">勾选图层后按模拟 GeoJSON 分级设色；范围越大颜色越深/越亮。</p>
        <div class="compare">
          <div class="field-label">区域对比（点地图选择或下拉）</div>
          <p class="hint">当前选择点：{{ pickMode === 'A' ? 'A' : 'B' }}</p>
          <div class="cards">
            <div
              v-for="key in ['A', 'B'] as const"
              :key="key"
              class="card"
              :class="{ on: pickMode === key }"
              @click="pickMode = key"
            >
              <strong>{{ key }} · {{ key === 'A' ? gis.popCompareA : gis.popCompareB }}</strong>
              <span>人口指数：{{ cardStats(key).pop }}</span>
              <span>消费潜力：{{ cardStats(key).c }}</span>
            </div>
          </div>
        </div>
        <p class="muted small">在地图上点击，将把 {{ pickMode === 'A' ? 'A' : 'B' }} 区标记为点选区（名称演示为「点选*」）。</p>
      </aside>
    </div>
    <div class="chart panel" @click="bumpFromChart">
      <div class="chart-head">
        <span class="chart-title">全省合成指数 · 近 6 期（点击柱条切换扰动）</span>
        <div class="chart-legend">
          <span class="lg pop"><i />人口</span>
          <span class="lg econ"><i />经济</span>
          <span class="lg vit"><i />活力</span>
        </div>
      </div>
      <div class="trend">
        <div v-for="slot in trendSlots" :key="slot.month" class="trend-slot">
          <div class="triple">
            <div class="bar b-pop" :title="'人口指数 ' + slot.rawPop" :style="{ height: slot.hPop + '%' }" />
            <div class="bar b-econ" :title="'经济指数 ' + slot.rawEcon" :style="{ height: slot.hEcon + '%' }" />
            <div class="bar b-vit" :title="'活力指数 ' + slot.rawVit" :style="{ height: slot.hVit + '%' }" />
          </div>
          <span class="trend-label">{{ slot.label }}</span>
          <div class="micro">
            <span>{{ slot.rawPop }}</span>
            <span>{{ slot.rawEcon }}</span>
            <span>{{ slot.rawVit }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';
import {
  mockHubeiDataPrefix,
  type ProvinceTimeseriesFile,
  popDensityFillColor,
  consumePotentialFillColor,
} from '@/utils/mockHubeiDataset';
import { gis } from '@/stores/gisState';
import { timeFactorFromPeriod } from '@/stores/gisState';
import type { FeatureCollection } from 'geojson';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);

const timeMonth = ref('2026-04');
const showPop = ref(true);
const showPot = ref(true);
const showRef = ref(false);
const pickMode = ref<'A' | 'B'>('A');
const lastChartIdx = ref(0);

const months = ['1月', '2月', '3月', '4月', '5月', '6月'];
const baseT = [42, 48, 55, 53, 60, 58];

const provinceTs = ref<ProvinceTimeseriesFile | null>(null);
const cityFc = ref<FeatureCollection | null>(null);
const densityRange = ref<{ lo: number; hi: number } | null>(null);

const trendFactor = computed(() => timeFactorFromPeriod());

function formatMonthLabel(m: string): string {
  const [, mm] = m.split('-');
  return `${parseInt(mm || '1', 10)}月`;
}

type TrendSlot = {
  month: string;
  label: string;
  hPop: number;
  hEcon: number;
  hVit: number;
  rawPop: number;
  rawEcon: number;
  rawVit: number;
};

const trendSlots = computed((): TrendSlot[] => {
  const pm = provinceTs.value?.monthly;
  const jitter = 1 + 0.015 * lastChartIdx.value * trendFactor.value;
  if (!pm?.length) {
    const m = parseInt((timeMonth.value || '6').split('-')[1] || '6', 10) - 1;
    const t = 0.88 + 0.04 * ((m + lastChartIdx.value) % 4);
    const tf = trendFactor.value;
    return months.map((lab, i) => {
      const base = baseT[i] ?? 50;
      const rawPop = Math.min(100, base * t * (1 + 0.02 * tf));
      const rawEcon = Math.min(100, rawPop * 1.05);
      const rawVit = Math.min(100, rawPop * 0.96);
      const mx = Math.max(rawPop, rawEcon, rawVit, 1);
      return {
        month: `fb-${i}`,
        label: lab,
        rawPop: Math.round(rawPop),
        rawEcon: Math.round(rawEcon),
        rawVit: Math.round(rawVit),
        hPop: Math.round((100 * rawPop) / mx),
        hEcon: Math.round((100 * rawEcon) / mx),
        hVit: Math.round((100 * rawVit) / mx),
      };
    });
  }
  const sel = timeMonth.value || '2026-04';
  let endIdx = pm.findIndex((x) => x.month === sel);
  if (endIdx < 0) endIdx = pm.length - 1;
  const start = Math.max(0, endIdx - 5);
  const slice = pm.slice(start, endIdx + 1);
  return slice.map((row) => {
    const rawPop = row.popIndex * jitter;
    const rawEcon = row.econIndex * jitter;
    const rawVit = row.vitalityIndex * jitter;
    const mx = Math.max(rawPop, rawEcon, rawVit, 1);
    return {
      month: row.month,
      label: formatMonthLabel(row.month),
      rawPop: Math.round(rawPop),
      rawEcon: Math.round(rawEcon),
      rawVit: Math.round(rawVit),
      hPop: Math.round((100 * rawPop) / mx),
      hEcon: Math.round((100 * rawEcon) / mx),
      hVit: Math.round((100 * rawVit) / mx),
    };
  });
});

const cardStats = (k: 'A' | 'B') => {
  const seed = (k + gis.popCompareA + gis.dataSource)
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return { pop: 64 + (seed % 20), c: 68 + (seed % 16) };
};

let popLayer: L.Circle | null = null;
let potLayer: L.Circle | null = null;
let popGeoLayer: L.Layer | null = null;
let potGeoLayer: L.Layer | null = null;
let refLayer: L.LayerGroup | null = null;

function syncGis() {
  const [y, m] = timeMonth.value.split('-');
  gis.timeSingle = `${y}-${m}-01`;
}

function onMapClick() {
  if (pickMode.value === 'A') gis.popCompareA = '点选A区';
  else gis.popCompareB = '点选B区';
}

function bumpFromChart() {
  lastChartIdx.value = (lastChartIdx.value + 1) % 6;
}

function sync() {
  const m = mapInstance.value;
  if (!m) return;
  if (popLayer) {
    m.removeLayer(popLayer);
    popLayer = null;
  }
  if (potLayer) {
    m.removeLayer(potLayer);
    potLayer = null;
  }
  if (popGeoLayer) {
    m.removeLayer(popGeoLayer);
    popGeoLayer = null;
  }
  if (potGeoLayer) {
    m.removeLayer(potGeoLayer);
    potGeoLayer = null;
  }
  if (refLayer) {
    m.removeLayer(refLayer);
    refLayer = null;
  }

  const fc = cityFc.value;
  const dr = densityRange.value;

  if (fc && dr && showPop.value) {
    popGeoLayer = L.geoJSON(fc, {
      style: (feat) => ({
        fillColor: popDensityFillColor(Number(feat.properties?.popDensity ?? 0), dr.lo, dr.hi),
        fillOpacity: 0.42,
        color: 'rgba(167, 139, 250, 0.45)',
        weight: 1.1,
      }),
      onEachFeature: (feat, lyr) => {
        const p = feat.properties as Record<string, unknown>;
        lyr.bindPopup(
          `<div style="font-size:12px;line-height:1.45;"><strong>${p.name}</strong><br/>人口密度示意 <b>${p.popDensity}</b><br/>${p.tierLabel}</div>`,
        );
      },
    }).addTo(m);
  } else if (showPop.value) {
    const w = 1 + 0.05 * (parseInt((timeMonth.value || '1').split('-')[1] || '1', 10) - 1);
    popLayer = L.circle(WUHAN_CENTER, {
      radius: 5000 * w,
      color: '#a78bfa',
      fillColor: '#8b5cf6',
      fillOpacity: 0.12 + 0.02 * (w - 1),
      weight: 1,
    }).addTo(m);
  }

  if (fc && showPot.value) {
    potGeoLayer = L.geoJSON(fc, {
      style: (feat) => ({
        fillColor: consumePotentialFillColor(Number(feat.properties?.consumePotential ?? 50)),
        fillOpacity: 0.4,
        color: 'rgba(52, 211, 153, 0.5)',
        weight: 1,
      }),
      onEachFeature: (feat, lyr) => {
        const p = feat.properties as Record<string, unknown>;
        lyr.bindPopup(
          `<div style="font-size:12px;"><strong>${p.name}</strong><br/>消费潜力 <b>${p.consumePotential}</b><br/>客流 <b>${p.inboundFlowIdx}</b></div>`,
        );
      },
    }).addTo(m);
  } else if (showPot.value) {
    const w = 1 + 0.05 * (parseInt((timeMonth.value || '1').split('-')[1] || '1', 10) - 1);
    potLayer = L.circle([WUHAN_CENTER[0] + 0.02, WUHAN_CENTER[1] + 0.02], {
      radius: 3800,
      color: '#34d399',
      fillColor: '#10b981',
      fillOpacity: 0.12 + 0.02 * w,
      weight: 1,
    }).addTo(m);
  }

  if (showRef.value) {
    const g = L.layerGroup();
    L.marker(WUHAN_CENTER).addTo(g);
    L.circleMarker([30.58, 114.32], { radius: 6, color: '#f5a623' }).addTo(g);
    g.addTo(m);
    refLayer = g;
  }
}

watch([mapInstance, timeMonth, showPop, showPot, showRef, trendFactor, cityFc, densityRange], sync, {
  immediate: true,
});
watch(
  timeMonth,
  () => {
    syncGis();
  },
  { immediate: true },
);

watch(
  mapInstance,
  (m, o) => {
    o?.off('click', onMapClick);
    m?.on('click', onMapClick);
  },
  { immediate: true },
);
onUnmounted(() => {
  mapInstance.value?.off('click', onMapClick);
});

onMounted(async () => {
  if (gis.timeSingle && gis.timeSingle.length >= 7) {
    timeMonth.value = gis.timeSingle.slice(0, 7);
  }
  try {
    const res = await fetch(`${mockHubeiDataPrefix()}timeseries-province.json`);
    if (res.ok) provinceTs.value = await res.json();
  } catch {
    /* 保留内置 trend */
  }
  try {
    const rc = await fetch(`${mockHubeiDataPrefix()}city-units.geojson`);
    if (rc.ok) {
      const gj = (await rc.json()) as FeatureCollection;
      cityFc.value = gj;
      const vals = gj.features.map((f) => Number((f.properties as { popDensity?: number })?.popDensity ?? 0));
      densityRange.value = { lo: Math.min(...vals), hi: Math.max(...vals) };
    }
  } catch {
    /* 无市州面则退回圆形演示 */
  }
});
</script>

<style scoped>
.page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8px;
  gap: 8px;
}
.top {
  flex: 1;
  display: flex;
  min-height: 0;
  gap: 8px;
}
.map {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  cursor: crosshair;
}
.side {
  width: 280px;
  flex-shrink: 0;
  padding: 12px;
  overflow: auto;
}
h3 {
  margin: 0 0 12px;
  font-size: 15px;
}
.field {
  margin-bottom: 12px;
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
  gap: 8px;
  font-size: 13px;
  margin-bottom: 6px;
}
.muted {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
  margin: 0;
}
.muted.small {
  font-size: 11px;
}
.hint {
  font-size: 11px;
  color: var(--accent);
  margin: 0 0 4px;
}
.compare .field-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-deep);
  font-size: 12px;
  cursor: pointer;
}
.card.on {
  border-color: var(--accent);
  background: var(--bg-panel-hover);
}
.chart {
  flex-shrink: 0;
  min-height: 168px;
  padding: 12px 16px 10px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: linear-gradient(180deg, rgba(27, 40, 56, 0.95), rgba(13, 27, 42, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.chart-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.chart-title {
  font-size: 12px;
  color: var(--text-muted);
}
.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted);
}
.chart-legend .lg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.chart-legend .lg i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
}
.chart-legend .pop i {
  background: linear-gradient(180deg, #c084fc, #7c3aed);
}
.chart-legend .econ i {
  background: linear-gradient(180deg, #fbbf24, #d97706);
}
.chart-legend .vit i {
  background: linear-gradient(180deg, #38bdf8, #0284c7);
}
.trend {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding-bottom: 2px;
  min-height: 110px;
}
.trend-slot {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.triple {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  height: 100px;
  width: 100%;
}
.bar {
  flex: 1;
  max-width: 14px;
  border-radius: 4px 4px 2px 2px;
  min-height: 6px;
  transition: height 0.25s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}
.b-pop {
  background: linear-gradient(180deg, #e9d5ff, #7c3aed);
}
.b-econ {
  background: linear-gradient(180deg, #fde68a, #d97706);
}
.b-vit {
  background: linear-gradient(180deg, #bae6fd, #0369a1);
}
.trend-label {
  font-size: 10px;
  color: var(--text-muted);
}
.micro {
  display: flex;
  gap: 4px;
  font-size: 9px;
  color: var(--text-muted);
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
}
.micro span {
  flex: 1;
  text-align: center;
  min-width: 0;
}
</style>
