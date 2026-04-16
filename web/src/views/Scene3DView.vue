<template>
  <div class="page scene3d">
    <div ref="cesiumEl" class="cesium-host"></div>
    <div class="float-panel panel">
      <div class="head">三维图层</div>
      <label v-for="opt in toggles" :key="opt.key" class="row">
        <input v-model="opt.on" type="checkbox" />
        {{ opt.label }}
      </label>
      <p class="perf">性能：按需加载与 LOD 由三维切片服务决定（演示为简易几何）</p>
      <RouterLink class="link" to="/lowaltitude">前往低空数据增强 →</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const cesiumEl = ref<HTMLElement | null>(null);
let viewer: Cesium.Viewer | null = null;
let buildingEntities: Cesium.Entity[] = [];

const toggles = reactive([
  { key: 'terrain', label: '地形（椭球）', on: true },
  { key: 'buildings', label: '建筑白模（演示柱体）', on: true },
  { key: 'uav', label: '无人机 mesh（占位）', on: false },
  { key: 'eco', label: '经济指标着色', on: true },
]);

onMounted(() => {
  const el = cesiumEl.value;
  if (!el) return;

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

  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      minimumLevel: 0,
      maximumLevel: 19,
    }),
  );

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(114.3055, 30.5928, 2800),
    orientation: {
      heading: Cesium.Math.toRadians(20),
      pitch: Cesium.Math.toRadians(-45),
      roll: 0,
    },
  });

  addDemoBuildings();
  syncBuildingsVisibility();
});

onUnmounted(() => {
  viewer?.destroy();
  viewer = null;
  buildingEntities = [];
});

function addDemoBuildings() {
  if (!viewer) return;
  const centers: [number, number][] = [
    [114.30, 30.59],
    [114.31, 30.595],
    [114.298, 30.588],
    [114.315, 30.585],
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
    });
  });
}

function syncBuildingsVisibility() {
  const showBuildings = toggles.find((t) => t.key === 'buildings')?.on ?? true;
  buildingEntities.forEach((e) => {
    e.show = showBuildings;
  });
}

watch(
  () => toggles.map((t) => ({ k: t.key, on: t.on })),
  () => {
    syncBuildingsVisibility();
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

.link {
  display: inline-block;
  margin-top: 10px;
  font-size: 12px;
}
</style>
