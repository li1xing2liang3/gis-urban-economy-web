<template>
  <div class="page scene3d">
    <div ref="cesiumEl" :class="['cesium-host', { failed: sceneError }]">
      <div v-if="sceneError" class="scene-fallback panel">
        <strong>三维场景暂不可用</strong>
        <span>{{ sceneError }}</span>
        <button type="button" class="btn btn-primary" @click="retryScene">重新加载三维场景</button>
      </div>
    </div>
    <div class="float-panel panel">
      <div class="head">三维图层</div>
      <div class="presets">
        <span class="plab">预设视角</span>
        <button type="button" class="btn btn-ghost sm" @click="fly('cbd')">商圈</button>
        <button type="button" class="btn btn-ghost sm" @click="fly('hub')">CBD</button>
        <button type="button" class="btn btn-ghost sm" @click="fly('uav')">低空航线</button>
      </div>
      <label v-for="opt in toggles" :key="opt.key" class="row">
        <input v-model="opt.on" type="checkbox" />
        {{ opt.label }}
      </label>
      <div v-if="uavEnabled" class="uav-mini">
        <span>三维航线漫游</span>
        <strong>{{ uavProgress }}%</strong>
        <i><b :style="{ width: `${uavProgress}%` }"></b></i>
        <em>{{ uavStatus }}</em>
      </div>
      <p class="perf">当前三维页使用武汉本地演示体块、经济指标着色与无人机三维航线，所有控件均可直接使用。</p>
      <RouterLink
        class="link"
        :to="{ name: 'lowaltitude', query: { r: 'p:30.5928,114.3055' } }"
      >
        从当前位置去低空数据 →
      </RouterLink>
    </div>
    <div v-if="pickInfo" class="pick-hud panel">
      <strong>建筑</strong>
      <span>活力指数：{{ pickInfo.vit }}</span>
      <span>商业类型：{{ pickInfo.biz }}</span>
      <span>经济注记：智眼系框架 + {{ gis.dataSource }} 配置（模拟）</span>
    </div>
    <div class="uav-hud panel">
      <strong>武汉三维航线演示</strong>
      <span>建筑白模、经济着色、低空航廊与无人机动画均为本地可运行演示数据。</span>
      <span>航线对应江汉路、两江四岸与光谷等武汉低空经济场景。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { gis } from '@/stores/gisState';

const cesiumEl = ref<HTMLElement | null>(null);
let viewer: Cesium.Viewer | null = null;
let buildingEntities: Cesium.Entity[] = [];
let uavEntities: Cesium.Entity[] = [];
let handler: Cesium.ScreenSpaceEventHandler | null = null;
let uavTickRemove: Cesium.Event.RemoveCallback | null = null;
let uavFlightStart: Cesium.JulianDate | null = null;
let uavFlightDuration = 36;
const pickInfo = ref<{ vit: string; biz: string } | null>(null);
const uavProgress = ref(0);
const uavStatus = ref('城市航线 / 三维漫游');
const sceneError = ref('');

const toggles = reactive([
  { key: 'terrain', label: '地形（椭球）', on: true },
  { key: 'buildings', label: '建筑白模（演示柱体）', on: true },
  { key: 'uav', label: '无人机三维漫游航线', on: true },
  { key: 'eco', label: '经济指标着色', on: true },
]);

const uavEnabled = computed(() => toggles.find((t) => t.key === 'uav')?.on ?? true);

onMounted(() => {
  initScene();
});

onUnmounted(() => {
  disposeScene();
});

