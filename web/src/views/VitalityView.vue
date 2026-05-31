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
        <button v-if="lastId" type="button" class="btn btn-ghost" @click="run">同参重算</button>
      </div>
      <p v-if="jobMessage" :class="['job', jobError ? 'err' : 'ok']">{{ jobMessage }}</p>
      <div v-if="explain" class="exp panel small">
        <h4>解释与拆解</h4>
        <p>指标来源：按「智眼型」城市感知框架归类；实际为开放/模拟/低空占位数据，非政务智眼生产库。专题：「{{ resultTopic }}」。</p>
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
      <h4 class="h4">因子贡献</h4>
      <div v-for="c in contrib" :key="c.name" class="bar-row">
        <span class="name">{{ c.name }}</span>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: c.pct + '%' }" />
        </div>
        <span class="num">{{ c.pct }}%</span>
      </div>
      <h4 class="h4">市州排名（模拟 TOP6）</h4>
      <div v-for="(b, idx) in topZones" :key="b.name" class="bar-row rank-row">
        <span class="rank">{{ idx + 1 }}</span>
        <span class="name" :title="b.name">{{ b.shortName }}</span>
        <div class="bar-track">
          <div class="bar-fill rank-fill" :style="{ width: b.pct + '%' }" />
        </div>
        <span class="num">{{ b.score }}</span>
      </div>
      <p class="muted small">权重移动后热力会即时重绘；「运行分析」会触发任务与持久化到全局状态供其他页复用（演示逻辑）。</p>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';
import { mockHubeiDataPrefix, vitalityFillColor } from '@/utils/mockHubeiDataset';
import {
  gis,
  pushTask,
  updateTask,
  setVitalityResult,
  normalizeWeights,
  timeFactorFromPeriod,
} from '@/stores/gisState';
import type { VitalityResult } from '@/types/gis';
import type { FeatureCollection } from 'geojson';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);

/** 湖北省内地级单元示意面 + 模拟 vitalityIdx（来自 public/data/mock/hubei） */
const cityUnitsFc = ref<FeatureCollection | null>(null);

const wRef = ref({
  foot: 0.35,
  poi: 0.3,
  acc: 0.25,
  uav: 0.1,
});
const running = ref(false);
const jobMessage = ref('');
const jobError = ref(false);
const runCount = ref(0);
const resultTopic = ref('商业分布密度');
const lastId = ref('');

const norm = computed(() =>
  normalizeWeights({
    foot: wRef.value.foot,
    poi: wRef.value.poi,
    acc: wRef.value.acc,
    uav: wRef.value.uav,
    useUav: gis.uavInVitalityModel,
  }),
);

function shortCityLabel(full: string): string {
  return full.replace(/土家族苗族自治州/g, '恩施').replace(/市|州|林区/g, '');
}

function effectiveVitalityScore(props: Record<string, unknown>, n: (typeof norm)['value']): number {
  const base = Number(props.vitalityIdx ?? 50);
  const blend =
    0.58 + 0.14 * n.foot + 0.12 * n.poi + 0.1 * n.acc + (gis.uavInVitalityModel ? 0.12 * n.uav : 0);
  return Math.min(100, Math.max(0, Math.round(base * blend * (0.96 + 0.04 * timeFactorFromPeriod()))));
}

