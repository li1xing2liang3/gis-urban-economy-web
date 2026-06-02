<template>
  <div class="page overview">
    <div class="kpi-strip panel">
      <div class="kpi">
        <span class="kpi-label">区域活力（全局同步）</span>
        <strong class="kpi-val">{{ regionKpis.v }}</strong>
        <span class="kpi-range">{{ gis.dataSource }} · {{ gis.region.label }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">图层</span>
        <span class="kpi-meta">{{ activeLayerCount }} 个可见</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">操作</span>
        <div class="seg">
          <button
            v-for="m in uiModes"
            :key="m.id"
            type="button"
            :class="['seg-btn', { on: interMode === m.id }]"
            @click="interMode = m.id as typeof interMode"
          >
            {{ m.name }}
          </button>
        </div>
      </div>
      <div class="kpi actions">
        <button type="button" class="btn btn-ghost" @click="onBookmark">图层保存</button>
        <button type="button" class="btn btn-ghost" @click="onScreen">截图导出</button>
        <button type="button" class="btn btn-ghost" @click="onReport">报告导出</button>
      </div>
    </div>
    <div v-if="interMode === 'compare'" class="compare-hint panel">
      将导航栏时间切换为「A/B 对比」并选两个日期，指标卡使用合成估值（演示）。
    </div>
    <div class="map-area">
      <div ref="mapEl" class="map"></div>
      <aside class="drawer panel">
        <p class="map-tip">
          <template v-if="gis.region.mode === 'point'">在地图上点击设定 1 km 中心。</template>
          <template v-else-if="gis.region.mode === 'box'">在地图上拖出矩形框（按住拖拽）。</template>
          <template v-else>区域由导航栏统一切换。</template>
        </p>
        <LayerTreePanel :layers="layers" />
        <div v-if="poiLayerVisible" class="poi-legend panel">
          <div class="poi-legend-title">POI 点 · 圆形影响区</div>
          <div class="poi-legend-grid">
            <span v-for="item in POI_CATEGORY_LEGEND" :key="item.key" class="poi-legend-item">
              <i class="poi-dot" :style="{ background: poiCategoryColor(item.key) }" />
              {{ item.label }}
            </span>
          </div>
        </div>
        <RegionStatsCard v-if="gis.region.mode !== 'all'" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onUnmounted, unref } from 'vue';
import L from 'leaflet';
import LayerTreePanel from '@/components/LayerTreePanel.vue';
import RegionStatsCard from '@/components/RegionStatsCard.vue';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';
import { overviewLayerCatalog } from '@/config/layerCatalog';
import type { LayerItem } from '@/types/layer';
import {
  vitalityFillColor,
  poiCategoryColor,
  POI_CATEGORY_LEGEND,
  poiInfluenceRadiusM,
  type PoiPointProperties,
} from '@/utils/mockHubeiDataset';
import { gisDataService } from '@/services/gisDataService';
import { gis, regionKpis, setRegionPoint, setRegionBox } from '@/stores/gisState';
import { addBookmark, downloadMapPng, downloadTextReport, loadBookmarks } from '@/utils/exportAndBookmark';
import type { FeatureCollection } from 'geojson';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);

const layers = reactive<LayerItem[]>(JSON.parse(JSON.stringify(overviewLayerCatalog)) as LayerItem[]);
const interMode = ref<'select' | 'analyze' | 'compare'>('select');

const uiModes = [
  { id: 'select', name: '选择' },
  { id: 'analyze', name: '分析' },
  { id: 'compare', name: '对比' },
] as const;

const activeLayerCount = computed(() => layers.filter((l) => l.visible).length);

const poiLayerVisible = computed(() => layers.find((l) => l.id === 'poi')?.visible === true);

let demoCircle: L.Circle | null = null;
let poiMockLayer: L.Layer | null = null;
let vitalityChoroLayer: L.Layer | null = null;
let regionLayer: L.LayerGroup | null = null;
let drawRect: L.Rectangle | null = null;
let isDrawing = false;
let startLL: L.LatLng | null = null;
let handlers: { off: () => void } | null = null;

function releaseMapDrag() {
  const map = mapInstance.value;
  if (!map) return;
  isDrawing = false;
  startLL = null;
  map.dragging.enable();
  map.touchZoom.enable();
}

function removeDrawHandlers() {
  if (handlers) {
    handlers.off();
    handlers = null;
  }
  releaseMapDrag();
}

