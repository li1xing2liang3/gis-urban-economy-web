<template>
  <div class="page overview">
    <div class="kpi-strip panel">
      <div class="kpi">
        <span class="kpi-label">区域活力（{{ interMode === 'analyze' ? '分析' : interMode === 'compare' ? '对比' : '全局' }}）</span>
        <strong class="kpi-val">{{ overviewKpis.v }}</strong>
        <span class="kpi-range">{{ gis.dataSource }} · {{ gis.region.label }}</span>
        <span v-if="overviewKpis.poiCount > 0" class="kpi-meta">POI {{ overviewKpis.poiCount }}</span>
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
            @click="setInterMode(m.id)"
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

    <div v-if="interMode === 'analyze'" class="mode-hint panel analyze">
      分析模式：已按当前区域过滤 POI 并高亮范围；侧栏统计为区域内聚合值。
    </div>
    <div v-if="interMode === 'compare'" class="mode-hint panel compare">
      <template v-if="comparePair.a != null && comparePair.b != null">
        A/B 活力：{{ gis.timeCompareA }} → <strong>{{ comparePair.a }}</strong> · {{ gis.timeCompareB }} →
        <strong>{{ comparePair.b }}</strong>
        <span v-if="comparePair.delta != null">（Δ {{ comparePair.delta > 0 ? '+' : '' }}{{ comparePair.delta }}）</span>
      </template>
      <template v-else>
        请在顶栏将时间切换为「A/B 对比」并选择两个日期；地图按差值着色（红升绿降）。
      </template>
    </div>

    <Transition name="toast">
      <div v-if="toastMsg" class="toast panel">{{ toastMsg }}</div>
    </Transition>

    <div class="map-area">
      <div ref="mapEl" class="map"></div>
      <aside class="drawer panel">
        <p class="map-tip">
          <template v-if="gis.region.mode === 'point'">在地图上点击设定 1 km 中心。</template>
          <template v-else-if="gis.region.mode === 'box'">在地图上拖出矩形框（按住拖拽）。</template>
          <template v-else-if="gis.region.mode === 'admin'">已高亮 {{ gis.region.adminName }}；可在顶栏切换行政区。</template>
          <template v-else>区域由导航栏统一切换；点选/框选请改顶栏模式。</template>
        </p>
        <LayerTreePanel :layers="layers" />
        <div v-if="demLayerVisible" class="poi-legend panel">
          <div class="poi-legend-title">DEM 山体阴影</div>
          <p class="dem-hint">来源：本地 HillShadeWH.tif · 与 OSM 底图叠加</p>
        </div>
        <div v-if="buildingsLayerVisible && buildingsTileHint" class="poi-legend panel">
          <div class="poi-legend-title">建筑轮廓（Overture）</div>
          <p class="dem-hint">{{ buildingsTileHint }}</p>
        </div>
        <div v-if="poiLayerVisible" class="poi-legend panel">
          <div class="poi-legend-title">POI 点 · 圆形影响区</div>
          <div class="poi-legend-grid">
            <span v-for="item in POI_CATEGORY_LEGEND" :key="item.key" class="poi-legend-item">
              <i class="poi-dot" :style="{ background: poiCategoryColor(item.key) }" />
              {{ item.label }}
            </span>
          </div>
        </div>
        <RegionStatsCard v-if="gis.region.mode !== 'all'" :stats="overviewKpis" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted, onUnmounted, unref } from 'vue';
