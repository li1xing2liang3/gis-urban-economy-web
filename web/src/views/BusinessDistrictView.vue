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
      <p class="muted">运行记录：{{ history }}</p>
      <RouterLink
        class="link"
        :to="{ name: 'population', query: gisToQuery() }"
      >
        带区域前往人口与消费 →
      </RouterLink>
      <button type="button" class="btn btn-ghost" @click="exportSvg">导出结构图</button>
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
            @click="highlightZone(idx)"
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
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import L from 'leaflet';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';
import { gis, gisToQuery, setDistrictSummaries, type DistrictSummary } from '@/stores/gisState';
import { pushTask, updateTask } from '@/stores/gisState';

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
const highlight = ref(0);
const activeCard = ref<{
  name: string;
  flow: string;
  level: string;
  poiStr: string;
} | null>(null);
const cmpA = ref('1');
const cmpB = ref('2');

const baseZones: DistrictSummary[] = [
  { id: '1', name: '江汉路商圈', conf: 0.91, flow: '高', level: '核心' },
  { id: '2', name: '光谷商圈', conf: 0.88, flow: '高', level: '核心' },
  { id: '3', name: '街道口副核', conf: 0.76, flow: '中', level: '次核' },
];
const zoneList = ref([...baseZones]);
let districtLayer: L.LayerGroup | null = null;
let poiLayer: L.LayerGroup | null = null;

const activeOn = computed(() => poiCats.value.filter((c) => c.on).length);

const cmpText = computed(() => {
  const a = zoneList.value.find((z) => z.id === cmpA.value);
  const b = zoneList.value.find((z) => z.id === cmpB.value);
  if (!a || !b) return { flow: '—', poi: '—', v: '—' };
  return {
    flow: a.flow === b.flow ? '相近' : `${a.flow} vs ${b.flow}`,
    poi: activeOn.value < 2 ? '业态筛选偏少' : '零售/餐饮主导',
    v: `${a.level} / ${b.level}`,
  };
});

function onPoiFilter() {
  recomputeFromPoi();
  drawPoi();
}

function recomputeFromPoi() {
  const k = 0.02 * activeOn.value;
  zoneList.value = baseZones.map((z) => ({
    ...z,
    conf: Math.min(0.99, z.conf + (z.name.includes('江') ? k : k * 0.8)),
  }));
  setDistrictSummaries([...zoneList.value]);
  drawDistricts();
}

function run() {
  running.value = true;
  const j = pushTask({ name: '商圈识别', page: 'districts' });
  setTimeout(() => {
    const ok = new Date().toLocaleTimeString('zh-CN');
    updateTask(j, { status: 'success', message: '聚类已刷新', finishedAt: new Date().toISOString() });
    history.value = `POI 激活 ${activeOn.value} 类 / 最小 ${minPoi.value} / 阈 ${threshold.value} · ${ok}`;
    recomputeFromPoi();
    running.value = false;
  }, 700);
}

function drawDistricts() {
  const map = mapInstance.value;
  if (!map) return;
  if (districtLayer) map.removeLayer(districtLayer);
  const g = L.layerGroup();
  const strength = 1 - Math.min(0.2, (minPoi.value - 3) * 0.01);
  const adjust = 0.012 * strength;
  const p0 = L.polygon(
    [
      [30.6 + adjust * 0.3, 114.28 - adjust * 0.1],
      [30.61, 114.3],
      [30.595 - adjust * 0.2, 114.32],
      [30.585, 114.29],
    ],
    { color: '#3dd68c', weight: 2, fillOpacity: 0.12 + 0.02 * activeOn.value },
  );
  p0
    .on('click', () => {
      showCard(0);
    })
    .addTo(g);
  const p1 = L.polygon(
    [
      [30.575, 114.32 - adjust * 0.1],
      [30.59 + adjust * 0.2, 114.34],
      [30.565, 114.35 + adjust * 0.1],
      [30.56, 114.325],
    ],
    { color: '#3d9cf5', weight: 2, fillOpacity: 0.12 + 0.01 * activeOn.value },
  )
    .on('click', () => {
      showCard(1);
    })
    .addTo(g);
  g.addTo(map);
  districtLayer = g;
  highlightZone(highlight.value);
}

function showCard(i: number) {
  const z = zoneList.value[i];
  if (!z) return;
  gis.selectedDistrictId = z.id;
  const poiStr =
    activeOn.value < 2 ? '业态筛选较少' : poiCats.value.filter((c) => c.on).map((c) => c.name).join('、');
  activeCard.value = { name: z.name, flow: z.flow, level: z.level, poiStr };
}

function drawPoi() {
  const map = mapInstance.value;
  if (!map) return;
  if (poiLayer) map.removeLayer(poiLayer);
  if (activeOn.value < 1) {
    poiLayer = null;
    return;
  }
  const n = 3 + activeOn.value;
  const g = L.layerGroup();
  const pts: [number, number][] = [
    [30.598, 114.295],
    [30.592, 114.308],
    [30.588, 114.298],
    [30.582, 114.318],
    [30.605, 114.312],
    [30.59, 114.31],
  ].slice(0, n);
  pts.forEach(([la, lo]) => {
    L.circleMarker([la, lo], { radius: 4 + activeOn.value, color: '#f5a623', fillOpacity: 0.9 }).addTo(g);
  });
  g.addTo(map);
  poiLayer = g;
}

function highlightZone(idx: number) {
  highlight.value = idx;
  gis.selectedDistrictId = zoneList.value[idx]?.id ?? null;
  if (!districtLayer) return;
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
  if (idx >= 0) showCard(idx);
}

function exportSvg() {
  window.alert('演示：导出结构矢量可接后端。当前全局商圈结果已供动态分析等页复用。');
}

watch(
  mapInstance,
  (m) => {
    if (m) {
      recomputeFromPoi();
      setDistrictSummaries([...baseZones]);
    }
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