function initScene() {
  const el = cesiumEl.value;
  if (!el) return;

  disposeScene();
  sceneError.value = '';

  try {
    viewer = new Cesium.Viewer(el, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: true,
      sceneModePicker: true,
      navigationHelpButton: false,
      fullscreenButton: true,
      vrButton: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });
  } catch (err) {
    console.warn('[Scene3D] failed to initialize Cesium viewer', err);
    sceneError.value = '浏览器 WebGL 或显卡上下文初始化失败，可先使用二维地图和低空航线页面继续展示。';
    return;
  }

  try {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        minimumLevel: 0,
        maximumLevel: 19,
      }),
    );

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(114.309, 30.592, 1150),
      orientation: {
        heading: Cesium.Math.toRadians(34),
        pitch: Cesium.Math.toRadians(-30),
        roll: 0,
      },
    });

    addDemoBuildings();
    addUavFlightRoute();
    syncBuildingsVisibility();
    syncLayerVisibility();
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const picked = viewer!.scene.pick(click.position);
      if (!Cesium.defined(picked) || !picked.id) {
        pickInfo.value = null;
        return;
      }
      const idx = buildingEntities.indexOf(picked.id as Cesium.Entity);
      if (idx < 0) {
        pickInfo.value = null;
        return;
      }
      const kinds = ['零售主楼', '商务办公', '混合底商', '科技研发'];
      pickInfo.value = {
        vit: (78 + idx * 2 + (gis.dataSource === 'v2025Q4' ? -1 : 0)).toFixed(0),
        biz: kinds[idx % kinds.length]!,
      };
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  } catch (err) {
    console.warn('[Scene3D] failed to prepare Cesium scene', err);
    disposeScene();
    sceneError.value = '三维图层或航线动画初始化失败，已切换到安全展示模式。';
  }
}

function disposeScene() {
  if (uavTickRemove) {
    uavTickRemove();
    uavTickRemove = null;
  }
  handler?.destroy();
  handler = null;
  viewer?.destroy();
  viewer = null;
  buildingEntities = [];
  uavEntities = [];
  uavFlightStart = null;
}

function retryScene() {
  initScene();
}

function fly(kind: 'cbd' | 'hub' | 'uav') {
  if (!viewer) return;
  const pos = {
    cbd: { lon: 114.308, lat: 30.595, h: 2200, hdg: 25, pit: -38 },
    hub: { lon: 114.32, lat: 30.58, h: 3600, hdg: 40, pit: -45 },
    uav: { lon: 114.309, lat: 30.592, h: 1150, hdg: 34, pit: -30 },
  }[kind];
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.h),
    orientation: {
      heading: Cesium.Math.toRadians(pos.hdg),
      pitch: Cesium.Math.toRadians(pos.pit),
      roll: 0,
    },
  });
}

function addDemoBuildings() {
  if (!viewer) return;
  const centers: [number, number][] = [
    [114.300, 30.589],
    [114.306, 30.594],
    [114.312, 30.591],
    [114.318, 30.586],
  ];
  buildingEntities = centers.map((pos, i) => {
    const height = 80 + i * 40;
    const eco = toggles.find((t) => t.key === 'eco')?.on;
    const color = eco
      ? Cesium.Color.fromCssColorString(i % 2 === 0 ? '#3d9cf5' : '#f5a623').withAlpha(0.85)
      : Cesium.Color.WHITE.withAlpha(0.75);
    return viewer!.entities.add({
      position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], height / 2),
      box: {
        dimensions: new Cesium.Cartesian3(60, 60, height),
        material: new Cesium.ColorMaterialProperty(color),
        outline: true,
        outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
      },
      name: `demo-building-${i}`,
    });
  });
}

function syncBuildingsVisibility() {
  const showBuildings = toggles.find((t) => t.key === 'buildings')?.on ?? true;
  buildingEntities.forEach((e) => {
    e.show = showBuildings;
  });
}