import L from 'leaflet';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import LayerTreePanel from '@/components/LayerTreePanel.vue';
import RegionStatsCard from '@/components/RegionStatsCard.vue';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { overviewLayerCatalog } from '@/config/layerCatalog';
import type { LayerItem } from '@/types/layer';
import {
  vitalityFillColor,
  popDensityFillColor,
  poiCategoryColor,
  POI_CATEGORY_LEGEND,
  poiInfluenceRadiusM,
  mockHubeiDataPrefix,
  type PoiPointProperties,
} from '@/utils/mockHubeiDataset';
import { gisDataService } from '@/services/gisDataService';
import {
  gis,
  setRegionPoint,
  setRegionBox,
  pushTask,
  updateTask,
} from '@/stores/gisState';
import { addBookmark, downloadMapPng, downloadTextReport, loadBookmarks } from '@/utils/exportAndBookmark';
import {
  aggregateRegionKpis,
  findDistrictFeature,
  poiMatchesRegion,
  vitalityAtMonth,
  type CityTimeseriesEntry,
} from '@/utils/overviewRegionStats';
import {
  loadWuhanHillshadeMeta,
  WUHAN_HILLSHADE_URL,
  type WuhanHillshadeMeta,
} from '@/utils/wuhanHillshade';
import {
  detailLevelForZoom,
  fetchBuildingTile,
  loadWuhanBuildingManifest,
  tilesForViewport,
  type WuhanBuildingManifest,
} from '@/utils/wuhanBuildingTiles';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);

const layers = reactive<LayerItem[]>(JSON.parse(JSON.stringify(overviewLayerCatalog)) as LayerItem[]);
const interMode = ref<'select' | 'analyze' | 'compare'>('select');
const toastMsg = ref('');

const poiFc = ref<FeatureCollection<Point> | null>(null);
const cityUnitsFc = ref<FeatureCollection | null>(null);
const cityTimeseries = ref<CityTimeseriesEntry[]>([]);
const roadsFc = ref<FeatureCollection<LineString> | null>(null);
const buildingsManifest = ref<WuhanBuildingManifest | null>(null);
const buildingsTileHint = ref('');
const hillshadeMeta = ref<WuhanHillshadeMeta | null>(null);

const uiModes = [
  { id: 'select', name: '选择' },
  { id: 'analyze', name: '分析' },
  { id: 'compare', name: '对比' },
] as const;

const activeLayerCount = computed(() => layers.filter((l) => l.visible).length);
const poiLayerVisible = computed(() => layers.find((l) => l.id === 'poi')?.visible === true);
const demLayerVisible = computed(() => layers.find((l) => l.id === 'dem')?.visible === true);
const buildingsLayerVisible = computed(() => layers.find((l) => l.id === 'buildings')?.visible === true);

const overviewKpis = computed(() =>
  aggregateRegionKpis(
    (poiFc.value?.features ?? []) as Feature<Point>[],
    gis.region,
    cityUnitsFc.value,
    gis.uavInVitalityModel,
  ),
);

const comparePair = computed(() => {
  const a = vitalityAtMonth(cityTimeseries.value, gis.region.label, gis.timeCompareA);
  const b = vitalityAtMonth(cityTimeseries.value, gis.region.label, gis.timeCompareB);
  return {
    a,
    b,
    delta: a != null && b != null ? b - a : null,
  };
});

let poiMockLayer: L.Layer | null = null;
let vitalityChoroLayer: L.Layer | null = null;
let popLayer: L.Layer | null = null;
let demLayer: L.Layer | null = null;
let buildingsLayerGroup: L.LayerGroup | null = null;
const buildingsTileMap = new Map<string, L.Layer>();
let buildingsFetchGen = 0;
let buildingsRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let buildingsMapOff: (() => void) | null = null;
const buildingsCanvas = L.canvas({ padding: 0.5 });
let roadsLayer: L.Layer | null = null;
let uavLayer: L.Layer | null = null;
let zhiyanLayer: L.Layer | null = null;
let adminHighlightLayer: L.Layer | null = null;
let analyzeMaskLayer: L.Layer | null = null;
let regionLayer: L.LayerGroup | null = null;
let drawRect: L.Rectangle | null = null;
let isDrawing = false;
let startLL: L.LatLng | null = null;
let handlers: { off: () => void } | null = null;

function layerItem(id: string) {
  return layers.find((l) => l.id === id);
}

function removeMapLayer(layer: L.Layer | null) {
  const map = mapInstance.value;
  if (layer && map) map.removeLayer(layer);
}

