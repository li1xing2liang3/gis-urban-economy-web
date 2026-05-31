<template>
  <div class="page scene3d">
    <div ref="cesiumEl" class="cesium-host"></div>
    <div class="float-panel panel">
      <div class="head">三维图层</div>
      <div class="presets">
        <span class="plab">预设视角</span>
        <button type="button" class="btn btn-ghost sm" @click="fly('cbd')">商圈</button>
        <button type="button" class="btn btn-ghost sm" @click="fly('hub')">CBD</button>
      </div>
      <label v-for="opt in toggles" :key="opt.key" class="row">
        <input v-model="opt.on" type="checkbox" />
        {{ opt.label }}
      </label>
      <p class="perf">建筑点击可查看经济属性。与二维页共享全局时间/数据：{{ gis.dataSource }}。</p>
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { gis } from '@/stores/gisState';

const cesiumEl = ref<HTMLElement | null>(null);
let viewer: Cesium.Viewer | null = null;
let buildingEntities: Cesium.Entity[] = [];
let handler: Cesium.ScreenSpaceEventHandler | null = null;
const pickInfo = ref<{ vit: string; biz: string } | null>(null);

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
});

onUnmounted(() => {
  handler?.destroy();
  handler = null;
  viewer?.destroy();
  viewer = null;
  buildingEntities = [];
});

function fly(kind: 'cbd' | 'hub') {
  if (!viewer) return;
  const pos =
    kind === 'cbd'
      ? { lon: 114.308, lat: 30.595, h: 2200, hdg: 25, pit: -38 }
      : { lon: 114.32, lat: 30.58, h: 3600, hdg: 40, pit: -45 };
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
</style>
