<template>
  <div class="page overview">
    <div class="kpi-strip panel">
      <div class="kpi">
        <span class="kpi-label">全市活力指数（演示）</span>
        <strong class="kpi-val">62.4</strong>
        <span class="kpi-range">区间 38 — 81</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">图层组合</span>
        <span class="kpi-meta">{{ activeLayerCount }} 个可见</span>
      </div>
      <div class="kpi actions">
        <button type="button" class="btn btn-ghost" @click="saveBookmark">保存视图书签</button>
        <button type="button" class="btn btn-ghost" @click="exportView">导出截图</button>
      </div>
    </div>
    <div class="map-area">
      <div ref="mapEl" class="map"></div>
      <aside class="drawer panel">
        <LayerTreePanel :layers="layers" />
        <div class="hint">框选与点选能力可在接入矢量服务后启用</div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import L from 'leaflet';
import LayerTreePanel, { type LayerItem } from '@/components/LayerTreePanel.vue';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);

const layers = reactive<LayerItem[]>([
  { id: 'dem', name: 'DEM / 地形', visible: false, opacity: 0.7 },
  { id: 'buildings', name: '建筑高度', visible: true, opacity: 0.85 },
  { id: 'roads', name: '道路网络', visible: true, opacity: 1 },
  { id: 'poi', name: 'POI 商业', visible: false, opacity: 1 },
  { id: 'pop', name: '人口密度', visible: false, opacity: 0.75 },
  { id: 'uav', name: '无人机影像', visible: false, opacity: 0.9 },
  { id: 'zhiyan', name: '武汉智眼热力', visible: false, opacity: 0.8 },
  { id: 'vitality', name: '经济活力分布（模型）', visible: true, opacity: 0.65 },
]);

const activeLayerCount = computed(() => layers.filter((l) => l.visible).length);

let demoCircle: L.Circle | null = null;

watch(
  [mapInstance, () => layers.find((l) => l.id === 'vitality')?.visible],
  () => {
    const map = mapInstance.value;
    if (!map) return;
    if (demoCircle) {
      map.removeLayer(demoCircle);
      demoCircle = null;
    }
    const v = layers.find((l) => l.id === 'vitality');
    if (v?.visible) {
      demoCircle = L.circle(WUHAN_CENTER, {
        radius: 4200,
        color: '#f5a623',
        fillColor: '#f5a623',
        fillOpacity: v.opacity ?? 0.35,
        weight: 2,
      }).addTo(map);
    }
  },
  { immediate: true },
);

watch(
  () => layers.find((l) => l.id === 'vitality')?.opacity,
  (op) => {
    if (demoCircle && op != null) demoCircle.setStyle({ fillOpacity: op * 0.5 });
  },
);

function saveBookmark() {
  window.alert('演示：已记录当前图层组合与视域（待接后端书签 API）');
}

function exportView() {
  window.alert('演示：导出当前视域截图（待接浏览器 canvas 或服务端渲染）');
}
</script>

<style scoped>
.page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.kpi-strip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 16px;
  margin: 8px 8px 0;
}

.kpi {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.kpi-label {
  font-size: 12px;
  color: var(--text-muted);
}

.kpi-val {
  font-size: 20px;
  color: var(--accent-hot);
}

.kpi-range,
.kpi-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.kpi.actions {
  margin-left: auto;
  gap: 8px;
}

.map-area {
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

.drawer {
  width: 260px;
  flex-shrink: 0;
  padding: 12px;
  overflow: auto;
}

.hint {
  margin-top: 12px;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}
</style>
