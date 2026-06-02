<template>
  <div class="page low">
    <main class="flight-main">
      <figure v-if="selectedRoute?.imageUrl" class="route-image route-image-main">
        <div class="route-image-label">航线真实影像飞行仿真</div>
        <div class="route-image-stage">
          <img :src="selectedRoute.imageUrl" :alt="selectedRoute.imageTitle ?? selectedRoute.name" loading="lazy" />
          <svg
            class="flight-overlay"
            :viewBox="`0 0 ${previewWidth} ${previewHeight}`"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter id="uavFlightGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="1.25" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="uavProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="56%" stop-color="#fbbf24" />
                <stop offset="100%" stop-color="#fb7185" />
              </linearGradient>
              <radialGradient id="uavBodyHighlight" cx="42%" cy="24%" r="68%">
                <stop offset="0%" stop-color="#fff7ed" />
                <stop offset="36%" stop-color="#fbbf24" />
                <stop offset="100%" stop-color="#d97706" />
              </radialGradient>
            </defs>
            <polyline class="flight-original" :points="originalPreviewPolyline" />
            <polyline class="flight-shadow" :points="previewPolyline" />
            <polyline class="flight-corridor" :points="previewPolyline" />
            <polyline class="flight-track" :points="previewPolyline" />
            <polyline class="flight-track-core" :points="previewPolyline" />
            <polyline class="flight-progress-halo" :points="flightProgressLine" />
            <polyline class="flight-progress" :points="flightProgressLine" />
            <g
              v-for="(point, idx) in previewPoints"
              :key="idx"
              :class="['flight-waypoint-node', { start: idx === 0, end: idx === previewPoints.length - 1 }]"
              :transform="`translate(${point.x} ${point.y})`"
            >
              <circle class="flight-waypoint-halo" r="2.15" />
              <circle class="flight-waypoint" r="1.05" />
            </g>
            <g class="drone-ground-shadow" :transform="droneShadowTransform">
              <ellipse cx="0" cy="0" rx="4.9" ry="1.65" />
            </g>
            <g class="scan-cone" :transform="droneTransform">
              <path d="M -5.8 3.8 L 0 22 L 5.8 3.8 Z" />
            </g>
            <g class="drone-marker" :transform="droneTransform">
              <circle class="drone-pulse" r="5.8" />
              <g class="drone-rotor-arms">
                <line x1="-5.8" y1="-4.6" x2="5.8" y2="4.6" />
                <line x1="5.8" y1="-4.6" x2="-5.8" y2="4.6" />
              </g>
              <g class="drone-rotors">
                <circle cx="-6.6" cy="-5.2" r="2.1" />
                <circle cx="6.6" cy="-5.2" r="2.1" />
                <circle cx="-6.6" cy="5.2" r="2.1" />
                <circle cx="6.6" cy="5.2" r="2.1" />
              </g>
              <path class="drone-body" d="M 0 -5.8 L 4.1 -1.1 L 2.1 5.7 L 0 6.9 L -2.1 5.7 L -4.1 -1.1 Z" />
              <circle class="drone-camera" cx="0" cy="1.4" r="1.05" />
            </g>
          </svg>
          <div class="flight-readout">
            <span>{{ selectedRoute.district }}</span>
            <span>{{ activePlan.label }}</span>
            <strong>{{ flightPercent }}%</strong>
          </div>
        </div>
        <div class="flight-control">
          <button type="button" class="flight-btn" @click="toggleFlight">
            {{ isFlightPlaying ? '暂停仿真' : '开始仿真' }}
          </button>
          <div class="flight-bar" aria-hidden="true">
            <i :style="{ width: `${flightPercent}%` }"></i>
          </div>
        </div>
        <figcaption>
          <strong>{{ selectedRoute.imageTitle ?? selectedRoute.name }}</strong>
          <span>{{ selectedRoute.imageCredit }} · {{ selectedRoute.imageLicense }}</span>
          <a v-if="selectedRoute.imageSource" :href="selectedRoute.imageSource" target="_blank" rel="noreferrer">
            查看来源
          </a>
        </figcaption>
      </figure>
    </main>

    <aside class="side panel">
      <h3 class="title">低空无人机路径</h3>
      <p class="desc">
        参考“武汉智眼”的人流、车流与城市运行感知框架，将无人机航线作为精细尺度补充数据，用于活力评估、商圈识别和三维展示。
      </p>

      <div class="summary">
        <div>
          <span>参与模型</span>
          <strong>{{ modelRouteCount }}</strong>
        </div>
        <div>
          <span>平均质量</span>
          <strong>{{ avgQuality }}%</strong>
        </div>
        <div>
          <span>智眼同步</span>
          <strong>{{ zhiyanSyncCount }}</strong>
        </div>
      </div>

      <section class="route-plan panel">
        <div class="route-plan-head">
          <div>
            <span>航线优化设计</span>
            <strong>{{ activePlan.label }}</strong>
          </div>
          <button type="button" class="mini-btn" @click="applyRoutePlan">应用方案</button>
        </div>
        <div class="plan-modes" role="tablist" aria-label="航线优化策略">
          <button
            v-for="mode in routePlanModes"
            :key="mode.id"
            type="button"
            :class="{ active: routePlanMode === mode.id }"
            @click="setRoutePlanMode(mode.id)"
          >
            <strong>{{ mode.label }}</strong>
            <span>{{ mode.short }}</span>
          </button>
        </div>
        <div class="plan-metrics">
          <div v-for="metric in routePlanMetrics" :key="metric.label">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
          </div>
        </div>
        <p class="plan-note">{{ activePlan.desc }}</p>
      </section>

      <section class="map-preview">
        <div class="map-preview-head">
          <div>
            <span>地图数据预览</span>
            <strong>{{ selectedRoute?.name ?? '未选择航线' }}</strong>
          </div>
          <button type="button" class="mini-btn" @click="focusRoute">定位</button>
        </div>
        <div ref="mapEl" class="map"></div>
      </section>

      <section class="cloud-panel panel">
        <div class="cloud-head">
          <div>
            <span>低空云处理</span>
            <strong>{{ cloudStatusText }}</strong>
          </div>
          <button type="button" class="mini-btn" :disabled="isCloudRunning" @click="runCloudPipeline">
            {{ isCloudRunning ? '处理中' : '提交' }}
          </button>
        </div>
        <div class="cloud-progress" aria-hidden="true">
          <b :style="{ width: `${cloudProgress}%` }"></b>
        </div>
        <ol class="cloud-stages">
          <li
            v-for="stage in cloudStages"
            :key="stage.id"
            :class="{ active: stage.active, done: stage.done }"
          >
            <i></i>
            <div>
              <strong>{{ stage.name }}</strong>
              <span>{{ stage.desc }}</span>
            </div>
          </li>
        </ol>
        <div class="cloud-metrics">
          <div v-for="metric in cloudMetrics" :key="metric.label">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
          </div>
        </div>
        <div class="api-strip" aria-label="低空云接口状态">
          <span>REST API</span>
          <span>SDK</span>
          <span>任务追踪</span>
        </div>
      </section>

      <ul class="routes">
        <li
          v-for="route in routes"
          :key="route.id"
          :class="['route-row', { active: route.id === activeRouteId }]"
          @click="selectRoute(route.id)"
        >
          <div class="src-head">
            <strong>{{ route.name }}</strong>
            <span class="tag">{{ route.status }}</span>
          </div>
          <div class="meta">
            {{ route.time }} · {{ route.res }} · {{ route.altitude }}m · {{ route.speed }}m/s
          </div>
          <div class="quality">
            <span>路径质量</span>
            <i><b :style="{ width: route.quality + '%' }"></b></i>
            <em>{{ route.quality }}%</em>
          </div>
          <label class="check" @click.stop>
            <input v-model="route.overlay" type="checkbox" @change="drawUav" />
            地图叠加路径
          </label>
          <label class="check" @click.stop>
            <input v-model="route.model" type="checkbox" @change="syncModel" />
            参与活力 / 商圈模型
          </label>
        </li>
      </ul>

      <div class="ops">
        <button type="button" class="btn btn-primary" @click="simulateTask">生成路径分析任务</button>
        <button type="button" class="btn" @click="focusRoute">定位当前航线</button>
      </div>

      <div class="zhiyan panel">
        <h4>智眼参考联动</h4>
        <p>以智眼型人车热力作为“何处需要低空复核”的触发条件，无人机路径补充影像、覆盖质量与局部三维细节。</p>
        <ul>
          <li>热力异常：触发低空巡航路径</li>
          <li>商圈复核：补充 POI 密集区影像</li>
          <li>模型输入：质量达标后进入活力模型</li>
        </ul>
      </div>

      <LayerTreePanel :layers="layers" />

      <p v-if="sources.some((s) => s.model)" class="boost">
        对活力分析精度提升约：{{ (gis.uavQualityBoost * 100).toFixed(0) }}%
      </p>

      <div class="links">
        <RouterLink
          class="btn btn-ghost"
          :to="{ name: 'scene3d', query: { r: routePointQuery } }"
        >
          打开三维视点（带航线位置）
        </RouterLink>
        <RouterLink class="btn btn-ghost" :to="{ name: 'overview', query: { r: routePointQuery } }">
          同位置二维总览
        </RouterLink>
        <RouterLink class="btn btn-ghost" to="/vitality">精细区域 → 经济活力</RouterLink>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import L from 'leaflet';
