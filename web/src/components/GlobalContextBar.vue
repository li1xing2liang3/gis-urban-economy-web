<template>

  <div class="ctx panel">

    <div class="ctx-mark mono" aria-hidden="true">CTX</div>

    <div class="block">

      <span class="label mono">⏱ TEMPORAL</span>

      <select v-model="gis.timeMode" class="sel sm">

        <option value="single">单时刻</option>

        <option value="range">时间段</option>

        <option value="play">动态播放</option>

        <option value="compareAB">A/B 对比</option>

      </select>

      <input v-if="gis.timeMode === 'single' || gis.timeMode === 'play'" v-model="gis.timeSingle" type="date" class="inp" />

      <template v-else-if="gis.timeMode === 'range'">

        <input v-model="gis.timeRangeStart" type="date" class="inp" />

        <span class="sep">—</span>

        <input v-model="gis.timeRangeEnd" type="date" class="inp" />

      </template>

      <template v-else>

        <input v-model="gis.timeCompareA" type="date" class="inp" title="A" />

        <span class="sep">vs</span>

        <input v-model="gis.timeCompareB" type="date" class="inp" title="B" />

      </template>

    </div>

    <div class="vsep" aria-hidden="true" />

    <div class="block">

      <span class="label mono">◎ SPATIAL</span>

      <select v-model="gis.region.mode" class="sel" @change="onRegionMode">

        <option value="all">全市</option>

        <option value="admin">行政区</option>

        <option value="point">点选 1 km</option>

        <option value="box">框选</option>

      </select>

      <select v-if="gis.region.mode === 'admin'" v-model="gis.region.adminName" class="sel" @change="syncAdmin">

        <option v-for="a in adminDistrictOptions" :key="a" :value="a">{{ a }}</option>

      </select>

      <span v-else class="hint">{{ regionHint }}</span>

    </div>

    <div class="vsep" aria-hidden="true" />

    <div class="block">

      <span class="label mono">◇ PIPELINE</span>

      <select v-model="gis.dataSource" class="sel">

        <option v-for="source in selectableSources" :key="source.id" :value="source.id">{{ source.label }}</option>

        <option v-if="!selectableSources.length" value="v2026Q1">智眼型 v2026Q1（模拟）</option>

      </select>
      <span class="hint source-note">{{ selectedSourceNote }}</span>

    </div>

    <div class="block kpi" :title="syncNote">

      <span class="pill mono">URL SYNC</span>

      <code class="code mono">{{ gis.dataSource }} · {{ gis.region.label }}</code>

    </div>

  </div>

</template>



<script setup lang="ts">

import { computed, onMounted, ref, watch } from 'vue';

import { gis, setRegionAll, setRegionAdmin, useGisRouterSync, adminDistrictOptions } from '@/stores/gisState';

import { gisDataService, type DataSourceMeta } from '@/services/gisDataService';

import { useRoute } from 'vue-router';



useGisRouterSync();

const route = useRoute();
const dataSources = ref<DataSourceMeta[]>([]);

const syncNote = computed(

  () => '全局上下文写入路由查询串 · ' + (route.name ? `route:${String(route.name)}` : ''),

);



const regionHint = computed(() => {

  if (gis.region.mode === 'point') return '总览地图点击设定 1 km 中心';

  if (gis.region.mode === 'box') return '总览地图拖拽矩形框选';

  return '—';

});

const fallbackSources: DataSourceMeta[] = [
  { id: 'v2026Q1', label: '智眼型 v2026Q1（模拟）', isActive: true },
  { id: 'v2025Q4', label: '智眼型 v2025Q4（模拟）', isActive: true },
  { id: 'demo-mix', label: '混编·演示', isActive: true },
];

const selectableSources = computed(() => {
  const remote = dataSources.value.filter((source) => source.isActive !== false);
  return remote.length ? remote : fallbackSources;
});

