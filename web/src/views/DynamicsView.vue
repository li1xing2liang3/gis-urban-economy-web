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
        <span class="label">时序/感知</span>
        <select v-model="streamMode" class="select">
          <option value="hist">历史型切片（模拟，与全局日联动）</option>
          <option value="live">准实时流（仅演示动画）</option>
        </select>
        <span class="badge-live" :class="{ on: streamMode === 'live' }">
          {{ streamMode === 'live' ? '实时刷新' : '历史回放' }}
        </span>
      </div>
      <label class="ab">
        <input v-model="gis.dynamicsCompareOn" type="checkbox" />
        双时间对比 A vs B
      </label>
    </div>
    <div ref="mapEl" class="map"></div>
    <div class="timeline panel">
      <div class="controls">
        <button type="button" class="btn" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</button>
        <label class="speed">
          速度
          <input v-model.number="speed" type="range" min="1" max="10" />
        </label>
        <span class="tick-label">{{ tickLabel }} · 槽位 {{ gis.timeSlotIndex }}</span>
      </div>
      <input v-model.number="tick" type="range" :min="0" :max="ticks.length - 1" step="1" class="slider" />
      <div class="legend">
        <span>低</span>
        <div class="grad" />
        <span>高</span>
        <span class="cap">人流 / 车流融合（随时刻变化，演示）</span>
      </div>
    </div>
    <div v-if="gis.dynamicsCompareOn" class="abbar panel">
      对比 A {{ gis.timeCompareA }} vs B {{ gis.timeCompareB }}：差异指数 {{ abDiff.toFixed(1) }}（演示合成）
    </div>
    <div class="curve panel">
      <div class="curve-h">
        <span class="curve-title">24 小时合成曲线（与槽位一致）</span>
        <span v-if="peakIdx != null" class="peak">峰值段：{{ ticks[peakIdx] ?? '' }}</span>
      </div>
      <svg class="svg" viewBox="0 0 400 80" preserveAspectRatio="none" @click="onSvgClick">
        <polyline fill="none" stroke="#3d9cf5" stroke-width="2" :points="polylinePoints" />
        <line
          v-if="peakX != null"
          :x1="peakX"
          y1="8"
          :x2="peakX"
          y2="72"
          stroke="#f5a623"
          stroke-width="1"
          stroke-dasharray="3 2"
        />
      </svg>
    </div>
    <div class="explain panel">
      <strong>变化原因（演示文案）</strong>
      <p>{{ changeExplain }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';
import { gis } from '@/stores/gisState';

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
const ticks = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '00:00', '03:00'];

const tickLabel = computed(() => {
  const base = ticks[tick.value] ?? '';
  if (mode.value === 'holiday') return `${base} · 节假（演示）`;
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

const peakIdx = computed(() => {
  let m = 0;
  let mi = 0;
  hourCurve.forEach((v, i) => {
    if (v > m) {
      m = v;
      mi = i;
    }
  });
  return m > 0 ? mi : null;
});
const peakX = computed(() => (peakIdx.value == null ? null : (peakIdx.value / (hourCurve.length - 1)) * 380 + 10));

const abDiff = computed(() => 12 + (tick.value % 5) * 0.7);

const changeExplain = computed(() => {
  const t = ticks[tick.value] ?? '';
  if (streamMode.value === 'live') return '准实时流强调随机波动，当前为演示随机种子。';
  if (mode.value === 'week') return `周内周期：在 ${t} 槽位，通勤与休闲切换带来热力迁移（演示解释）。`;
  if (mode.value === 'holiday') return '节假日：商圈外溢与职住反转造成峰值后移。';
  return `昼夜：${t} 时段，下班通勤与晚高峰叠加使热力上升；当前与全局日 ${gis.timeSingle} 的切片元数据一致（演示逻辑）。`;
});

let heatLayer: L.Circle | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
function updateHeat() {
  const map = mapInstance.value;
  if (!map) return;
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }
  gis.timeSlotIndex = tick.value;
  const t = tick.value / (ticks.length - 1);
  const gfac = 1 + (streamMode.value === 'live' ? 0.04 * (1 + (tick.value % 3) * 0.1) : 0);
  const ab = gis.dynamicsCompareOn ? 1.1 : 1;
  const intensity = (0.12 + t * 0.35) * gfac * ab;
  const radius = (3200 + tick.value * 180) * (gis.dataSource === 'v2025Q4' ? 0.95 : 1);
  heatLayer = L.circle(WUHAN_CENTER, {
    radius,
    color: '#f5a623',
    fillColor: '#f5a623',
    fillOpacity: intensity,
    weight: 0,
  }).addTo(map);
}

function onSvgClick() {
  if (peakIdx.value != null) tick.value = peakIdx.value;
}

watch([mapInstance, tick, streamMode, gis, () => gis.dynamicsCompareOn], updateHeat, { deep: true, immediate: true });

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
.ab {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text);
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
.abbar {
  flex-shrink: 0;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--accent);
}
.curve {
  flex-shrink: 0;
  height: 100px;
  padding: 8px 12px;
}
.curve-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.peak {
  font-size: 10px;
  color: var(--accent-hot);
}
.curve-title {
  font-size: 11px;
  color: var(--text-muted);
}
.svg {
  width: 100%;
  height: 72px;
  cursor: pointer;
}
.explain {
  font-size: 12px;
  line-height: 1.4;
  padding: 8px 12px;
  color: var(--text);
}
.explain p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 11px;
}
</style>
