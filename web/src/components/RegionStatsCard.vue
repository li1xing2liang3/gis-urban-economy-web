<template>
  <div class="card panel">
    <h4>区域统计 <span class="tag">{{ gis.region.label }}</span></h4>
    <ul>
      <li><em>活力值</em> {{ display.v }}</li>
      <li><em>人流</em> {{ display.foot }}</li>
      <li><em>商业密度</em> {{ display.comm }}</li>
      <li v-if="display.poiCount != null"><em>POI 数</em> {{ display.poiCount }}</li>
    </ul>
    <p v-if="gis.uavInVitalityModel" class="uav">低空数据参与模型，指标含小幅修正。</p>
    <p v-if="display.inRegion === false && display.poiCount === 0" class="hint">当前范围内无 POI，显示为估算值。</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { gis, regionKpis } from '@/stores/gisState';
import type { OverviewRegionKpis } from '@/utils/overviewRegionStats';

const props = defineProps<{
  stats?: OverviewRegionKpis | null;
}>();

const display = computed(() => {
  if (props.stats) {
    return {
      v: props.stats.v,
      foot: props.stats.foot,
      comm: props.stats.comm,
      poiCount: props.stats.poiCount,
      inRegion: props.stats.inRegion,
    };
  }
  const r = regionKpis.value;
  return { v: r.v, foot: r.foot, comm: r.comm, poiCount: null as number | null, inRegion: undefined };
});
</script>

<style scoped>
.card {
  padding: 10px 12px;
  margin-top: 10px;
}
h4 {
  margin: 0 0 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tag {
  font-size: 10px;
  color: var(--accent);
  font-weight: 400;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
  line-height: 1.5;
}
em {
  color: var(--text-muted);
  font-style: normal;
  margin-right: 4px;
}
.uav,
.hint {
  font-size: 10px;
  color: var(--text-muted);
  margin: 8px 0 0;
  line-height: 1.3;
}
.hint {
  color: var(--accent-hot);
}
</style>