function addUavFlightRoute() {
  if (!viewer) return;
  const route: [number, number, number][] = [
    [114.2968, 30.5868, 360],
    [114.3015, 30.5918, 430],
    [114.3072, 30.5972, 390],
    [114.3138, 30.5946, 470],
    [114.3195, 30.5886, 400],
    [114.324, 30.5828, 450],
  ];
  const positions = route.map(([lon, lat, h]) => Cesium.Cartesian3.fromDegrees(lon, lat, h));
  const groundPositions = route.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 8));

  uavEntities.push(
    viewer.entities.add({
      name: '低空航线地面投影',
      corridor: {
        positions: groundPositions,
        width: 95,
        cornerType: Cesium.CornerType.ROUNDED,
        material: Cesium.Color.CYAN.withAlpha(0.13),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.32),
      },
    }),
  );

  uavEntities.push(
    viewer.entities.add({
      name: '低空航廊外缘光带',
      polyline: {
        positions,
        width: 18,
        material: new Cesium.PolylineGlowMaterialProperty({
          color: Cesium.Color.CYAN.withAlpha(0.76),
          glowPower: 0.34,
        }),
      },
    }),
  );

  uavEntities.push(
    viewer.entities.add({
      name: '无人机三维穿梭航线',
      polyline: {
        positions,
        width: 5,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#fbbf24').withAlpha(0.98),
          gapColor: Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.34),
          dashLength: 22,
        }),
      },
    }),
  );

  uavEntities.push(
    viewer.entities.add({
      name: '低空航廊安全包络',
      wall: {
        positions,
        minimumHeights: route.map((p) => Math.max(20, p[2] - 95)),
        material: Cesium.Color.CYAN.withAlpha(0.12),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.45),
      },
    }),
  );

  route.forEach(([lon, lat, h], idx) => {
    uavEntities.push(
      viewer!.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, h),
        point: {
          pixelSize: idx === 0 || idx === route.length - 1 ? 11 : 8,
          color: idx === 0 ? Cesium.Color.LIME : idx === route.length - 1 ? Cesium.Color.ORANGE : Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
      }),
    );
  });

  uavFlightStart = Cesium.JulianDate.now();
  const position = new Cesium.SampledPositionProperty();
  route.forEach(([lon, lat, h], idx) => {
    const t = Cesium.JulianDate.addSeconds(uavFlightStart!, (uavFlightDuration / (route.length - 1)) * idx, new Cesium.JulianDate());
    position.addSample(t, Cesium.Cartesian3.fromDegrees(lon, lat, h));
  });

  const stop = Cesium.JulianDate.addSeconds(uavFlightStart, uavFlightDuration, new Cesium.JulianDate());
  viewer.clock.startTime = uavFlightStart.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = uavFlightStart.clone();
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 1.4;
  viewer.clock.shouldAnimate = true;

  const liveUavPosition = new Cesium.CallbackPositionProperty((time, result) => position.getValue(time, result), false);
  const scannerPosition = new Cesium.CallbackPositionProperty((time, result) => {
    const current = position.getValue(time);
    if (!current) return undefined;
    const cartographic = Cesium.Cartographic.fromCartesian(current);
    return Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      Math.max(40, cartographic.height - 105),
      Cesium.Ellipsoid.WGS84,
      result,
    );
  }, false);

  uavEntities.push(
    viewer.entities.add({
      name: '无人机下视传感器锥',
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({ start: uavFlightStart, stop }),
      ]),
      position: scannerPosition,
      cylinder: {
        length: 190,
        topRadius: 9,
        bottomRadius: 95,
        material: Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.16),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.42),
        slices: 48,
      },
    }),
  );

  uavEntities.push(
    viewer.entities.add({
      name: '低空经济无人机',
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({ start: uavFlightStart, stop }),
      ]),
      position: liveUavPosition,
      orientation: new Cesium.VelocityOrientationProperty(liveUavPosition),
      billboard: {
        image: makeSimpleDroneSvg(),
        width: 58,
        height: 58,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: '低空巡航 UAV',
        font: '12px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -46),
      },
      path: {
        resolution: 1,
        leadTime: 0,
        trailTime: 16,
        width: 8,
        material: new Cesium.PolylineGlowMaterialProperty({
          color: Cesium.Color.fromCssColorString('#fbbf24').withAlpha(0.95),
          glowPower: 0.22,
        }),
      },
    }),
  );

  uavTickRemove = viewer.clock.onTick.addEventListener((clock) => {
    if (!uavFlightStart) return;
    const elapsed = Cesium.JulianDate.secondsDifference(clock.currentTime, uavFlightStart);
    uavProgress.value = Math.round(((elapsed % uavFlightDuration) / uavFlightDuration) * 100);
  });
}

