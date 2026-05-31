<template>
  <div class="page low">
    <div ref="mapEl" class="map"></div>
    <aside class="side panel">
      <h3 class="title">低空数据增强</h3>
      <ul class="sources">
        <li v-for="s in sources" :key="s.id" class="src-row">
          <div class="src-head">
            <strong>{{ s.name }}</strong>
            <span class="tag">{{ s.status }}</span>
          </div>
          <div class="meta">{{ s.time }} · {{ s.res }} · 覆盖质量 {{ s.quality }}%</div>
          <label class="check">
            <input v-model="s.overlay" type="checkbox" />
            地图叠加
          </label>
          <label class="check">
            <input v-model="s.model" type="checkbox" @change="syncModel" />
            参与活力 / 商圈模型
          </label>
        </li>
      </ul>
      <p v-if="sources.some((s) => s.model)" class="boost">
        对活力分析精度提升约：{{ (gis.uavQualityBoost * 100).toFixed(0) }}%（演示；与全局 uav 开关同步）
      </p>
      <div class="links">
        <RouterLink
          class="btn btn-ghost"
          :to="{ name: 'scene3d', query: { r: 'p:30.5928,114.3055' } }"
        >
          打开三维视点（带位置）
        </RouterLink>
        <RouterLink class="btn btn-ghost" to="/overview">同位置二维总览</RouterLink>
        <RouterLink class="btn btn-ghost" to="/vitality">精细区域 → 经济活力</RouterLink>
      </div>
      <p class="hint">正射 / 倾斜切片与航线矢量可接 WMTS；参与模型时与第 3 页活力联动。</p>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import L from 'leaflet';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';
import { gis } from '@/stores/gisState';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);

const sources = reactive([
  {
    id: '1',
    name: '江汉路片区正射',
    time: '2026-03-18',
    res: '5 cm',
    status: '已入库',
    quality: 86,
    overlay: true,
    model: true,
  },
  {
    id: '2',
    name: '光谷倾斜模型',
    time: '2026-03-22',
    res: 'LOD2',
    status: '加载中',
    quality: 62,
    overlay: false,
    model: false,
  },
]);

function syncModel() {
  gis.uavInVitalityModel = sources.some((s) => s.model);
  const maxQ = sources.filter((s) => s.model).map((s) => s.quality);
  gis.uavQualityBoost = maxQ.length ? Math.max(0.04, 0.001 * (maxQ[0]! - 50)) : 0.08;
}
syncModel();

let routeLine: L.Polyline | null = null;
let coverage: L.Polygon | null = null;

function drawUav() {
  const map = mapInstance.value;
  if (!map) return;
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  if (coverage) {
    map.removeLayer(coverage);
    coverage = null;
  }
  const anyOverlay = sources.some((s) => s.overlay);
  if (!anyOverlay) return;
  const path: [number, number][] = [
    [WUHAN_CENTER[0] + 0.03, WUHAN_CENTER[1] - 0.02],
    [WUHAN_CENTER[0] + 0.025, WUHAN_CENTER[1]],
    [WUHAN_CENTER[0] + 0.018, WUHAN_CENTER[1] + 0.015],
    [WUHAN_CENTER[0] + 0.01, WUHAN_CENTER[1] + 0.02],
  ];
  routeLine = L.polyline(path, { color: '#7dd3fc', weight: 3, dashArray: '6 6' }).addTo(map);
  coverage = L.polygon(
    [
      [path[0][0] + 0.004, path[0][1] - 0.004],
      [path[1][0] + 0.006, path[1][1] + 0.006],
      [path[2][0] - 0.004, path[2][1] + 0.008],
      [path[3][0] - 0.008, path[3][1]],
    ],
    { color: '#38bdf8', weight: 1, fillOpacity: 0.08 },
  ).addTo(map);
  map.fitBounds(coverage.getBounds(), { padding: [40, 40] });
}

watch([mapInstance, () => sources.map((s) => s.overlay).join(',')], drawUav, { immediate: true });
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
  width: 300px;
  flex-shrink: 0;
  padding: 12px;
  overflow: auto;
}

.title {
  margin: 0 0 12px;
  font-size: 15px;
}

.sources {
  list-style: none;
  margin: 0;
  padding: 0;
}

.src-row {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.src-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.tag {
  font-size: 11px;
  color: var(--accent);
  border: 1px solid var(--border);
  padding: 2px 6px;
  border-radius: 4px;
}

.meta {
  font-size: 11px;
  color: var(--text-muted);
  margin: 6px 0;
}

.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 4px;
}

.links {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.hint {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
  margin-top: 12px;
}
.boost {
  font-size: 12px;
  color: var(--success);
  margin: 8px 0 0;
}
</style>