import LayerTreePanel from '@/components/LayerTreePanel.vue';
import { useLeafletMap } from '@/composables/useLeafletMap';
import { WUHAN_CENTER } from '@/utils/mapConstants';
import { gis, pushTask, setUavRouteSummary, updateTask } from '@/stores/gisState';
import { gisDataService, type UavRoute } from '@/services/gisDataService';
import { lowAltitudeLayerCatalog } from '@/config/layerCatalog';
import type { FeatureCollection } from 'geojson';

const mapEl = ref<HTMLElement | null>(null);
const mapInstance = useLeafletMap(mapEl);
const previewWidth = 100;
const previewHeight = 56;

const routes = reactive<UavRoute[]>([]);
const activeRouteId = ref(gis.selectedUavRouteId);
const layers = ref(JSON.parse(JSON.stringify(lowAltitudeLayerCatalog)));
const flightProgress = ref(0);
const isFlightPlaying = ref(true);
const uavCoverages = ref<FeatureCollection | null>(null);
const zhiyanObservations = ref<FeatureCollection | null>(null);
const cloudProgress = ref(68);
const cloudStageIndex = ref(2);
const isCloudRunning = ref(false);
const routePlanMode = ref<RoutePlanMode>('safe');

const sources = routes;
type RoutePlanMode = 'safe' | 'coverage' | 'fast';
const routePlanModes: Array<{ id: RoutePlanMode; label: string; short: string; desc: string }> = [
  { id: 'safe', label: '安全巡航', short: '避障优先', desc: '抬高跨江与主干道段高度，转弯更平滑，适合城市低空常态巡检。' },
  { id: 'coverage', label: '覆盖优先', short: '补采盲区', desc: '在重点片区增加交叉补采点，提高建筑立面、江岸和商圈边界覆盖率。' },
  { id: 'fast', label: '效率优先', short: '缩短航程', desc: '减少回折点并压缩转弯半径，适合快速复核热力异常与临时任务。' },
];
const cloudStageTemplates = [
  { id: 'upload', name: '影像接入', desc: '航拍影像、POS 与航线元数据入库' },
  { id: 'rebuild', name: '实景重建', desc: '空三、密集匹配与三维瓦片生成' },
  { id: 'ai', name: 'AI 识别', desc: '识别屋顶起降点、障碍物与人车异常' },
  { id: 'publish', name: '服务发布', desc: '输出 3D Tiles、正射图与 API 索引' },
];