function showToast(msg: string) {
  toastMsg.value = msg;
  window.setTimeout(() => {
    toastMsg.value = '';
  }, 2800);
}

function setInterMode(id: 'select' | 'analyze' | 'compare') {
  interMode.value = id;
  if (id === 'analyze') {
    const taskId = pushTask({ name: '总览区域分析', page: 'overview', message: '按当前区域聚合 POI…' });
    window.setTimeout(() => {
      updateTask(taskId, {
        status: 'success',
        message: `区域内 ${overviewKpis.value.poiCount} 个 POI`,
        finishedAt: new Date().toISOString(),
      });
    }, 400);
  }
  if (id === 'compare' && gis.timeMode !== 'compareAB') {
    gis.timeMode = 'compareAB';
  }
  syncAllMapLayers();
}

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
  removeMapLayer(regionLayer);
  regionLayer = null;
  const g = L.layerGroup();
  if (gis.region.mode === 'point' && gis.region.point) {
    const c = gis.region.point;
    L.circle([c.lat, c.lng], { radius: 1000, color: '#3dd68c', fillOpacity: 0.12, weight: 2 }).addTo(g);
    L.circleMarker([c.lat, c.lng], { radius: 5, color: '#3dd68c' }).addTo(g);
  } else if (gis.region.mode === 'box' && gis.region.box) {
    const b = gis.region.box;
    L.rectangle(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      { color: '#f5a623', weight: 2, fillOpacity: 0.1 },
    ).addTo(g);
  }
  g.addTo(map);
  regionLayer = g;
}

function syncAdminHighlight() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(adminHighlightLayer);
  adminHighlightLayer = null;
  if (gis.region.mode !== 'admin' || gis.region.adminName === '武汉市（全市）') return;
  const feat = findDistrictFeature(cityUnitsFc.value, gis.region.adminName);
  if (!feat) return;
  adminHighlightLayer = L.geoJSON(feat, {
    style: {
      fillColor: '#38bdf8',
      fillOpacity: 0.08,
      color: '#38bdf8',
      weight: 3,
      dashArray: '6 4',
    },
  }).addTo(map);
  try {
    map.fitBounds((adminHighlightLayer as L.GeoJSON).getBounds(), { padding: [32, 32], maxZoom: 13 });
  } catch {
    /* ignore */
  }
}

function syncAnalyzeMask() {
  removeMapLayer(analyzeMaskLayer);
  analyzeMaskLayer = null;
}

function syncPoiLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(poiMockLayer);
  poiMockLayer = null;
  const po = layerItem('poi');
  if (!po?.visible || !poiFc.value) return;

  const g = L.layerGroup();
  const poiRenderer = L.canvas({ padding: 0.5 });
  const op = po.opacity ?? 1;
  const analyze = interMode.value === 'analyze' && gis.region.mode !== 'all';

  for (const feat of poiFc.value.features) {
    if (feat.geometry?.type !== 'Point') continue;
    const coords = feat.geometry.coordinates as [number, number];
    const latlng = L.latLng(coords[1], coords[0]);
    const p = (feat.properties ?? {}) as PoiPointProperties;
    const inRegion = poiMatchesRegion(coords[0], coords[1], p, gis.region, cityUnitsFc.value);
    if (analyze && !inRegion) continue;

    const k = p.categoryKey ?? '';
    const col = poiCategoryColor(k);
    const inflM = poiInfluenceRadiusM(p);
    const dim = analyze && inRegion ? 1 : analyze ? 0.35 : 1;
    const popupHtml = `<div style="font-size:12px;"><strong>${p.name ?? ''}</strong><br/><span style="opacity:.85">${p.category ?? ''}</span> · ${p.districtName ?? p.cityName ?? ''}<br/>主商圈半径：${inflM < 1000 ? `${inflM} m` : `${(inflM / 1000).toFixed(2)} km`}</div>`;

    L.circle(latlng, {
      radius: inflM,
      renderer: poiRenderer,
      color: col,
      weight: 1,
      fillColor: col,
      fillOpacity: 0.1 * op * dim,
      opacity: 0.55 * op * dim,
    })
      .bindPopup(popupHtml)
      .addTo(g);

    L.circleMarker(latlng, {
      radius: 3 + Math.round((p.importance ?? 0.55) * 6),
      renderer: poiRenderer,
      color: col,
      fillColor: col,
      fillOpacity: 0.88 * op * dim,
      weight: analyze && inRegion ? 2 : 1,
    })
      .bindPopup(popupHtml)
      .addTo(g);
  }
  g.addTo(map);
  poiMockLayer = g;
}

function syncVitalityLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(vitalityChoroLayer);
  vitalityChoroLayer = null;
  const layerItemVit = layerItem('vitality');
  if (!layerItemVit?.visible || !cityUnitsFc.value) return;

  const op = layerItemVit.opacity ?? 0.35;
  const compare = interMode.value === 'compare';

  vitalityChoroLayer = L.geoJSON(cityUnitsFc.value, {
    style: (feat) => {
      const p = feat.properties as { name?: string; vitalityIdx?: number; tier?: number };
      let val = Number(p?.vitalityIdx ?? 50);
      if (compare && comparePair.value.a != null && comparePair.value.b != null) {
        const districtName = String(p.name ?? '');
        const va = vitalityAtMonth(cityTimeseries.value, districtName, gis.timeCompareA) ?? val;
        const vb = vitalityAtMonth(cityTimeseries.value, districtName, gis.timeCompareB) ?? val;
        val = vb - va + 50;
      }
      const tw = p?.tier === 1 ? 2.2 : p?.tier === 2 ? 1.65 : 1.1;
      const fill = compare
        ? val >= 50
          ? `rgb(${Math.round(180 + (val - 50) * 3)}, ${Math.round(60 - (val - 50))}, 60)`
          : `rgb(60, ${Math.round(140 + (50 - val) * 2)}, 100)`
        : vitalityFillColor(Number(p?.vitalityIdx ?? 50));
      return {
        fillColor: fill,
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
}

function syncPopLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(popLayer);
  popLayer = null;
  const po = layerItem('pop');
  if (!po?.visible || !cityUnitsFc.value) return;

  const densities = cityUnitsFc.value.features.map((f) =>
    Number((f.properties as { popDensity?: number })?.popDensity ?? 0),
  );
  const lo = Math.min(...densities);
  const hi = Math.max(...densities);
  const op = po.opacity ?? 0.75;

  popLayer = L.geoJSON(cityUnitsFc.value, {
    style: (feat) => {
      const pd = Number((feat.properties as { popDensity?: number })?.popDensity ?? lo);
      return {
        fillColor: popDensityFillColor(pd, lo, hi),
        fillOpacity: op * 0.75,
        color: 'rgba(167,139,250,0.6)',
        weight: 1.2,
      };
    },
    onEachFeature: (feat, lyr) => {
      const p = feat.properties as Record<string, unknown>;
      lyr.bindPopup(
        `<div style="font-size:12px;"><strong>${p.name}</strong><br/>人口密度示意 <b>${p.popDensity}</b></div>`,
      );
    },
  }).addTo(map);
}

function syncDemLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(demLayer);
  demLayer = null;
  const po = layerItem('dem');
  if (!po?.visible) return;

  const op = po.opacity ?? 0.7;

  if (hillshadeMeta.value?.bounds) {
    demLayer = L.imageOverlay(WUHAN_HILLSHADE_URL, hillshadeMeta.value.bounds, {
      opacity: op,
      interactive: false,
      attribution: '武汉 DEM 山体阴影',
    }).addTo(map);
    return;
  }

  if (!cityUnitsFc.value) return;

  const demColors: Record<number, string> = {
    1: '#1e3a5f',
    2: '#2d5a87',
    3: '#4a7c59',
    4: '#6b8f71',
  };

  demLayer = L.geoJSON(cityUnitsFc.value, {
    style: (feat) => {
      const tier = Number((feat.properties as { tier?: number })?.tier ?? 3);
      return {
        fillColor: demColors[tier] ?? '#3d5a6c',
        fillOpacity: op * 0.55,
        color: 'rgba(100,116,139,0.4)',
        weight: 1,
      };
    },
  }).addTo(map);
}

function buildingStyle(feat: Feature, opacity: number): L.PathOptions {
  const p = feat.properties as Record<string, unknown> | null;
  const h = Number(p?.height ?? 0);
  const floors = Number(p?.num_floors ?? 0);
  const level = h > 80 || floors > 20 ? 3 : h > 30 || floors > 8 ? 2 : 1;
  const fill = level === 3 ? '#cbd5e1' : level === 2 ? '#94a3b8' : '#64748b';
  return {
    color: '#475569',
    weight: 0.6,
    fillColor: fill,
    fillOpacity: 0.55 * opacity,
  };
}

function clearBuildingsTiles() {
  buildingsTileMap.clear();
  buildingsLayerGroup?.clearLayers();
}

function scheduleBuildingsRefresh() {
  if (buildingsRefreshTimer) clearTimeout(buildingsRefreshTimer);
  buildingsRefreshTimer = setTimeout(() => void refreshBuildingsTiles(), 200);
}

let buildingsLastOpacity = -1;

async function refreshBuildingsTiles() {
  const map = mapInstance.value;
  const po = layerItem('buildings');
  if (!map || !po?.visible) return;

  if (!buildingsManifest.value) {
    buildingsTileHint.value = '建筑索引加载中…';
    return;
  }

  const op = po.opacity ?? 0.85;
  if (op !== buildingsLastOpacity) {
    clearBuildingsTiles();
    buildingsLastOpacity = op;
  }

  const zoom = map.getZoom();
  const level = detailLevelForZoom(zoom);
  if (!level) {
    buildingsTileHint.value = '放大至 12 级及以上显示建筑轮廓（视口分区加载）';
    clearBuildingsTiles();
    return;
  }

  const bounds = map.getBounds();
  const viewport = {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  };
  const needed = tilesForViewport(buildingsManifest.value, viewport);
  const neededKeys = new Set(needed.map((t) => `${level}:${t.id}`));
  buildingsTileHint.value = `建筑 · ${level} 精度 · 已加载 ${neededKeys.size} 个视口分区（缩放 ${zoom}）`;

  for (const [key, layer] of buildingsTileMap) {
    if (!neededKeys.has(key)) {
      buildingsLayerGroup?.removeLayer(layer);
      buildingsTileMap.delete(key);
    }
  }

  const gen = ++buildingsFetchGen;

  for (const tile of needed) {
    const key = `${level}:${tile.id}`;
    if (buildingsTileMap.has(key)) continue;
    const fc = await fetchBuildingTile(level, tile.id);
    if (gen !== buildingsFetchGen) return;
    if (!fc?.features?.length) continue;

    const layer = L.geoJSON(fc, {
      renderer: buildingsCanvas,
      style: (feat) => buildingStyle(feat as Feature, op),
      onEachFeature: (feat, lyr) => {
        const p = feat.properties as Record<string, unknown>;
        const h = p.height != null ? `${p.height} m` : '—';
        const f = p.num_floors != null ? `${p.num_floors} 层` : '—';
        lyr.bindTooltip(`建筑 · 高 ${h} · ${f}`, { sticky: true });
      },
    });
    buildingsTileMap.set(key, layer);
    buildingsLayerGroup?.addLayer(layer);
  }
}

function syncBuildingsLayer() {
  const map = mapInstance.value;
  if (!map) return;
  const po = layerItem('buildings');

  if (!buildingsLayerGroup) buildingsLayerGroup = L.layerGroup();

  if (!po?.visible) {
    if (map.hasLayer(buildingsLayerGroup)) map.removeLayer(buildingsLayerGroup);
    clearBuildingsTiles();
    buildingsTileHint.value = '';
    return;
  }

  if (!map.hasLayer(buildingsLayerGroup)) buildingsLayerGroup.addTo(map);
  scheduleBuildingsRefresh();
}

function syncRoadsLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(roadsLayer);
  roadsLayer = null;
  const po = layerItem('roads');
  if (!po?.visible || !roadsFc.value) return;

  const op = po.opacity ?? 1;
  roadsLayer = L.geoJSON(roadsFc.value, {
    style: (feat) => {
      const level = String((feat.properties as { level?: string })?.level ?? 'secondary');
      return {
        color: level === 'primary' ? '#f8fafc' : level === 'waterfront' ? '#38bdf8' : '#94a3b8',
        weight: level === 'primary' ? 4 : 2.5,
        opacity: op,
      };
    },
    onEachFeature: (feat, lyr) => {
      const name = (feat.properties as { name?: string })?.name;
      if (name) lyr.bindTooltip(name);
    },
  }).addTo(map);
}

