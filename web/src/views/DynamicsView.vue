<template>
  <div class="page dynamics">
    <div class="toolbar panel">
      <div class="modes">
        <span class="label">分析模式</span>
        <label v-for="m in modes" :key="m.id" class="radio">
          <input v-model="mode" type="radio" name="mode" :value="m.id" />
          {{ m.name }}
        </label>
      </div>
      <div class="source">
        <span class="label">智眼数据</span>
        <select v-model="streamMode" class="select">
          <option value="hist">历史切片（默认）</option>
          <option value="live">准实时流（演示）</option>
        </select>
        <span class="badge-live" :class="{ on: streamMode === 'live' }">
          {{ streamMode === 'live' ? '实时刷新' : '历史回放' }}
        </span>
      </div>
    </div>
    <div ref="mapEl" class="map"></div>
    <div class="timeline panel">
      <div class="controls">
        <button type="button" class="btn" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</button>
        <label class="speed">
          速度
          <input v-model.number="speed" type="range" min="1" max="10" />
        </label>
        <span class="tick-label">{{ tickLabel }}</span>
      </div>
      <input v-model.number="tick" type="range" :min="0" :max="ticks.length - 1" step="1" class="slider" />
      <div class="legend">
        <span>低</span>
        <div class="grad"></div>
        <span>高</span>
        <span class="cap">人流 / 车流融合热力（演示）</span>
      </div>
    </div>
    <div class="curve panel">
      <span class="curve-title">24 小时曲线（演示）</span>
      <svg class="svg" viewBox="0 0 400 80" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="#3d9cf5"
          stroke-width="2"
          :points="polylinePoints"
        />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);

const modes = [
  { id: 'daynight', name: '昼夜对比' },
  { id: 'week', name: '周内周期' },
  { id: 'holiday', name: '节假日' },
];

const mode = ref('daynight');
const streamMode = ref('hist');
const tick = ref(0);
const playing = ref(false);
const speed = ref(4);

const ticks = [
  '06:00',
  '09:00',
  '12:00',
  '15:00',
  '18:00',
  '21:00',
  '00:00',
  '03:00',
];

const tickLabel = computed(() => {
  const base = ticks[tick.value] ?? '';
  if (mode.value === 'holiday') return `${base} · 清明节假日前后（演示标注）`;
  return base;
});

const hourCurve = [20, 35, 55, 48, 72, 68, 40, 28];
const polylinePoints = computed(() =>
  hourCurve
    .map((v, i) => {
      const x = (i / (hourCurve.length - 1)) * 380 + 10;
      const y = 70 - (v / 100) * 60;
      return `${x},${y}`;
    })
    .join(' '),
);

let heatLayer: L.Circle | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

function updateHeat() {
  const map = mapInstance.value;
  if (!map) return;
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }
  const t = tick.value / (ticks.length - 1);
  const intensity = 0.12 + t * 0.35;
  const radius = 3200 + tick.value * 180;
  heatLayer = L.circle(WUHAN_CENTER, {
    radius,
    color: '#f5a623',
    fillColor: '#f5a623',
    fillOpacity: intensity,
    weight: 0,
  }).addTo(map);
}

watch([mapInstance, tick], updateHeat, { immediate: true });

watch(playing, (p) => {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
  if (!p) return;
  timer = setInterval(() => {
    const next = tick.value + 1;
    tick.value = next >= ticks.length ? 0 : next;
  }, Math.max(200, 1200 - speed.value * 100));
});

function togglePlay() {
  playing.value = !playing.value;
}

onUnmounted(() => {
  if (timer) clearInterval(timer);
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

.toolbar {
  flex-shrink: 0;
  padding: 10px 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.modes,
.source {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.label {
  font-size: 12px;
  color: var(--text-muted);
}

.radio {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.select {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-deep);
  color: var(--text);
}

.badge-live {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  color: var(--text-muted);
}
.badge-live.on {
  color: var(--success);
  border-color: rgba(61, 214, 140, 0.5);
}

.map {
  flex: 1;
  min-height: 200px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.timeline {
  flex-shrink: 0;
  padding: 10px 14px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.speed {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.tick-label {
  font-size: 12px;
  color: var(--accent-hot);
  margin-left: auto;
}

.slider {
  width: 100%;
}

.legend {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-muted);
}

.grad {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, #1b2838, #f5a623);
  border: 1px solid var(--border);
}

.cap {
  margin-left: 8px;
}

.curve {
  flex-shrink: 0;
  height: 100px;
  padding: 8px 12px;
}

.curve-title {
  font-size: 11px;
  color: var(--text-muted);
}

.svg {
  width: 100%;
  height: 72px;
}
</style>