const selectedRoute = computed(() => routes.find((r) => r.id === activeRouteId.value) ?? routes[0] ?? null);
const modelRouteCount = computed(() => routes.filter((r) => r.model).length);
const zhiyanSyncCount = computed(() => routes.filter((r) => r.zhiyanSync).length);
const avgQuality = computed(() => {
  if (!routes.length) return 0;
  return Math.round(routes.reduce((sum, r) => sum + r.quality, 0) / routes.length);
});
const routePointQuery = computed(() => {
  const p = optimizedWaypoints.value[0] ?? selectedRoute.value?.waypoints[0] ?? WUHAN_CENTER;
  return `p:${p[0]},${p[1]}`;
});
const optimizedWaypoints = computed(() => optimizeRouteWaypoints(selectedRoute.value?.waypoints ?? [], routePlanMode.value));
const previewPoints = computed(() => toPreviewPoints(optimizedWaypoints.value));
const originalPreviewPoints = computed(() => toPreviewPoints(selectedRoute.value?.waypoints ?? []));
const previewPolyline = computed(() => pointsToPolyline(previewPoints.value));
const originalPreviewPolyline = computed(() => pointsToPolyline(originalPreviewPoints.value));
const flightSample = computed(() => samplePreviewRoute(previewPoints.value, flightProgress.value));
const flightProgressLine = computed(() => pointsToPolyline(progressPreviewPoints(previewPoints.value, flightProgress.value)));
const flightPercent = computed(() => Math.round(flightProgress.value * 100));
const droneTransform = computed(
  () => `translate(${flightSample.value.x.toFixed(2)} ${flightSample.value.y.toFixed(2)}) rotate(${flightSample.value.angle.toFixed(2)})`,
);
const droneShadowTransform = computed(
  () => `translate(${(flightSample.value.x + 1.7).toFixed(2)} ${(flightSample.value.y + 2.25).toFixed(2)}) rotate(${flightSample.value.angle.toFixed(2)})`,
);
const cloudStages = computed(() =>
  cloudStageTemplates.map((stage, idx) => ({
    ...stage,
    active: idx === cloudStageIndex.value,
    done: idx < cloudStageIndex.value || cloudProgress.value >= 100,
  })),
);
const cloudStatusText = computed(() => {
  if (cloudProgress.value >= 100) return '三维成果已发布';
  if (isCloudRunning.value) return cloudStageTemplates[cloudStageIndex.value]?.name ?? '处理中';
  return '等待新航线提交';
});
const cloudMetrics = computed(() => {
  const route = selectedRoute.value;
  return [
    { label: '影像质量', value: route ? `${route.quality}%` : '--' },
    { label: '建模精度', value: route?.res ?? '--' },
    { label: '服务延迟', value: isCloudRunning.value ? '1.8s' : '0.9s' },
  ];
});
const activePlan = computed(() => routePlanModes.find((mode) => mode.id === routePlanMode.value) ?? routePlanModes[0]);
const routePlanMetrics = computed(() => {
  const original = selectedRoute.value?.waypoints ?? [];
  const planned = optimizedWaypoints.value;
  const originalDistance = routeDistanceKm(original);
  const plannedDistance = routeDistanceKm(planned);
  const route = selectedRoute.value;
  const minutes = route?.speed ? (plannedDistance * 1000) / route.speed / 60 : 0;
  const coverage = Math.round(Math.min(96, (route?.quality ?? 80) + (routePlanMode.value === 'coverage' ? 10 : routePlanMode.value === 'safe' ? 5 : 2)));
  const risk = routePlanMode.value === 'safe' ? '低' : routePlanMode.value === 'coverage' ? '中低' : '中';
  const delta = originalDistance ? Math.round(((plannedDistance - originalDistance) / originalDistance) * 100) : 0;
  return [
    { label: '预计航程', value: `${plannedDistance.toFixed(1)} km` },
    { label: '时长', value: `${Math.max(1, Math.round(minutes))} min` },
    { label: '覆盖率', value: `${coverage}%` },
    { label: '风险', value: risk },
    { label: '航程变化', value: `${delta > 0 ? '+' : ''}${delta}%` },
  ];
});

let routeLayer: L.LayerGroup | null = null;
let backendContextLayer: L.LayerGroup | null = null;
let mapDroneMarker: L.Marker | null = null;
let flightFrame = 0;
let lastFlightTick = 0;

type PreviewPoint = { x: number; y: number };

function toPreviewPoints(path: [number, number][]): PreviewPoint[] {
  if (!path.length) return [{ x: previewWidth / 2, y: previewHeight / 2 }];
  const lats = path.map((p) => p[0]);
  const lngs = path.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padX = 12;
  const padY = 10;
  const spanLat = Math.max(0.0001, maxLat - minLat);
  const spanLng = Math.max(0.0001, maxLng - minLng);

  return path.map(([lat, lng]) => ({
    x: padX + ((lng - minLng) / spanLng) * (previewWidth - padX * 2),
    y: padY + ((maxLat - lat) / spanLat) * (previewHeight - padY * 2),
  }));
}

function pointsToPolyline(points: PreviewPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function optimizeRouteWaypoints(path: [number, number][], mode: RoutePlanMode): [number, number][] {
  if (path.length < 2) return path;
  if (mode === 'fast') return simplifyRoute(path);

  const result: [number, number][] = [];
  path.forEach((point, idx) => {
    result.push(point);
    if (idx >= path.length - 1) return;
    const next = path[idx + 1];
    const mid = midpoint(point, next);
    const offset = routeNormalOffset(point, next, mode === 'coverage' ? 0.0042 : 0.0024, idx % 2 === 0 ? 1 : -1);
    if (mode === 'coverage') {
      result.push([mid[0] + offset[0], mid[1] + offset[1]]);
    } else if (idx > 0 && idx < path.length - 2) {
      result.push([mid[0] + offset[0], mid[1] + offset[1]]);
    }
  });
  return smoothRoute(result);
}

function simplifyRoute(path: [number, number][]): [number, number][] {
  if (path.length <= 3) return path;
  const result: [number, number][] = [path[0]];
  path.slice(1, -1).forEach((point, idx) => {
    if (idx % 2 === 0) result.push(point);
  });
  result.push(path[path.length - 1]);
  return smoothRoute(result, 0.18);
}

function smoothRoute(path: [number, number][], strength = 0.28): [number, number][] {
  if (path.length < 3) return path;
  return path.map((point, idx) => {
    if (idx === 0 || idx === path.length - 1) return point;
    const prev = path[idx - 1];
    const next = path[idx + 1];
    return [
      point[0] * (1 - strength) + ((prev[0] + next[0]) / 2) * strength,
      point[1] * (1 - strength) + ((prev[1] + next[1]) / 2) * strength,
    ];
  });
}

function midpoint(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function routeNormalOffset(a: [number, number], b: [number, number], size: number, direction: number): [number, number] {
  const dx = b[1] - a[1];
  const dy = b[0] - a[0];
  const len = Math.hypot(dx, dy) || 1;
  return [(-dx / len) * size * direction, (dy / len) * size * direction];
}

function segmentLengths(points: PreviewPoint[]) {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    lengths.push(len);
    total += len;
  }
  return { lengths, total };
}

function samplePreviewRoute(points: PreviewPoint[], progress: number) {
  if (!points.length) return { x: previewWidth / 2, y: previewHeight / 2, angle: 0 };
  if (points.length === 1) return { ...points[0], angle: 0 };
  const { lengths, total } = segmentLengths(points);
  const target = total * progress;
  let travelled = 0;

  for (let i = 0; i < lengths.length; i += 1) {
    const len = lengths[i];
    if (target <= travelled + len || i === lengths.length - 1) {
      const a = points[i];
      const b = points[i + 1];
      const local = len ? (target - travelled) / len : 0;
      return {
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local,
        angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90,
      };
    }
    travelled += len;
  }

  const last = points[points.length - 1];
  return { ...last, angle: 0 };
}

function progressPreviewPoints(points: PreviewPoint[], progress: number): PreviewPoint[] {
  if (points.length < 2) return points;
  const { lengths, total } = segmentLengths(points);
  const target = total * progress;
  const result: PreviewPoint[] = [points[0]];
  let travelled = 0;

  for (let i = 0; i < lengths.length; i += 1) {
    const len = lengths[i];
    const a = points[i];
    const b = points[i + 1];
    if (target >= travelled + len) {
      result.push(b);
    } else {
      const local = len ? Math.max(0, (target - travelled) / len) : 0;
      result.push({
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local,
      });
      break;
    }
    travelled += len;
  }

  return result;
}

function routeLengthLatLng(path: [number, number][]) {
  let total = 0;
  const lengths: number[] = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const [lat1, lng1] = path[i];
    const [lat2, lng2] = path[i + 1];
    const latScale = 111_000;
    const lngScale = 111_000 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
    const len = Math.hypot((lat2 - lat1) * latScale, (lng2 - lng1) * lngScale);
    lengths.push(len);
    total += len;
  }
  return { lengths, total };
}

