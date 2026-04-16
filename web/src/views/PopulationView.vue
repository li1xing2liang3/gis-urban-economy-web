<template>
  <div class="page population">
    <div class="top">
      <div ref="mapEl" class="map"></div>
      <aside class="side panel">
        <h3 class="title">人口与消费潜力</h3>
        <div class="field">
          <div class="field-label">时间</div>
          <input v-model="period" type="month" class="input" />
        </div>
        <div class="field">
          <div class="field-label">专题图层</div>
          <label class="check">
            <input v-model="showPop" type="checkbox" />
            人口密度
          </label>
          <label class="check">
            <input v-model="showPot" type="checkbox" />
            消费潜力分级
          </label>
          <label class="check">
            <input v-model="showRef" type="checkbox" />
            建筑 / POI 参考
          </label>
        </div>
        <div class="field">
          <div class="field-label">指标说明</div>
          <p class="muted">
            人口为格网估算；潜力模型综合 POI、客流与业态结构（演示文案）。
          </p>
        </div>
        <div class="compare">
          <div class="field-label">区域对比（演示）</div>
          <div class="cards">
            <div class="card">
              <strong>A · 江汉路</strong>
              <span>人口密度：高</span>
              <span>潜力指数：82</span>
            </div>
            <div class="card">
              <strong>B · 光谷</strong>
              <span>人口密度：高</span>
              <span>潜力指数：79</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
    <div class="chart panel">
      <span class="chart-title">多期趋势（演示）</span>
      <div class="trend">
        <div v-for="(t, i) in trend" :key="i" class="trend-col">
          <div class="trend-bar" :style="{ height: t + '%' }"></div>
          <span class="trend-label">{{ months[i] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import L from 'leaflet';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);

const period = ref('2026-03');
const showPop = ref(true);
const showPot = ref(true);
const showRef = ref(false);

const months = ['1月', '2月', '3月', '4月', '5月', '6月'];
const trend = [42, 48, 55, 53, 60, 58];

let popLayer: L.Circle | null = null;
let potLayer: L.Circle | null = null;
let refLayer: L.LayerGroup | null = null;

function syncLayers() {
  const map = mapInstance.value;
  if (!map) return;
  if (popLayer) {
    map.removeLayer(popLayer);
    popLayer = null;
  }
  if (potLayer) {
    map.removeLayer(potLayer);
    potLayer = null;
  }
  if (refLayer) {
    map.removeLayer(refLayer);
    refLayer = null;
  }
  if (showPop.value) {
    popLayer = L.circle(WUHAN_CENTER, {
      radius: 5000,
      color: '#8b5cf6',
      fillColor: '#8b5cf6',
      fillOpacity: 0.15,
      weight: 1,
    }).addTo(map);
  }
  if (showPot.value) {
    potLayer = L.circle([WUHAN_CENTER[0] + 0.02, WUHAN_CENTER[1] + 0.02], {
      radius: 3800,
      color: '#3dd68c',
      fillColor: '#3dd68c',
      fillOpacity: 0.18,
      weight: 1,
    }).addTo(map);
  }
  if (showRef.value) {
    const g = L.layerGroup();
    L.marker(WUHAN_CENTER).addTo(g);
    L.circleMarker([30.58, 114.32], { radius: 6, color: '#f5a623' }).addTo(g);
    g.addTo(map);
    refLayer = g;
  }
}

watch([mapInstance, showPop, showPot, showRef], syncLayers, { immediate: true });
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
}

.side {
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
  margin-bottom: 6px;
}

.muted {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
  margin: 0;
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
}

.chart {
  flex-shrink: 0;
  height: 120px;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
}

.chart-title {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.trend {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding-bottom: 4px;
}

.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
  justify-content: flex-end;
}

.trend-bar {
  width: 100%;
  max-width: 36px;
  background: linear-gradient(180deg, var(--accent), #1f5f9a);
  border-radius: 4px 4px 0 0;
  min-height: 8px;
}

.trend-label {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
