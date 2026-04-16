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
        <div class="field-label">POI 类别筛选</div>
        <label v-for="c in poiCats" :key="c.id" class="check">
          <input v-model="c.on" type="checkbox" />
          {{ c.name }}
        </label>
      </div>
      <button type="button" class="btn btn-primary" :disabled="running" @click="run">
        {{ running ? '识别中…' : '执行识别' }}
      </button>
      <p class="muted">运行记录：{{ history }}</p>
      <button type="button" class="btn btn-ghost" @click="exportSvg">导出结构图</button>
    </aside>
    <aside class="list-panel panel">
      <h3 class="title">商圈排名</h3>
      <table class="table">
        <thead>
          <tr>
            <th>名称</th>
            <th>置信度</th>
            <th>人流量</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(z, idx) in zones"
            :key="z.id"
            :class="{ active: highlight === idx }"
            @click="highlightZone(idx)"
          >
            <td>{{ z.name }}</td>
            <td>{{ z.conf }}</td>
            <td>{{ z.flow }}</td>
          </tr>
        </tbody>
      </table>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import L from 'leaflet';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);

const threshold = ref(8);
const minPoi = ref(12);
const poiCats = ref([
  { id: 'retail', name: '零售', on: true },
  { id: 'food', name: '餐饮', on: true },
  { id: 'svc', name: '服务', on: false },
]);

const running = ref(false);
const history = ref('—');
const highlight = ref<number | null>(0);

const zones = ref([
  { id: '1', name: '江汉路商圈', conf: '0.91', flow: '高' },
  { id: '2', name: '光谷商圈', conf: '0.88', flow: '高' },
  { id: '3', name: '街道口副核', conf: '0.76', flow: '中' },
]);

let districtLayer: L.LayerGroup | null = null;
let poiLayer: L.LayerGroup | null = null;

function run() {
  running.value = true;
  setTimeout(() => {
    running.value = false;
    history.value = `阈值 ${threshold.value} / 最小 POI ${minPoi.value} · ${new Date().toLocaleTimeString('zh-CN')}`;
    drawDistricts();
    drawPoi();
  }, 700);
}

function drawDistricts() {
  const map = mapInstance.value;
  if (!map) return;
  if (districtLayer) map.removeLayer(districtLayer);
  const g = L.layerGroup();
  const polys: L.Polygon[] = [
    L.polygon(
      [
        [30.6, 114.28],
        [30.61, 114.3],
        [30.595, 114.32],
        [30.585, 114.29],
      ],
      { color: '#3dd68c', weight: 2, fillOpacity: 0.12 },
    ),
    L.polygon(
      [
        [30.575, 114.32],
        [30.59, 114.34],
        [30.565, 114.35],
        [30.56, 114.325],
      ],
      { color: '#3d9cf5', weight: 2, fillOpacity: 0.12 },
    ),
  ];
  polys.forEach((p) => p.addTo(g));
  g.addTo(map);
  districtLayer = g;
}

function drawPoi() {
  const map = mapInstance.value;
  if (!map) return;
  if (poiLayer) map.removeLayer(poiLayer);
  const g = L.layerGroup();
  const pts: [number, number][] = [
    [30.598, 114.295],
    [30.592, 114.308],
    [30.588, 114.298],
    [30.582, 114.318],
    [30.605, 114.312],
  ];
  pts.forEach(([la, lo]) => {
    L.circleMarker([la, lo], { radius: 5, color: '#f5a623', fillOpacity: 0.9 }).addTo(g);
  });
  g.addTo(map);
  poiLayer = g;
}

function highlightZone(idx: number) {
  highlight.value = idx;
  const map = mapInstance.value;
  if (!map || !districtLayer) return;
  let i = 0;
  districtLayer.eachLayer((layer) => {
    if (layer instanceof L.Polygon) {
      layer.setStyle({
        weight: highlight.value === i ? 4 : 2,
        color: highlight.value === i ? '#f5a623' : i === 0 ? '#3dd68c' : '#3d9cf5',
      });
      i += 1;
    }
  });
}

function exportSvg() {
  window.alert('演示：导出商圈结构矢量 / 截图（待接导出服务）');
}

watch(mapInstance, (m) => {
  if (m) {
    drawDistricts();
    drawPoi();
  }
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

.map {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.side {
  width: 260px;
  flex-shrink: 0;
  padding: 12px;
  overflow: auto;
}

.list-panel {
  width: 240px;
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
.table tr:hover {
  background: var(--bg-panel-hover);
}
.table tr.active {
  background: rgba(245, 166, 35, 0.12);
}
</style>