function routeDistanceKm(path: [number, number][]) {
  return routeLengthLatLng(path).total / 1000;
}

function sampleLatLngRoute(path: [number, number][], progress: number) {
  if (!path.length) return { latlng: L.latLng(WUHAN_CENTER[0], WUHAN_CENTER[1]), angle: 0 };
  if (path.length === 1) return { latlng: L.latLng(path[0][0], path[0][1]), angle: 0 };

  const { lengths, total } = routeLengthLatLng(path);
  const target = total * progress;
  let travelled = 0;

  for (let i = 0; i < lengths.length; i += 1) {
    const len = lengths[i];
    if (target <= travelled + len || i === lengths.length - 1) {
      const [lat1, lng1] = path[i];
      const [lat2, lng2] = path[i + 1];
      const local = len ? (target - travelled) / len : 0;
      return {
        latlng: L.latLng(lat1 + (lat2 - lat1) * local, lng1 + (lng2 - lng1) * local),
        angle: (Math.atan2(lat2 - lat1, lng2 - lng1) * 180) / Math.PI,
      };
    }
    travelled += len;
  }

  const [lat, lng] = path[path.length - 1];
  return { latlng: L.latLng(lat, lng), angle: 0 };
}

function setRoutePlanMode(mode: RoutePlanMode) {
  routePlanMode.value = mode;
  flightProgress.value = 0;
  drawUav();
}

function applyRoutePlan() {
  const route = selectedRoute.value;
  if (!route) return;
  const id = pushTask({
    name: `航线优化设计 · ${route.district}`,
    page: 'lowaltitude',
    message: `已应用${activePlan.value.label}方案，正在同步地图与三维视点`,
  });
  updateTask(id, {
    status: 'success',
    message: `${route.name} 已生成 ${optimizedWaypoints.value.length} 个优化航点`,
    finishedAt: new Date().toISOString(),
  });
  drawUav();
}

