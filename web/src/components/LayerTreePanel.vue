<template>
  <div class="layer-tree panel">
    <div class="head">图层 <span class="sub">统一样式与语义</span></div>
    <ul class="list">
      <li v-for="layer in layers" :key="layer.id" class="row">
        <div class="row-top">
          <label class="check">
            <input v-model="layer.visible" type="checkbox" />
            <span class="name">{{ layer.name }}</span>
          </label>
          <button type="button" class="info" title="指标与分级" @click="open = layer">ℹ</button>
        </div>
        <span class="ds">{{ layer.dataSource }}</span>
        <input
          v-if="layer.visible && layer.opacity != null"
          v-model.number="layer.opacity"
          class="opacity"
          type="range"
          min="0"
          max="1"
          step="0.05"
        />
      </li>
    </ul>
    <div v-if="open" class="mask" @click.self="open = null">
      <div class="detail panel">
        <h4>{{ open.name }}</h4>
        <p><em>来源</em> {{ open.dataSource }}</p>
        <p><em>指标</em> {{ open.metric }}</p>
        <p><em>分级</em> {{ open.rule }}</p>
        <p><em>单位</em> {{ open.unit }}</p>
        <button type="button" class="btn" @click="open = null">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { LayerItem } from '@/types/layer';

defineProps<{
  layers: LayerItem[];
}>();

const open = ref<LayerItem | null>(null);
</script>

<style scoped>
.layer-tree {
  padding: 12px;
  min-width: 220px;
}
.head {
  font-weight: 600;
  margin-bottom: 10px;
  font-size: 14px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.sub {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-muted);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  margin-bottom: 10px;
}
.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  min-width: 0;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.info {
  flex-shrink: 0;
  width: 26px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-panel-hover);
  color: var(--accent);
  font-size: 13px;
  line-height: 1;
}
.ds {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  margin: 2px 0 0 24px;
}
.opacity {
  width: 100%;
  margin-top: 4px;
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.detail {
  max-width: 360px;
  padding: 16px;
}
.detail h4 {
  margin: 0 0 10px;
  font-size: 15px;
}
.detail p {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text);
}
.detail em {
  color: var(--text-muted);
  font-style: normal;
  margin-right: 4px;
}
</style>