const topZones = computed(() => {
  const t = timeFactorFromPeriod() * (1 + norm.value.foot) * (1 + (gis.uavInVitalityModel ? gis.uavQualityBoost : 0));
  const base = runCount.value ? 58 * t : 52;
  const fc = cityUnitsFc.value;
  if (fc?.features?.length) {
    const rows = fc.features
      .map((f) => {
        const p = f.properties as Record<string, unknown> | null;
        if (!p) return { name: '—', shortName: '—', score: 0, pct: 0 };
        const name = String(p.name ?? '—');
        const score = effectiveVitalityScore(p, norm.value);
        return { name, shortName: shortCityLabel(name), score, pct: 0 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    const top = rows[0]?.score || 1;
    return rows.map((r) => ({ ...r, pct: Math.round((100 * r.score) / top) }));
  }
  return [
    { name: '江汉路片区', shortName: '江汉路', score: Math.round(base + 12), pct: 100 },
    { name: '光谷广场', shortName: '光谷', score: Math.round(base + 4), pct: 88 },
    { name: '街道口', shortName: '街道口', score: Math.round(base - 6), pct: 72 },
    { name: '王家湾', shortName: '王家湾', score: Math.round(base - 14), pct: 61 },
    { name: '徐东', shortName: '徐东', score: Math.round(base - 18), pct: 56 },
    { name: '南湖', shortName: '南湖', score: Math.round(base - 22), pct: 52 },
  ];
});

const contrib = computed(() => {
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

const explain = computed(() => {
  const c = [...contrib.value].sort((a, b) => b.pct - a.pct);
  if (!c.length) return null;
  return { main: `${c[0]!.name}（${c[0]!.pct}%）`, sub: `${c[1]!.name} / ${c[2]?.name || '其他'}` };
});

function pct(x: number) {
  return (x * 100).toFixed(1) + '%';
}

function reset() {
  wRef.value = { foot: 0.35, poi: 0.3, acc: 0.25, uav: 0.1 };
  gis.uavInVitalityModel = true;
  jobMessage.value = '';
}

function run() {
  running.value = true;
  jobMessage.value = '';
  jobError.value = false;
  const id = pushTask({ name: '经济活力', page: 'vitality' });
  lastId.value = id;
  setTimeout(() => {
    updateTask(id, { status: 'success', message: '完成，结果已写全局。', finishedAt: new Date().toISOString() });
    running.value = false;
    runCount.value += 1;
    resultTopic.value = runCount.value % 2 === 0 ? '集聚程度' : '商业分布密度';
    jobMessage.value = '分析完成。全局状态已更新。';
    const res: VitalityResult = {
      updatedAt: new Date().toISOString(),
      topic: resultTopic.value,
      topZones: topZones.value.map(({ name, score, pct }) => ({ name, score, pct })),
      indexMean: topZones.value[0]!.score,
      weights: {
        foot: wRef.value.foot,
        poi: wRef.value.poi,
        acc: wRef.value.acc,
        uav: wRef.value.uav,
        useUav: gis.uavInVitalityModel,
      },
    };
    setVitalityResult(res);
    drawResult();
  }, 900);
}

let resultLayer: L.LayerGroup | null = null;

onMounted(async () => {
  try {
    const res = await fetch(`${mockHubeiDataPrefix()}city-units.geojson`);
    if (res.ok) cityUnitsFc.value = (await res.json()) as FeatureCollection;
  } catch (e) {
    console.warn('[GIS] 未加载市州模拟面数据', e);
  }
});

function tierStrokeWeight(tier: unknown): number {
  const t = Number(tier);
  if (t === 1) return 2.4;
  if (t === 2) return 1.8;
  if (t === 3) return 1.35;
  return 1;
}

function popupHtml(props: Record<string, unknown>): string {
  const row = (k: string, v: string | number) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;font-size:12px;"><span style="opacity:.85">${k}</span><b style="color:#38bdf8">${v}</b></div>`;
  const name = String(props.name ?? '—');
  const tier = props.tierLabel ? String(props.tierLabel) : '';
  return `<div style="min-width:200px;color:#e2e8f0;line-height:1.35;">
    <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid rgba(148,163,184,.35);padding-bottom:4px;">${name}</div>
    ${tier ? `<div style="font-size:11px;opacity:.8;margin-bottom:6px;">${tier}</div>` : ''}
    ${row('综合活力', Number(props.vitalityIdx ?? '—'))}
    ${row('夜经济', Number(props.nightEconomyIdx ?? '—'))}
    ${row('消费潜力', Number(props.consumePotential ?? '—'))}
    ${row('客流吸引', Number(props.inboundFlowIdx ?? '—'))}
    ${row('人口密度示意', String(props.popDensity ?? '—'))}
    <div style="font-size:10px;opacity:.65;margin-top:6px;">点击地图外关闭 · 数据为模拟</div>
  </div>`;
}

function drawResult() {
  const map = mapInstance.value;
  if (!map) return;
  if (resultLayer) {
    map.removeLayer(resultLayer);
    resultLayer = null;
  }
  const n = norm.value;
  const g = L.layerGroup();
  const fc = cityUnitsFc.value;
  if (fc?.features?.length) {
    L.geoJSON(fc, {
      style: (feat) => {
        const p = feat.properties as Record<string, unknown> | undefined;
        const eff = p ? effectiveVitalityScore(p, n) : 50;
        const tw = tierStrokeWeight(p?.tier);
        return {
          fillColor: vitalityFillColor(eff),
          fillOpacity: 0.28 + 0.34 * n.foot + 0.06,
          color: 'rgba(148,163,184,0.95)',
          weight: tw,
        };
      },
      onEachFeature: (feat, layer) => {
        const p = feat.properties as Record<string, unknown> | undefined;
        if (p) layer.bindPopup(popupHtml(p), { maxWidth: 280, className: 'gis-city-popup' });
      },
    }).addTo(g);
  }
  const offsets: [number, number][] = [
    [0.018 * n.foot, 0.01 * n.poi],
    [-0.012 * n.acc, 0.01],
    [0.008, -0.012 * n.uav],
  ];
  offsets.forEach(([dx, dy], i) => {
    L.circle([WUHAN_CENTER[0] + dy, WUHAN_CENTER[1] + dx], {
      radius: 2600 - i * 450,
      color: '#3d9cf5',
      fillColor: '#3d9cf5',
      fillOpacity: 0.18 + 0.08 * (i + 1) * (0.3 + 0.7 * n.foot),
      weight: 1,
    }).addTo(g);
  });
  g.addTo(map);
  resultLayer = g;
}

watch(
  [norm, mapInstance, cityUnitsFc, () => wRef.value.foot, () => wRef.value.poi, () => wRef.value.acc, () => wRef.value.uav],
  () => {
    if (mapInstance.value) drawResult();
  },
  { deep: true },
);

watch(
  mapInstance,
  (m) => {
    if (m) drawResult();
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
.bar-row {
  display: grid;
  grid-template-columns: 64px 1fr 32px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}
.rank-row {
  grid-template-columns: 22px minmax(0, 1fr) 1fr 34px;
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