function makeSimpleDroneSvg() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-36 -36 72 72">
      <defs>
        <filter id="g" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="0" cy="0" r="28" fill="rgba(251,191,36,.12)" stroke="rgba(251,191,36,.72)" stroke-width="2"/>
      <g stroke="#e0f2fe" stroke-width="3.4" stroke-linecap="round">
        <line x1="-17" y1="-14" x2="17" y2="14"/>
        <line x1="17" y1="-14" x2="-17" y2="14"/>
      </g>
      <g fill="rgba(15,23,42,.82)" stroke="#e0f2fe" stroke-width="2">
        <circle cx="-22" cy="-18" r="7"/>
        <circle cx="22" cy="-18" r="7"/>
        <circle cx="-22" cy="18" r="7"/>
        <circle cx="22" cy="18" r="7"/>
      </g>
      <path filter="url(#g)" d="M0-22 8-4 5 17 0 22-5 17-8-4Z" fill="#fbbf24" stroke="#fff7ed" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="0" cy="4" r="4" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function syncLayerVisibility() {
  const showUav = toggles.find((t) => t.key === 'uav')?.on ?? true;
  uavEntities.forEach((e) => {
    e.show = showUav;
  });
  if (viewer) viewer.clock.shouldAnimate = showUav;
}

watch(
  () => toggles.map((t) => ({ k: t.key, on: t.on })),
  () => {
    syncBuildingsVisibility();
    syncLayerVisibility();
    const eco = toggles.find((t) => t.key === 'eco')?.on;
    buildingEntities.forEach((e, i) => {
      const box = e.box;
      if (!box) return;
      const color = eco
        ? Cesium.Color.fromCssColorString(i % 2 === 0 ? '#3d9cf5' : '#f5a623').withAlpha(0.85)
        : Cesium.Color.WHITE.withAlpha(0.75);
      box.material = new Cesium.ColorMaterialProperty(color);
    });
  },
  { deep: true },
);
</script>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  position: relative;
}

.cesium-host {
  position: absolute;
  inset: 8px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
}

.cesium-host.failed {
  display: grid;
  place-items: center;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(8, 47, 73, 0.78)),
    radial-gradient(circle at 50% 34%, rgba(56, 189, 248, 0.18), transparent 34%);
}

.scene-fallback {
  width: min(420px, calc(100% - 32px));
  display: grid;
  gap: 10px;
  padding: 18px;
  text-align: left;
}

.scene-fallback strong {
  color: #fbbf24;
  font-size: 18px;
}

.scene-fallback span {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.55;
}

.float-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
  width: 260px;
  padding: 12px;
  pointer-events: auto;
}

.head {
  font-weight: 600;
  margin-bottom: 10px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.perf {
  font-size: 11px;
  color: var(--text-muted);
  margin: 10px 0 0;
  line-height: 1.4;
}

.uav-mini {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 5px 8px;
  margin: 10px 0;
  padding: 9px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 6px;
  background: rgba(8, 47, 73, 0.24);
}

.uav-mini span {
  color: var(--text-muted);
  font-size: 11px;
}

.uav-mini strong {
  color: #fbbf24;
  font-size: 13px;
}

.uav-mini i {
  grid-column: 1 / -1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.68);
  border: 1px solid var(--border);
}

.uav-mini b {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #fbbf24);
}

.uav-mini em {
  grid-column: 1 / -1;
  color: var(--text-muted);
  font-size: 10px;
  font-style: normal;
}

.link {
  display: inline-block;
  margin-top: 10px;
  font-size: 12px;
}
.presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.plab {
  font-size: 11px;
  color: var(--text-muted);
}
.sm {
  padding: 4px 8px;
  font-size: 11px;
}
.pick-hud {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 3;
  max-width: 240px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  pointer-events: none;
}

.uav-hud {
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 3;
  max-width: 310px;
  padding: 11px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  pointer-events: none;
}

.uav-hud strong {
  color: #fbbf24;
}

.uav-hud span {
  color: var(--text-muted);
  line-height: 1.45;
}
</style>