const selectedSourceNote = computed(() => {
  const item = selectableSources.value.find((source) => source.id === gis.dataSource);
  return item?.description ?? '后端元数据未连接时使用本地演示源';
});

onMounted(async () => {
  try {
    const list = await gisDataService.getDataSources();
    dataSources.value = list.filter((source) => source.id === 'v2026Q1' || source.id === 'v2025Q4' || source.id === 'demo-mix');
    if (!dataSources.value.length) dataSources.value = list;
  } catch {
    dataSources.value = fallbackSources;
  }
});



function onRegionMode() {
  if (gis.region.mode === 'all') setRegionAll();
  else if (gis.region.mode === 'admin' && gis.region.adminName) setRegionAdmin(gis.region.adminName);
  else if (gis.region.mode === 'point') gis.region.label = '点选 1 km（请在总览地图点击）';
  else if (gis.region.mode === 'box') gis.region.label = '框选（总览地图拖拽矩形）';
}



function syncAdmin() {

  if (gis.region.mode === 'admin') setRegionAdmin(gis.region.adminName);

}



watch(

  () => gis.region.adminName,

  (n) => {

    if (gis.region.mode === 'admin' && n) gis.region.label = n;

  },

);

</script>



<style scoped>

.ctx {

  position: relative;

  flex-shrink: 0;

  margin: 0 8px 0;

  padding: 10px 14px 10px 52px;

  display: flex;

  flex-wrap: wrap;

  align-items: center;

  gap: 12px 18px;

  font-size: 12px;

  border-radius: var(--radius);

  border: 1px solid rgba(56, 189, 248, 0.18);

  box-shadow:

    inset 0 1px 0 rgba(255, 255, 255, 0.05),

    0 8px 28px rgba(0, 0, 0, 0.28);

}



.ctx-mark {

  position: absolute;

  left: 12px;

  top: 50%;

  transform: translateY(-50%);

  font-size: 9px;

  letter-spacing: 0.25em;

  color: rgba(56, 189, 248, 0.55);

  writing-mode: vertical-rl;

  text-orientation: mixed;

}



.block {

  display: flex;

  align-items: center;

  flex-wrap: wrap;

  gap: 6px 8px;

  min-width: 0;

}



.kpi {

  margin-left: auto;

  gap: 8px;

}



.pill {

  font-size: 9px;

  letter-spacing: 0.12em;

  color: var(--success);

  border: 1px solid rgba(52, 211, 153, 0.45);

  padding: 2px 7px;

  border-radius: 4px;

  background: rgba(52, 211, 153, 0.06);

}



.label {

  color: var(--accent-dim);

  white-space: nowrap;

  font-size: 10px;

  letter-spacing: 0.04em;

}



.sel,

.inp,

.sm {

  background: rgba(15, 23, 42, 0.75);

  color: var(--text);

  border: 1px solid rgba(71, 96, 124, 0.55);

  border-radius: 6px;

  padding: 5px 8px;

  max-width: 200px;

  transition:

    border-color 0.15s,

    box-shadow 0.15s;

}



.sel:focus,

.inp:focus {

  outline: none;

  border-color: rgba(56, 189, 248, 0.55);

  box-shadow: 0 0 12px rgba(56, 189, 248, 0.15);

}



.sel {

  min-width: 100px;

}



.hint {

  color: var(--text-muted);

  max-width: 220px;

  line-height: 1.25;

  font-size: 11px;

}



.sep {

  color: var(--text-muted);

  opacity: 0.6;

}



.vsep {

  width: 1px;

  height: 22px;

  background: linear-gradient(180deg, transparent, rgba(56, 189, 248, 0.35), transparent);

}



.code {

  font-size: 11px;

  color: var(--accent);

  max-width: 240px;

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

  background: rgba(56, 189, 248, 0.06);

  padding: 4px 10px;

  border-radius: 6px;

  border: 1px solid rgba(56, 189, 248, 0.2);

}



.mono {

  font-family: var(--font-mono, ui-monospace, monospace);

}

</style>