function droneMapIcon(angle: number) {
  return L.divIcon({
    className: 'uav-map-drone-icon',
    html: `
      <div class="uav-map-drone-wrap" style="--uav-rotation:${angle}deg">
        <span class="uav-map-drone-scan"></span>
        <span class="uav-map-drone-pulse"></span>
        <span class="uav-map-drone-core">
          <i class="arm arm-a"></i>
          <i class="arm arm-b"></i>
          <b class="rotor r1"></b>
          <b class="rotor r2"></b>
          <b class="rotor r3"></b>
          <b class="rotor r4"></b>
          <em></em>
        </span>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function waypointIcon(label: string, active: boolean, endpoint: 'start' | 'end' | 'mid' = 'mid') {
  return L.divIcon({
    className: 'uav-waypoint-icon',
    html: `<span class="${active ? 'active' : ''} ${endpoint}">${label}</span>`,
    iconSize: endpoint === 'mid' ? [22, 22] : [26, 26],
    iconAnchor: endpoint === 'mid' ? [11, 11] : [13, 13],
  });
}

function updateMapDroneMarker() {
  const map = mapInstance.value;
  const path = optimizedWaypoints.value;
  if (!map || !path.length) return;

  const sample = sampleLatLngRoute(path, flightProgress.value);
  if (!mapDroneMarker) {
    mapDroneMarker = L.marker(sample.latlng, {
      icon: droneMapIcon(sample.angle),
      interactive: false,
      zIndexOffset: 800,
    }).addTo(map);
  } else {
    mapDroneMarker.setLatLng(sample.latlng);
    const markerEl = mapDroneMarker.getElement()?.querySelector<HTMLElement>('.uav-map-drone-wrap');
    if (markerEl) {
      markerEl.style.setProperty('--uav-rotation', `${sample.angle}deg`);
    } else {
      mapDroneMarker.setIcon(droneMapIcon(sample.angle));
    }
  }
}

function tickFlight(timestamp: number) {
  if (!lastFlightTick) lastFlightTick = timestamp;
  const delta = timestamp - lastFlightTick;
  lastFlightTick = timestamp;
  if (isFlightPlaying.value) {
    flightProgress.value = (flightProgress.value + delta / 9000) % 1;
    updateMapDroneMarker();
  }
  flightFrame = window.requestAnimationFrame(tickFlight);
}

function toggleFlight() {
  isFlightPlaying.value = !isFlightPlaying.value;
}

function selectRoute(id: string) {
  activeRouteId.value = id;
  gis.selectedUavRouteId = id;
  flightProgress.value = 0;
  isFlightPlaying.value = true;
  syncSelectedSummary();
  drawUav();
}

function syncSelectedSummary() {
  const r = selectedRoute.value;
  setUavRouteSummary(
    r
      ? {
          id: r.id,
          name: r.name,
          quality: r.quality,
          district: r.district,
          zhiyanSync: r.zhiyanSync,
        }
      : null,
  );
}

function syncModel() {
  gis.uavInVitalityModel = routes.some((s) => s.model);
  const qualities = routes.filter((s) => s.model).map((s) => s.quality);
  const maxQ = qualities.length ? Math.max(...qualities) : 0;
  gis.uavQualityBoost = maxQ ? Math.min(0.2, Math.max(0.04, (maxQ - 50) / 250)) : 0.08;
  syncSelectedSummary();
}

function routeCoverage(path: [number, number][]): [number, number][] {
  const lats = path.map((p) => p[0]);
  const lngs = path.map((p) => p[1]);
  const north = Math.max(...lats) + 0.006;
  const south = Math.min(...lats) - 0.006;
  const east = Math.max(...lngs) + 0.008;
  const west = Math.min(...lngs) - 0.008;
  return [
    [north, west],
    [north, east],
    [south, east],
    [south, west],
  ];
}

function drawUav() {
  const map = mapInstance.value;
  if (!map) return;
  window.setTimeout(() => map.invalidateSize(), 0);
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
  if (backendContextLayer) {
    map.removeLayer(backendContextLayer);
    backendContextLayer = null;
  }
  if (mapDroneMarker) {
    map.removeLayer(mapDroneMarker);
    mapDroneMarker = null;
  }

  const g = L.layerGroup();
  routes
    .filter((route) => route.overlay || route.id === activeRouteId.value)
    .forEach((route) => {
      const isActive = route.id === activeRouteId.value;
      const color = isActive ? '#fbbf24' : '#7dd3fc';
      const displayPath = isActive ? optimizeRouteWaypoints(route.waypoints, routePlanMode.value) : route.waypoints;
      if (isActive) {
        L.polyline(route.waypoints, {
          color: '#94a3b8',
          weight: 2,
          dashArray: '2 7',
          opacity: 0.55,
        })
          .bindTooltip('原始航线')
          .addTo(g);
      }
      L.polyline(displayPath, {
        color: isActive ? '#22d3ee' : '#38bdf8',
        weight: isActive ? 18 : 12,
        opacity: isActive ? 0.14 : 0.08,
      }).addTo(g);
      L.polyline(displayPath, {
        color: '#020617',
        weight: isActive ? 6 : 4,
        opacity: isActive ? 0.52 : 0.34,
      }).addTo(g);
      L.polyline(displayPath, {
        color,
        weight: isActive ? 3 : 2,
        dashArray: isActive ? '1 10' : '6 7',
        opacity: route.overlay ? 0.95 : 0.45,
      })
        .bindTooltip(isActive ? `${activePlan.value.label} · 推荐航线` : route.name)
        .addTo(g);
      if (!uavCoverages.value?.features?.some((feature) => feature.properties?.routeId === route.id)) {
        L.polygon(routeCoverage(displayPath), {
          color,
          weight: 1,
          fillColor: color,
          fillOpacity: isActive ? 0.12 : 0.06,
        }).addTo(g);
      }
      displayPath.forEach((p, idx) => {
        const endpoint = idx === 0 ? 'start' : idx === displayPath.length - 1 ? 'end' : 'mid';
        const label = endpoint === 'start' ? '起' : endpoint === 'end' ? '降' : String(idx + 1);
        L.marker(p, {
          icon: waypointIcon(label, isActive, endpoint),
          zIndexOffset: isActive ? 360 : 120,
        })
          .bindTooltip(`${route.name} · WP${idx + 1}`)
          .addTo(g);
      });
    });

  g.addTo(map);
  routeLayer = g;
  drawBackendContext();
  updateMapDroneMarker();
  focusRoute(false);
}

function drawBackendContext() {
  const map = mapInstance.value;
  if (!map) return;
  if (backendContextLayer) {
    map.removeLayer(backendContextLayer);
    backendContextLayer = null;
  }
  const g = L.layerGroup();
  if (uavCoverages.value) {
    L.geoJSON(uavCoverages.value, {
      style: (feature) => {
        const isActive = feature?.properties?.routeId === activeRouteId.value;
        return {
          color: isActive ? '#fbbf24' : '#38bdf8',
          weight: isActive ? 1.4 : 0.9,
          fillColor: isActive ? '#fbbf24' : '#38bdf8',
          fillOpacity: isActive ? 0.14 : 0.07,
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties as Record<string, unknown>;
        layer.bindTooltip(`${p.routeName ?? p.routeId ?? '覆盖范围'} · 质量 ${p.quality ?? '—'}%`);
      },
    }).addTo(g);
  }
  if (zhiyanObservations.value) {
    L.geoJSON(zhiyanObservations.value, {
      filter: (feature) => Boolean(feature.properties?.triggerUav),
      pointToLayer: (feature, latlng) => {
        const score = Number(feature.properties?.anomalyScore ?? 60);
        return L.circleMarker(latlng, {
          radius: 4 + Math.round(score / 24),
          color: '#fb7185',
          fillColor: '#fb7185',
          fillOpacity: 0.72,
          weight: 1,
        });
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties as Record<string, unknown>;
        layer.bindTooltip(`智眼触发 · ${p.cityName ?? ''} · 异常 ${p.anomalyScore ?? '—'}`);
      },
    }).addTo(g);
  }
  g.addTo(map);
  backendContextLayer = g;
}

function focusRoute(force = true) {
  const map = mapInstance.value;
  const route = selectedRoute.value;
  if (!map || !route) return;
  const bounds = L.latLngBounds(optimizedWaypoints.value.length ? optimizedWaypoints.value : route.waypoints);
  if (force || routes.length) map.fitBounds(bounds.pad(0.35), { padding: [36, 36] });
}

function simulateTask() {
  const route = selectedRoute.value;
  if (!route) return;
  const id = pushTask({
    name: `无人机路径质检 · ${route.district}`,
    page: 'lowaltitude',
    message: '正在比对智眼型热力与航线覆盖',
  });
  setTimeout(() => {
    const ok = route.quality >= 70;
    updateTask(id, {
      status: ok ? 'success' : 'error',
      message: ok ? '路径覆盖达标，已进入模型候选' : '覆盖质量偏低，请调整航线或补飞',
      errorCode: ok ? undefined : 'UAV_ROUTE_QC_LOW',
      finishedAt: new Date().toISOString(),
    });
  }, 800);
}

function runCloudPipeline() {
  const route = selectedRoute.value;
  if (!route || isCloudRunning.value) return;
  isCloudRunning.value = true;
  cloudProgress.value = 0;
  cloudStageIndex.value = 0;
  const id = pushTask({
    name: `低空云建模 · ${route.district}`,
    page: 'lowaltitude',
    message: '正在上传航拍影像并准备三维重建',
  });
  const messages = [
    '航拍影像与航线元数据已接入',
    '正在生成正射图与三维瓦片',
    'AI 正在识别低空障碍物与起降点',
    '成果服务发布完成，可供前端 API 调用',
  ];
  let tick = 0;
  const timer = window.setInterval(() => {
    tick += 1;
    cloudProgress.value = Math.min(100, tick * 8);
    cloudStageIndex.value = Math.min(cloudStageTemplates.length - 1, Math.floor(cloudProgress.value / 28));
    updateTask(id, {
      status: 'running',
      message: messages[cloudStageIndex.value] ?? messages[0],
    });
    if (cloudProgress.value >= 100) {
      window.clearInterval(timer);
      isCloudRunning.value = false;
      cloudStageIndex.value = cloudStageTemplates.length - 1;
      updateTask(id, {
        status: 'success',
        message: `低空云成果已发布：${route.name}`,
        finishedAt: new Date().toISOString(),
      });
    }
  }, 180);
}

onMounted(async () => {
  try {
    const [file, coverages, observations] = await Promise.all([
      gisDataService.getUavRoutes(),
      gisDataService.getUavCoverages(),
      gisDataService.getZhiyanObservations(),
    ]);
    routes.splice(0, routes.length, ...file.routes);
    uavCoverages.value = coverages;
    zhiyanObservations.value = observations;
    if (!routes.some((r) => r.id === activeRouteId.value)) {
      activeRouteId.value = routes[0]?.id ?? '';
    }
  } catch {
    routes.splice(0, routes.length, {
      id: 'fallback-route',
      name: '示例低空航线',
      district: '武汉核心区',
      scene: '低空巡航',
      status: '演示',
      time: '2026-04-01 09:00',
      altitude: 120,
      speed: 8,
      res: '5 cm',
      quality: 80,
      zhiyanSync: true,
      model: true,
      overlay: true,
      imageUrl: '/data/uav-images/hankou-dazhimen-preview.jpg',
      imageTitle: '汉口大智门片区高清航拍',
      imageCredit: 'Wikimedia Commons 公开共享图像',
      imageLicense: 'Commons 许可，项目演示引用',
      imageSource:
        'https://commons.wikimedia.org/wiki/File:20240512-%E6%B1%89%E5%8F%A3%E5%A4%A7%E6%99%BA%E9%97%A8%E7%AB%99-%E5%85%A8%E8%A7%88%E4%BF%AF%E7%9E%B0.png',
      waypoints: [
        [WUHAN_CENTER[0] + 0.03, WUHAN_CENTER[1] - 0.02],
        [WUHAN_CENTER[0] + 0.025, WUHAN_CENTER[1]],
        [WUHAN_CENTER[0] + 0.018, WUHAN_CENTER[1] + 0.015],
        [WUHAN_CENTER[0] + 0.01, WUHAN_CENTER[1] + 0.02],
      ],
    });
  } finally {
    syncModel();
    syncSelectedSummary();
    drawUav();
  }
});

onUnmounted(() => {
  if (flightFrame) window.cancelAnimationFrame(flightFrame);
  if (mapDroneMarker && mapInstance.value) {
    mapInstance.value.removeLayer(mapDroneMarker);
    mapDroneMarker = null;
  }
});

flightFrame = window.requestAnimationFrame(tickFlight);

watch(mapInstance, () => drawUav(), { immediate: true });
watch(
  () => gis.selectedUavRouteId,
  (id) => {
    if (id && id !== activeRouteId.value) selectRoute(id);
  },
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

.flight-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: 0;
  padding: 10px;
}

.map {
  width: 100%;
  height: 230px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.side {
  width: 360px;
  flex-shrink: 0;
  padding: 12px;
  overflow: auto;
}

.title {
  margin: 0 0 8px;
  font-size: 15px;
}

.desc {
  margin: 0 0 12px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.summary div {
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.48);
}

.summary span {
  display: block;
  color: var(--text-muted);
  font-size: 10px;
}

.summary strong {
  color: var(--accent);
  font-size: 18px;
}

.route-plan {
  margin-bottom: 12px;
  padding: 10px;
}

.route-plan-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
}

.route-plan-head div {
  display: grid;
  gap: 3px;
}

.route-plan-head span {
  color: var(--text-muted);
  font-size: 10px;
}

.route-plan-head strong {
  color: #fbbf24;
  font-size: 13px;
}

.plan-modes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.plan-modes button {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 7px 6px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.38);
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.plan-modes button.active {
  border-color: rgba(251, 191, 36, 0.62);
  background: rgba(251, 191, 36, 0.11);
}

.plan-modes strong {
  font-size: 11px;
  line-height: 1.2;
}

.plan-modes span {
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.2;
}

.plan-metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-top: 9px;
}

.plan-metrics div {
  min-width: 0;
  padding: 7px 5px;
  border: 1px solid rgba(56, 189, 248, 0.18);
  border-radius: 6px;
  background: rgba(8, 47, 73, 0.2);
}

.plan-metrics span {
  display: block;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.2;
}

.plan-metrics strong {
  display: block;
  margin-top: 3px;
  color: #e0f2fe;
  font-size: 12px;
  line-height: 1.2;
}

.plan-note {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.route-image {
  position: relative;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.52);
}

.route-image-main {
  width: min(100%, 1040px);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 18px 42px rgba(2, 6, 23, 0.24);
}

.route-image-label {
  position: absolute;
  left: 14px;
  top: 14px;
  z-index: 1;
  padding: 5px 10px;
  border: 1px solid rgba(251, 191, 36, 0.45);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.82);
  color: #fbbf24;
  font-size: 13px;
}

.route-image-stage {
  position: relative;
  flex: 0 0 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-deep);
}

.route-image img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  height: clamp(360px, 58vh, 560px);
  object-fit: cover;
  background: var(--bg-deep);
}

.flight-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.flight-shadow,
.flight-track,
.flight-track-core,
.flight-corridor,
.flight-progress,
.flight-progress-halo,
.flight-original {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.flight-original {
  stroke: rgba(203, 213, 225, 0.5);
  stroke-width: 0.9;
  stroke-dasharray: 1.2 2.2;
}

.flight-shadow {
  stroke: rgba(2, 6, 23, 0.72);
  stroke-width: 3.25;
}

.flight-corridor {
  stroke: rgba(34, 211, 238, 0.16);
  stroke-width: 5.8;
  filter: url(#uavFlightGlow);
}

.flight-track {
  stroke: rgba(224, 242, 254, 0.5);
  stroke-dasharray: 0.9 2.4;
  stroke-width: 2.3;
}

.flight-track-core {
  stroke: rgba(56, 189, 248, 0.72);
  stroke-dasharray: 5.5 3.2;
  stroke-width: 1.1;
}

.flight-progress-halo {
  stroke: rgba(251, 191, 36, 0.36);
  stroke-width: 4.6;
  filter: url(#uavFlightGlow);
}

.flight-progress {
  stroke: url(#uavProgressGradient);
  stroke-width: 1.75;
  filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.85));
}

.flight-waypoint-node {
  filter: drop-shadow(0 0 3px rgba(2, 6, 23, 0.75));
}

.flight-waypoint-node.start .flight-waypoint {
  fill: #34d399;
}

.flight-waypoint-node.end .flight-waypoint {
  fill: #fb7185;
}

.flight-waypoint-halo {
  fill: rgba(15, 23, 42, 0.64);
  stroke: rgba(224, 242, 254, 0.38);
  stroke-width: 0.35;
}

.flight-waypoint {
  fill: #e0f2fe;
  stroke: rgba(15, 23, 42, 0.9);
  stroke-width: 0.45;
}

.drone-ground-shadow {
  fill: rgba(2, 6, 23, 0.54);
  filter: blur(0.3px);
}

.scan-cone path {
  fill: rgba(56, 189, 248, 0.13);
  stroke: rgba(56, 189, 248, 0.28);
  stroke-width: 0.32;
  filter: drop-shadow(0 0 4px rgba(56, 189, 248, 0.32));
}

.drone-marker {
  filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.78)) drop-shadow(0 2px 3px rgba(2, 6, 23, 0.75));
}

.drone-rotor-arms {
  stroke: rgba(226, 232, 240, 0.9);
  stroke-width: 0.72;
  stroke-linecap: round;
}

.drone-rotors circle {
  fill: rgba(15, 23, 42, 0.7);
  stroke: rgba(224, 242, 254, 0.86);
  stroke-width: 0.42;
  transform-box: fill-box;
  transform-origin: center;
  animation: rotor-soft-pulse 0.9s ease-in-out infinite alternate;
}

.drone-body {
  fill: #fbbf24;
  stroke: rgba(255, 247, 237, 0.92);
  stroke-width: 0.62;
  stroke-linejoin: round;
}

.drone-camera {
  fill: #0f172a;
  stroke: #38bdf8;
  stroke-width: 0.45;
}

.drone-pulse {
  fill: rgba(251, 191, 36, 0.2);
  stroke: rgba(251, 191, 36, 0.75);
  stroke-width: 0.7;
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0.8);
  animation: pulse-ring 1.4s ease-out infinite;
}

.flight-readout {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 4px 7px;
  border: 1px solid rgba(125, 211, 252, 0.38);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.78);
  font-size: 10px;
}

.flight-readout span {
  color: rgba(226, 232, 240, 0.82);
}

.flight-readout strong {
  color: #fbbf24;
  font-size: 11px;
}

.flight-control {
  display: grid;
  grid-template-columns: 96px 1fr;
  align-items: center;
  gap: 12px;
  padding: 12px 14px 0;
}

.flight-btn {
  height: 24px;
  border: 1px solid rgba(251, 191, 36, 0.42);
  border-radius: 4px;
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
  font-size: 11px;
  cursor: pointer;
}

.flight-btn:hover {
  background: rgba(251, 191, 36, 0.2);
}

.flight-bar {
  height: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.6);
}

.flight-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #fbbf24);
}

.route-image figcaption {
  display: grid;
  gap: 3px;
  padding: 9px 14px 12px;
}

.route-image strong {
  font-size: 13px;
}

.route-image span,
.route-image a {
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.35;
}

.route-image a {
  width: fit-content;
  color: var(--accent);
  text-decoration: none;
}

.route-image a:hover {
  text-decoration: underline;
}

.map-preview {
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.44);
}

.map-preview-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.map-preview-head div {
  display: grid;
  gap: 3px;
}

.map-preview-head span {
  color: var(--text-muted);
  font-size: 10px;
}

.map-preview-head strong {
  font-size: 12px;
}

.mini-btn {
  flex-shrink: 0;
  height: 24px;
  padding: 0 8px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.1);
  color: var(--accent);
  font-size: 11px;
  cursor: pointer;
}

.mini-btn:disabled {
  opacity: 0.62;
  cursor: default;
}

.cloud-panel {
  margin-bottom: 12px;
  padding: 10px;
}

.cloud-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.cloud-head div {
  display: grid;
  gap: 3px;
}

.cloud-head span {
  color: var(--text-muted);
  font-size: 10px;
}

.cloud-head strong {
  color: #e0f2fe;
  font-size: 13px;
}

.cloud-progress {
  height: 7px;
  margin: 10px 0;
  overflow: hidden;
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.58);
}

.cloud-progress b {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #34d399, #fbbf24);
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.34);
  transition: width 0.18s ease;
}

.cloud-stages {
  list-style: none;
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
}

.cloud-stages li {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 8px;
  align-items: flex-start;
  padding: 7px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.34);
}

.cloud-stages i {
  width: 10px;
  height: 10px;
  margin-top: 3px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.72);
  background: rgba(15, 23, 42, 0.7);
}

.cloud-stages li.done i {
  border-color: rgba(52, 211, 153, 0.95);
  background: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.45);
}

.cloud-stages li.active {
  border-color: rgba(251, 191, 36, 0.4);
  background: rgba(251, 191, 36, 0.08);
}

.cloud-stages li.active i {
  border-color: #fbbf24;
  background: #fbbf24;
  box-shadow: 0 0 9px rgba(251, 191, 36, 0.58);
}

.cloud-stages strong {
  display: block;
  font-size: 12px;
}

.cloud-stages span {
  display: block;
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.35;
}

.cloud-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
  margin-top: 9px;
}

.cloud-metrics div {
  padding: 7px;
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 6px;
  background: rgba(8, 47, 73, 0.22);
}

.cloud-metrics span {
  display: block;
  color: var(--text-muted);
  font-size: 10px;
}

.cloud-metrics strong {
  display: block;
  margin-top: 3px;
  color: #fbbf24;
  font-size: 13px;
}

.api-strip {
  display: flex;
  gap: 6px;
  margin-top: 9px;
}

.api-strip span {
  flex: 1;
  display: grid;
  height: 22px;
  place-items: center;
  border: 1px solid rgba(52, 211, 153, 0.26);
  border-radius: 4px;
  background: rgba(6, 78, 59, 0.22);
  color: #bbf7d0;
  font-size: 10px;
}

.routes {
  list-style: none;
  margin: 0;
  padding: 0;
}

.route-row {
  padding: 10px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.42);
  cursor: pointer;
}

.route-row.active {
  border-color: rgba(251, 191, 36, 0.7);
  box-shadow: inset 3px 0 0 #fbbf24;
}

.src-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.tag {
  flex-shrink: 0;
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

.quality {
  display: grid;
  grid-template-columns: 58px 1fr 38px;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--text-muted);
}

.quality i {
  height: 7px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--bg-deep);
  border: 1px solid var(--border);
}

.quality b {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #34d399, #fbbf24);
}

.quality em {
  color: var(--accent-hot);
  font-style: normal;
  text-align: right;
}

.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 4px;
}

.ops,
.links {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.zhiyan {
  margin-top: 12px;
  padding: 10px;
}

.zhiyan h4 {
  margin: 0 0 6px;
  font-size: 13px;
}

.zhiyan p,
.zhiyan li {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.zhiyan ul {
  margin: 6px 0 0;
  padding-left: 16px;
}

.boost {
  font-size: 12px;
  color: var(--success);
  margin: 10px 0 0;
}

@keyframes pulse-ring {
  0% {
    opacity: 0.95;
    transform: scale(0.75);
  }
  100% {
    opacity: 0;
    transform: scale(2.1);
  }
}

@keyframes rotor-spin {
  0% {
    transform: scaleX(0.55);
    opacity: 0.58;
  }
  50% {
    transform: scaleX(1.25);
    opacity: 1;
  }
  100% {
    transform: scaleX(0.55);
    opacity: 0.58;
  }
}

@keyframes rotor-soft-pulse {
  0% {
    opacity: 0.68;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1.08);
  }
}

:global(.uav-map-drone-icon) {
  background: transparent;
  border: 0;
}

:global(.uav-map-drone-wrap) {
  position: relative;
  width: 34px;
  height: 34px;
  transform: rotate(var(--uav-rotation));
}

:global(.uav-map-drone-scan) {
  position: absolute;
  left: 10px;
  top: 18px;
  width: 14px;
  height: 20px;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, rgba(56, 189, 248, 0.24), rgba(56, 189, 248, 0));
}

:global(.uav-map-drone-pulse) {
  position: absolute;
  inset: 5px;
  border: 1px solid rgba(251, 191, 36, 0.7);
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.12);
  animation: map-drone-pulse 1.35s ease-out infinite;
}

:global(.uav-map-drone-core) {
  position: absolute;
  left: 8px;
  top: 8px;
  width: 18px;
  height: 18px;
  filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.85));
}

:global(.uav-map-drone-core .arm) {
  position: absolute;
  left: 2px;
  top: 8px;
  width: 14px;
  height: 2px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.92);
}

:global(.uav-map-drone-core .arm-a) {
  transform: rotate(36deg);
}

:global(.uav-map-drone-core .arm-b) {
  transform: rotate(-36deg);
}

:global(.uav-map-drone-core .rotor) {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  border: 1px solid rgba(224, 242, 254, 0.86);
  background: rgba(15, 23, 42, 0.72);
  animation: rotor-soft-pulse 0.9s ease-in-out infinite alternate;
}

:global(.uav-map-drone-core .r1) {
  left: -3px;
  top: -2px;
}

:global(.uav-map-drone-core .r2) {
  right: -3px;
  top: -2px;
}

:global(.uav-map-drone-core .r3) {
  left: -3px;
  bottom: -2px;
}

:global(.uav-map-drone-core .r4) {
  right: -3px;
  bottom: -2px;
}

:global(.uav-map-drone-core em) {
  position: absolute;
  left: 6px;
  top: 3px;
  width: 6px;
  height: 12px;
  border-radius: 5px 5px 7px 7px;
  background: #fbbf24;
  border: 1px solid rgba(255, 247, 237, 0.9);
}

:global(.uav-waypoint-icon) {
  background: transparent;
  border: 0;
}

:global(.uav-waypoint-icon span) {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgba(224, 242, 254, 0.75);
  background: rgba(15, 23, 42, 0.78);
  color: #e0f2fe;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.11), 0 2px 8px rgba(2, 6, 23, 0.45);
  font-size: 10px;
  font-style: normal;
  line-height: 1;
}

:global(.uav-waypoint-icon span.active) {
  border-color: rgba(251, 191, 36, 0.9);
  color: #fbbf24;
  box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.13), 0 2px 10px rgba(2, 6, 23, 0.55);
}

:global(.uav-waypoint-icon span.start) {
  background: rgba(6, 78, 59, 0.88);
  color: #bbf7d0;
}

:global(.uav-waypoint-icon span.end) {
  background: rgba(127, 29, 29, 0.88);
  color: #fecdd3;
}

@keyframes map-drone-pulse {
  0% {
    opacity: 0.88;
    transform: scale(0.62);
  }
  100% {
    opacity: 0;
    transform: scale(1.6);
  }
}
</style>
