<template>
  <div class="page vitality">
    <aside class="left panel">
      <h3 class="title">活力评估模型</h3>
      <div class="field">
        <div class="field-label">人流数据（武汉智眼）</div>
        <select v-model="sourceFootfall" class="input">
          <option value="v1">智眼切片 v2026Q1</option>
          <option value="v0">历史基线 v2025Q4</option>
        </select>
      </div>
      <div class="field">
        <div class="field-label">时间范围</div>
        <input v-model="dateRange" type="text" class="input" readonly />
      </div>
      <div class="field">
        <div class="field-label">权重：人流 {{ wFoot }}</div>
        <input v-model.number="wFoot" type="range" min="0" max="1" step="0.05" />
      </div>
      <div class="field">
        <div class="field-label">权重：POI 商业密度 {{ wPoi }}</div>
        <input v-model.number="wPoi" type="range" min="0" max="1" step="0.05" />
      </div>
      <div class="field">
        <div class="field-label">权重：交通可达性 {{ wAcc }}</div>
        <input v-model.number="wAcc" type="range" min="0" max="1" step="0.05" />
      </div>
      <div class="field">
        <div class="field-label">权重：无人机观测 {{ wUav }}</div>
        <input v-model.number="wUav" type="range" min="0" max="1" step="0.05" />
      </div>
      <label class="check">
        <input v-model="useUav" type="checkbox" />
        纳入无人机观测项
      </label>
      <div class="btns">
        <button type="button" class="btn btn-primary" :disabled="running" @click="run">
          {{ running ? '运行中…' : '运行分析' }}
        </button>
        <button type="button" class="btn" @click="reset">重置</button>
      </div>
      <p v-if="jobMessage" :class="['job', jobError ? 'err' : 'ok']">{{ jobMessage }}</p>
    </aside>
    <div ref="mapEl" class="map"></div>
    <aside class="right panel">
      <h3 class="title">结果摘要</h3>
      <p class="muted">专题：<strong>{{ topic }}</strong></p>
      <div class="bars">
        <div v-for="b in topZones" :key="b.name" class="bar-row">
          <span class="name">{{ b.name }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: b.pct + '%' }"></div>
          </div>
          <span class="num">{{ b.score }}</span>
        </div>
      </div>
      <p class="muted small">直方图为演示数据；接入模型服务后替换为真实统计。</p>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import L from 'leaflet';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);

const sourceFootfall = ref('v1');
const dateRange = ref('2026-03-01 — 2026-03-31');
const wFoot = ref(0.35);
const wPoi = ref(0.3);
const wAcc = ref(0.25);
const wUav = ref(0.1);
const useUav = ref(true);
const running = ref(false);
const jobMessage = ref('');
const jobError = ref(false);
const runCount = ref(0);

const topic = ref('商业分布密度');

let resultLayer: L.LayerGroup | null = null;

const topZones = computed(() => {
  const base = runCount.value ? 72 + runCount.value : 58;
  return [
    { name: '江汉路片区', score: base + 12, pct: 100 },
    { name: '光谷广场', score: base + 4, pct: 88 },
    { name: '街道口', score: base - 6, pct: 72 },
    { name: '王家湾', score: base - 14, pct: 61 },
  ].map((z) => ({ ...z, pct: Math.min(100, z.pct) }));
});

function reset() {
  wFoot.value = 0.35;
  wPoi.value = 0.3;
  wAcc.value = 0.25;
  wUav.value = 0.1;
  useUav.value = true;
  jobMessage.value = '';
}

function run() {
  running.value = true;
  jobMessage.value = '';
  jobError.value = false;
  setTimeout(() => {
    running.value = false;
    runCount.value += 1;
    jobMessage.value = '分析完成，已挂载活力指数图层（演示）。';
    topic.value = runCount.value % 2 === 0 ? '集聚程度' : '商业分布密度';
    drawResult();
  }, 900);
}

function drawResult() {
  const map = mapInstance.value;
  if (!map) return;
  if (resultLayer) {
    map.removeLayer(resultLayer);
    resultLayer = null;
  }
  const g = L.layerGroup();
  const offsets: [number, number][] = [
    [0.015, 0.01],
    [-0.012, 0.008],
    [0.008, -0.014],
  ];
  offsets.forEach(([dx, dy], i) => {
    L.circle([WUHAN_CENTER[0] + dy, WUHAN_CENTER[1] + dx], {
      radius: 2500 - i * 400,
      color: '#3d9cf5',
      fillColor: '#3d9cf5',
      fillOpacity: 0.22 + i * 0.06,
      weight: 1,
    }).addTo(g);
  });
  g.addTo(map);
  resultLayer = g;
}

watch(mapInstance, (m) => {
  if (m && runCount.value) drawResult();
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

.map {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius);
  border: 1px solid var(--border);
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

.bars {
  margin-top: 12px;
}
.bar-row {
  display: grid;
  grid-template-columns: 88px 1fr 36px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
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
</style>