function syncRegionOverlays() {
  const map = mapInstance.value;
  if (!map) return;
  if (regionLayer) {
    map.removeLayer(regionLayer);
    regionLayer = null;
  }
  const g = L.layerGroup();
  if (gis.region.mode === 'point' && gis.region.point) {
    const c = gis.region.point;
    L.circle([c.lat, c.lng], { radius: 1000, color: '#3dd68c', fillOpacity: 0.1, weight: 2 }).addTo(g);
    L.circleMarker([c.lat, c.lng], { radius: 5, color: '#3dd68c' }).addTo(g);
  } else if (gis.region.mode === 'box' && gis.region.box) {
    const b = gis.region.box;
    L.rectangle(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      { color: '#f5a623', weight: 2, fillOpacity: 0.08 },
    ).addTo(g);
  }
  g.addTo(map);
  regionLayer = g;
}

function attachBoxDraw() {
  const map = mapInstance.value;
  if (!map) return;
  removeDrawHandlers();
  if (gis.region.mode !== 'box') {
    return;
  }
  const onDown = (e: L.LeafletMouseEvent) => {
    if (gis.region.mode !== 'box') return;
    isDrawing = true;
    startLL = e.latlng;
    map.dragging.disable();
    if (drawRect) {
      map.removeLayer(drawRect);
      drawRect = null;
    }
  };
  const onMove = (e: L.LeafletMouseEvent) => {
    if (!isDrawing || !startLL) return;
    if (drawRect) map.removeLayer(drawRect);
    const b = L.latLngBounds(startLL, e.latlng);
    drawRect = L.rectangle(b, { color: '#f5a623', weight: 2, fillOpacity: 0.1 }).addTo(map);
  };
  const onUp = (e: L.LeafletMouseEvent) => {
    if (!isDrawing || !startLL) return;
    isDrawing = false;
    map.dragging.enable();
    const b = L.latLngBounds(startLL, e.latlng);
    setRegionBox({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    });
    startLL = null;
    if (drawRect) {
      map.removeLayer(drawRect);
      drawRect = null;
    }
    syncRegionOverlays();
  };
  const onLeave = () => {
    if (!isDrawing) return;
    isDrawing = false;
    startLL = null;
    releaseMapDrag();
    if (drawRect) {
      map.removeLayer(drawRect);
      drawRect = null;
    }
  };
  map.on('mousedown', onDown);
  map.on('mousemove', onMove);
  map.on('mouseup', onUp);
  map.on('mouseout', onLeave);
  handlers = {
    off: () => {
      map.off('mousedown', onDown);
      map.off('mousemove', onMove);
      map.off('mouseup', onUp);
      map.off('mouseout', onLeave);
    },
  };
}

watch(
  [mapInstance, () => gis.region],
  () => {
    if (!mapInstance.value) return;
    syncRegionOverlays();
    attachBoxDraw();
  },
  { deep: true, immediate: true },
);

const onMapClick = (e: L.LeafletMouseEvent) => {
  if (gis.region.mode !== 'point') return;
  setRegionPoint(e.latlng.lat, e.latlng.lng);
  syncRegionOverlays();
};

watch(
  mapInstance,
  (m, old) => {
    old?.off('click', onMapClick);
    m?.on('click', onMapClick);
  },
  { immediate: true },
);

onUnmounted(() => {
  mapInstance.value?.off('click', onMapClick);
  removeDrawHandlers();
});

watch(
  [mapInstance, () => layers.find((l) => l.id === 'poi')?.visible, () => layers.find((l) => l.id === 'poi')?.opacity],
  async () => {
    const map = mapInstance.value;
    if (!map) return;
    if (poiMockLayer) {
      map.removeLayer(poiMockLayer);
      poiMockLayer = null;
    }
    const po = layers.find((l) => l.id === 'poi');
    if (!po?.visible) return;
    try {
      const fc = (await gisDataService.getPoiSample()) as FeatureCollection;
      const g = L.layerGroup();
      const poiRenderer = L.canvas({ padding: 0.5 });
      const op = po.opacity ?? 1;
      for (const feat of fc.features) {
        if (feat.geometry?.type !== 'Point') continue;
        const coords = feat.geometry.coordinates as [number, number];
        const latlng = L.latLng(coords[1], coords[0]);
        const p = (feat.properties ?? {}) as PoiPointProperties;
        const k = p.categoryKey ?? '';
        const col = poiCategoryColor(k);
        const inflM = poiInfluenceRadiusM(p);
        const basis = p.influenceBasis;
        const popupHtml = `<div style="font-size:12px;"><strong>${p.name ?? ''}</strong><br/><span style="opacity:.85">${p.category ?? ''}</span> · ${p.cityName ?? ''}<br/>主商圈半径：${inflM < 1000 ? `${inflM} m` : `${(inflM / 1000).toFixed(2)} km`}${basis ? `<br/><span style="opacity:.75">${basis}</span>` : ''}</div>`;
        L.circle(latlng, {
          radius: inflM,
          renderer: poiRenderer,
          color: col,
          weight: 1,
          fillColor: col,
          fillOpacity: 0.1 * op,
          opacity: 0.55 * op,
        })
          .bindPopup(popupHtml)
          .addTo(g);
        const markerR = 3 + Math.round((p.importance ?? 0.55) * 6);
        L.circleMarker(latlng, {
          radius: markerR,
          renderer: poiRenderer,
          color: col,
          fillColor: col,
          fillOpacity: 0.88 * op,
          weight: 1,
        })
          .bindPopup(popupHtml)
          .addTo(g);
      }
      g.addTo(map);
      poiMockLayer = g;
    } catch {
      /* 忽略：保持无 POI 叠加 */
    }
  },
  { immediate: true },
);