async function syncUavLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(uavLayer);
  uavLayer = null;
  const po = layerItem('uav');
  if (!po?.visible) return;

  try {
    const fc = await gisDataService.getUavCoverages();
    const op = po.opacity ?? 0.9;
    uavLayer = L.geoJSON(fc, {
      style: {
        color: '#22d3ee',
        weight: 2,
        fillColor: '#06b6d4',
        fillOpacity: 0.15 * op,
        dashArray: '4 6',
      },
      onEachFeature: (feat, lyr) => {
        const p = feat.properties as Record<string, unknown>;
        lyr.bindPopup(`<strong>${p.routeName ?? '无人机覆盖'}</strong><br/>${p.district ?? ''}`);
      },
    }).addTo(map);
  } catch {
    /* ignore */
  }
}

async function syncZhiyanLayer() {
  const map = mapInstance.value;
  if (!map) return;
  removeMapLayer(zhiyanLayer);
  zhiyanLayer = null;
  const po = layerItem('zhiyan');
  if (!po?.visible) return;

  try {
    const fc = await gisDataService.getZhiyanObservations();
    const op = po.opacity ?? 0.8;
    const g = L.layerGroup();
    for (const feat of fc.features) {
      if (feat.geometry?.type !== 'Point') continue;
      const [lng, lat] = feat.geometry.coordinates;
      const p = feat.properties as { name?: string; flowIndex?: number; anomalyScore?: number };
      const r = 4 + Math.round((p.flowIndex ?? 50) / 15);
      L.circleMarker([lat, lng], {
        radius: r,
        color: '#a855f7',
        fillColor: '#c084fc',
        fillOpacity: 0.85 * op,
        weight: 1,
      })
        .bindPopup(`<strong>${p.name ?? '智眼观测'}</strong><br/>客流 ${p.flowIndex ?? '—'} · 异常 ${p.anomalyScore ?? '—'}`)
        .addTo(g);
    }
    g.addTo(map);
    zhiyanLayer = g;
  } catch {
    /* ignore */
  }
}

