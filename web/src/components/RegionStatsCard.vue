<template>
  <div class="card panel">
    <h4>区域统计 <span class="tag">{{ gis.region.label }}</span></h4>
    <ul>
      <li><em>活力值</em> {{ stats.v }}</li>
      <li><em>人流</em> {{ stats.foot }}</li>
      <li><em>商业密度</em> {{ stats.comm }}</li>
    </ul>
    <p v-if="gis.uavInVitalityModel" class="uav">低速空域数据参与模型，指标含小幅修正。</p>
  </div>
</template>

<script setup lang="ts">
import { gis, regionKpis } from '@/stores/gisState';
const stats = regionKpis;
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
.uav {
  font-size: 10px;
  color: var(--text-muted);
  margin: 8px 0 0;
  line-height: 1.3;
}
</style>