watch(
  [
    mapInstance,
    () => layers.find((l) => l.id === 'vitality')?.visible,
    () => layers.find((l) => l.id === 'vitality')?.opacity,
    interMode,
    () => gis.uavInVitalityModel,
  ],
  async () => {
    const map = mapInstance.value;
    if (!map) return;
    if (vitalityChoroLayer) {
      map.removeLayer(vitalityChoroLayer);
      vitalityChoroLayer = null;
    }
    if (demoCircle) {
      map.removeLayer(demoCircle);
      demoCircle = null;
    }
    const layerItem = layers.find((l) => l.id === 'vitality');
    if (!layerItem?.visible) return;
    try {
      const fc = (await gisDataService.getCityUnits()) as FeatureCollection;
      const op = layerItem.opacity ?? 0.35;
      vitalityChoroLayer = L.geoJSON(fc, {
        style: (feat) => {
          const p = feat.properties as { vitalityIdx?: number; tier?: number };
          const val = Number(p?.vitalityIdx ?? 50);
          const tw = p?.tier === 1 ? 2.2 : p?.tier === 2 ? 1.65 : 1.1;
          return {
            fillColor: vitalityFillColor(val),
            fillOpacity: op * 0.82,
            color: 'rgba(148,163,184,0.55)',
            weight: tw,
          };
        },
        onEachFeature: (feat, lyr) => {
          const p = feat.properties as Record<string, unknown>;
          lyr.bindPopup(
            `<div style="font-size:12px;line-height:1.45;"><strong style="color:#38bdf8">${p.name}</strong><br/>
            <span style="opacity:.85">活力</span> <b>${p.vitalityIdx}</b> · <span style="opacity:.85">夜经济</span> <b>${p.nightEconomyIdx}</b><br/>
            <span style="opacity:.85">消费潜力</span> <b>${p.consumePotential}</b></div>`,
          );
        },
      }).addTo(map);
    } catch {
      const boost = 1 + (interMode.value === 'compare' ? 0.04 : 0) + (gis.uavInVitalityModel ? 0.03 : 0);
      demoCircle = L.circle(WUHAN_CENTER, {
        radius: 3600 * boost,
        color: '#f5a623',
        fillColor: '#f5a623',
        fillOpacity: (layerItem.opacity ?? 0.35) * 0.55,
        weight: 2,
      }).addTo(map);
    }
  },
  { immediate: true },
);

function onBookmark() {
  const b = addBookmark('空间总览图层方案', layers);
  window.alert(`已保存方案：${b.name}。本地已存 ${loadBookmarks().length} 条方案。`);
}
async function onScreen() {
  if (!mapEl.value) return;
  await downloadMapPng(mapEl.value, 'overview-map.png');
}
function onReport() {
  const r = unref(regionKpis);
  downloadTextReport('空间总览', [
    { k: '时间', v: gis.timeSingle },
    { k: '数据版本', v: gis.dataSource },
    { k: '区域', v: gis.region.label },
    { k: '活力', v: String(r.v) },
    { k: '操作模式', v: interMode.value },
  ], 'overview-report.md');
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
  gap: 16px;
  padding: 10px 16px;
  margin: 8px 8px 0;
  flex-wrap: wrap;
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
.seg {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.seg-btn {
  background: var(--bg-deep);
  color: var(--text-muted);
  border: none;
  padding: 4px 10px;
  font-size: 12px;
}
.seg-btn.on {
  background: rgba(61, 156, 245, 0.2);
  color: var(--accent);
}
.compare-hint {
  margin: 0 8px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-muted);
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
  width: 280px;
  flex-shrink: 0;
  padding: 12px;
  overflow: auto;
}
.map-tip {
  font-size: 11px;
  color: var(--accent);
  line-height: 1.4;
  margin: 0 0 8px;
}

.poi-legend {
  margin-top: 10px;
  padding: 10px;
}
.poi-legend-title {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}
.poi-legend-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
}
.poi-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--text-muted);
}
.poi-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}
</style>
