<template>
  <div class="layout">
    <header class="header panel">
      <div class="brand">
        <span class="logo">AI+GIS</span>
        <span class="name">城市经济空间展示平台</span>
        <span class="sub">融合武汉智眼</span>
      </div>
      <div class="page-title">{{ pageTitle }}</div>
      <div class="header-right">
        <span class="badge">{{ envLabel }}</span>
        <span class="time">{{ clock }}</span>
        <span class="user-placeholder">用户</span>
      </div>
    </header>
    <div class="body">
      <aside :class="['sidebar', 'panel', { collapsed: sidebarCollapsed }]">
        <button type="button" class="collapse-btn" :title="sidebarCollapsed ? '展开' : '收起'" @click="sidebarCollapsed = !sidebarCollapsed">
          {{ sidebarCollapsed ? '»' : '«' }}
        </button>
        <nav class="nav">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            active-class="active"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span v-if="!sidebarCollapsed" class="nav-text">{{ item.label }}</span>
          </RouterLink>
        </nav>
      </aside>
      <main class="main">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>
    <footer class="footer">
      <span>坐标与比例尺由各页地图状态栏显示</span>
      <span class="sep">|</span>
      <span>数据更新时间：演示数据 {{ updateTime }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();
const sidebarCollapsed = ref(false);
const clock = ref('');
const envLabel = '演示';
const updateTime = '2026-04-08 18:00';

let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  const tick = () => {
    clock.value = new Date().toLocaleString('zh-CN', { hour12: false });
  };
  tick();
  timer = setInterval(tick, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const pageTitle = computed(() => (route.meta.title as string) || '');

const navItems = [
  { to: '/overview', label: '空间总览', icon: '🗺' },
  { to: '/scene3d', label: '三维城市', icon: '🏙' },
  { to: '/vitality', label: '经济活力', icon: '📊' },
  { to: '/districts', label: '商圈识别', icon: '◎' },
  { to: '/population', label: '人口与消费', icon: '👥' },
  { to: '/dynamics', label: '经济动态', icon: '⏱' },
  { to: '/lowaltitude', label: '低空数据', icon: '🛸' },
];
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-deep);
}

.header {
  height: var(--header-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-shrink: 0;
}

.logo {
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.02em;
}

.name {
  font-weight: 600;
  font-size: 15px;
}

.sub {
  font-size: 12px;
  color: var(--text-muted);
}

.page-title {
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.badge {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-panel-hover);
  border: 1px solid var(--border);
  color: var(--accent-hot);
}

.user-placeholder {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px dashed var(--border);
  color: var(--text-muted);
}

.body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.sidebar {
  width: var(--sidebar-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  border-radius: 0;
  border-top: none;
  border-bottom: none;
  border-left: none;
  position: relative;
  transition: width 0.2s ease;
}

.sidebar.collapsed {
  width: var(--sidebar-w-collapsed);
}

.collapse-btn {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-panel-hover);
  color: var(--text);
  z-index: 2;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 36px 8px 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  color: var(--text-muted);
  border: 1px solid transparent;
}

.nav-item:hover {
  background: var(--bg-panel-hover);
  color: var(--text);
}

.nav-item.active {
  background: rgba(61, 156, 245, 0.15);
  border-color: rgba(61, 156, 245, 0.4);
  color: var(--accent);
}

.nav-icon {
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.nav-text {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.footer {
  height: var(--footer-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  background: var(--bg-panel);
}

.sep {
  opacity: 0.5;
}
</style>
