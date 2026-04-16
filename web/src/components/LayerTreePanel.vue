<template>
  <div class="layer-tree panel">
    <div class="head">图层</div>
    <ul class="list">
      <li v-for="layer in layers" :key="layer.id" class="row">
        <label class="check">
          <input v-model="layer.visible" type="checkbox" />
          <span>{{ layer.name }}</span>
        </label>
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
  </div>
</template>

<script setup lang="ts">
export type LayerItem = {
  id: string;
  name: string;
  visible: boolean;
  opacity?: number;
};

defineProps<{
  layers: LayerItem[];
}>();
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
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  margin-bottom: 10px;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}
.opacity {
  width: 100%;
  margin-top: 4px;
}
</style>