function syncAllMapLayers() {
  syncRegionOverlays();
  syncAdminHighlight();
  syncAnalyzeMask();
  syncDemLayer();
  syncVitalityLayer();
  syncPopLayer();
  syncPoiLayer();
  syncBuildingsLayer();
  syncRoadsLayer();
  void syncUavLayer();
  void syncZhiyanLayer();
}

function attachBoxDraw() {
  const map = mapInstance.value;
  if (!map) return;
  removeDrawHandlers();
  if (gis.region.mode !== 'box') return;

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
    drawRect = L.rectangle(L.latLngBounds(startLL, e.latlng), {
      color: '#f5a623',
      weight: 2,
      fillOpacity: 0.1,
    }).addTo(map);
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
    syncAllMapLayers();
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

async function loadRoadsFc(): Promise<FeatureCollection<LineString> | null> {
  for (const url of ['/geo/wuhan/roads.geojson', `${mockHubeiDataPrefix()}roads-demo.geojson`]) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as FeatureCollection<LineString>;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function loadBaseData() {
  try {
    const [poi, units, ts, roads, hillMeta, bManifest] = await Promise.all([
      gisDataService.getPoiSample(),
      gisDataService.getCityUnits(),
      gisDataService.getCityTimeseries(),
      loadRoadsFc(),
      loadWuhanHillshadeMeta(),
      loadWuhanBuildingManifest(),
    ]);
    poiFc.value = poi as FeatureCollection<Point>;
    cityUnitsFc.value = units;
    hillshadeMeta.value = hillMeta;
    roadsFc.value = roads;
    buildingsManifest.value = bManifest;
    const tsBody = ts as { cities?: CityTimeseriesEntry[] };
    cityTimeseries.value = tsBody.cities ?? [];
  } catch (e) {
    console.warn('[Overview] 基础数据加载失败', e);
  }
  syncAllMapLayers();
}

watch(
  [mapInstance, () => gis.region, interMode, () => gis.timeCompareA, () => gis.timeCompareB],
  () => {
    if (!mapInstance.value) return;
    attachBoxDraw();
    syncAllMapLayers();
  },
  { deep: true, immediate: true },
);

watch(
  () => layers.map((l) => `${l.id}:${l.visible}:${l.opacity}`).join('|'),
  () => syncAllMapLayers(),
);

const onMapClick = (e: L.LeafletMouseEvent) => {
  if (gis.region.mode !== 'point') return;
  setRegionPoint(e.latlng.lat, e.latlng.lng);
  syncAllMapLayers();
};

watch(
  mapInstance,
  (m, old) => {
    old?.off('click', onMapClick);
    buildingsMapOff?.();
    buildingsMapOff = null;
    m?.on('click', onMapClick);
    if (m) {
      const onViewChange = () => {
        if (layerItem('buildings')?.visible) scheduleBuildingsRefresh();
      };
      m.on('moveend zoomend', onViewChange);
      buildingsMapOff = () => {
        m.off('moveend zoomend', onViewChange);
      };
    }
  },
  { immediate: true },
);

onMounted(() => {
  void loadBaseData();
});

onUnmounted(() => {
  mapInstance.value?.off('click', onMapClick);
  buildingsMapOff?.();
  if (buildingsRefreshTimer) clearTimeout(buildingsRefreshTimer);
  removeDrawHandlers();
});

function onBookmark() {
  const b = addBookmark('空间总览图层方案', layers);
  showToast(`已保存「${b.name}」，共 ${loadBookmarks().length} 条方案`);
}

async function onScreen() {
  if (!mapEl.value) return;
  await downloadMapPng(mapEl.value, 'overview-map.png');
  showToast('截图已下载 overview-map.png');
}

function onReport() {
  const r = unref(overviewKpis);
  downloadTextReport(
    '空间总览',
    [
      { k: '时间', v: gis.timeSingle },
      { k: '数据版本', v: gis.dataSource },
      { k: '区域', v: gis.region.label },
      { k: '活力', v: String(r.v) },
      { k: 'POI 数', v: String(r.poiCount) },
      { k: '操作模式', v: interMode.value },
      { k: '可见图层', v: String(activeLayerCount.value) },
    ],
    'overview-report.md',
  );
  showToast('报告已下载 overview-report.md');
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
  cursor: pointer;
}

.seg-btn.on {
  background: rgba(61, 156, 245, 0.2);
  color: var(--accent);
}

.mode-hint {
  margin: 0 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.45;
}

.mode-hint.analyze {
  color: var(--success);
  border-left: 3px solid var(--success);
}

.mode-hint.compare {
  color: var(--accent);
  border-left: 3px solid var(--accent);
}

.toast {
  position: fixed;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4000;
  padding: 10px 18px;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
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

.dem-hint {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
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
