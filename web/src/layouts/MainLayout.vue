<template>
  <div class="layout">
    <div class="layout-grid" aria-hidden="true" />
    <header class="header panel">
      <div class="brand">
        <span class="logo-wrap">
          <span class="logo">AI+GIS</span>
          <span class="logo-tag">SPATIAL INTEL</span>
        </span>
        <div class="brand-text">
          <span class="name">城市经济空间展示平台</span>
          <span class="sub" title="体系参考，非政务生产数据">智眼体系参考 · 开放/模拟数据</span>
        </div>
      </div>
      <div class="page-title">
        <span class="page-title-line" />
        <span class="page-title-text">{{ pageTitle }}</span>
        <span class="page-title-line" />
      </div>
      <div class="header-right">
        <span class="live">
          <span class="live-dot" />
          LIVE
        </span>
        <span class="badge">{{ envLabel }}</span>
        <time class="clock mono">{{ clock }}</time>
        <span class="user-chip mono">{{ userChip }}</span>
      </div>
    </header>
    <GlobalContextBar />
    <AnalysisTaskStrip />
    <div class="body">
      <aside :class="['sidebar', 'panel', { collapsed: sidebarCollapsed }]">
        <div class="sidebar-rail" aria-hidden="true" />
        <button
          type="button"
          class="collapse-btn"
          :title="sidebarCollapsed ? '展开导航' : '收起导航'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          {{ sidebarCollapsed ? '»' : '«' }}
        </button>
        <div class="nav-head mono">MODULES</div>
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
            <span v-if="!sidebarCollapsed" class="nav-code mono">{{ item.code }}</span>
          </RouterLink>
        </nav>
      </aside>
      <main class="main">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>
    <footer class="footer mono">
      <span class="footer-key">CRS WGS84</span>
      <span class="sep">│</span>
      <span>坐标 / 比例尺由各页地图控件指示</span>
      <span class="sep">│</span>
      <span>{{ footerMeta }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import GlobalContextBar from '@/components/GlobalContextBar.vue';
import AnalysisTaskStrip from '@/components/AnalysisTaskStrip.vue';
import { gis, dataSourceLabel } from '@/stores/gisState';

const route = useRoute();
const sidebarCollapsed = ref(false);
const clock = ref('');
const envLabel = '演示';
const userChip = 'SESSION · LOCAL';

const footerMeta = computed(
  () => `DS ${gis.dataSource} · T ${gis.timeSingle} · ${dataSourceLabel.value}`,
);

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
  { to: '/overview', label: '空间总览', code: 'OV', icon: '🗺' },
  { to: '/scene3d', label: '三维城市', code: 'S3', icon: '🏙' },
  { to: '/vitality', label: '经济活力', code: 'VI', icon: '📊' },
  { to: '/districts', label: '商圈识别', code: 'BD', icon: '◎' },
  { to: '/population', label: '人口与消费', code: 'PO', icon: '👥' },
  { to: '/dynamics', label: '经济动态', code: 'DY', icon: '⏱' },
  { to: '/lowaltitude', label: '低空数据', code: 'LA', icon: '🛸' },
];
</script>

<style scoped>
.layout {
  position: relative;
  z-index: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout-grid {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.4;
  background-image:
    linear-gradient(rgba(56, 189, 248, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.045) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse 85% 75% at 50% 40%, black 15%, transparent 72%);
}

.layout > :not(.layout-grid) {
  position: relative;
  z-index: 1;
}

.header {
  height: var(--header-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 18px;
  gap: 16px;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  border-bottom: 1px solid rgba(56, 189, 248, 0.22);
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.45), inset 0 -1px 0 rgba(129, 140, 248, 0.12);
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.logo-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.logo {
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  background: linear-gradient(120deg, #38bdf8 0%, #a78bfa 50%, #22d3ee 100%);
  background-size: 160% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.35));
}

.logo-tag {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.28em;
  color: var(--text-muted);
  opacity: 0.85;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.02em;
}

.sub {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

.page-title {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 0;
}

.page-title-line {
  flex: 1;
  max-width: 120px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.45), transparent);
}

.page-title-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  text-shadow: 0 0 24px rgba(56, 189, 248, 0.15);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted);
}

.live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--success);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 10px var(--success);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.65;
    transform: scale(0.92);
  }
}

.badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.35);
  color: var(--accent-hot);
  box-shadow: 0 0 16px rgba(251, 191, 36, 0.12);
}

.clock {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.65);
  color: var(--accent);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.user-chip {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px dashed rgba(129, 140, 248, 0.45);
  color: var(--accent-secondary);
  font-size: 10px;
}

.mono {
  font-family: var(--font-mono);
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
  transition:
    width 0.22s ease,
    box-shadow 0.22s ease;
  box-shadow: 4px 0 28px rgba(0, 0, 0, 0.22);
}

.sidebar-rail {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, rgba(56, 189, 248, 0.55), rgba(129, 140, 248, 0.35), rgba(52, 211, 153, 0.25));
  opacity: 0.85;
}

.sidebar.collapsed {
  width: var(--sidebar-w-collapsed);
}

.collapse-btn {
  position: absolute;
  right: 8px;
  top: 10px;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: rgba(30, 41, 59, 0.9);
  color: var(--accent);
  z-index: 2;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.collapse-btn:hover {
  border-color: var(--border-glow);
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.2);
}

.nav-head {
  padding: 38px 16px 6px;
  font-size: 9px;
  letter-spacing: 0.35em;
  color: var(--text-muted);
  opacity: 0.75;
}

.sidebar.collapsed .nav-head {
  display: none;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 4px 10px 12px;
}

.nav-item {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  border-radius: 8px;
  color: var(--text-muted);
  border: 1px solid transparent;
  transition:
    background 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
}

.sidebar.collapsed .nav-item {
  grid-template-columns: 28px;
  justify-items: center;
}

.nav-item:hover {
  background: rgba(56, 189, 248, 0.06);
  border-color: rgba(56, 189, 248, 0.15);
  color: var(--text);
}

.nav-item.active {
  background: linear-gradient(90deg, rgba(56, 189, 248, 0.14), rgba(129, 140, 248, 0.06));
  border-color: rgba(56, 189, 248, 0.35);
  box-shadow:
    inset 3px 0 0 #38bdf8,
    0 0 20px rgba(56, 189, 248, 0.12);
  color: var(--accent);
}

.nav-icon {
  text-align: center;
  font-size: 15px;
}

.nav-text {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-code {
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  opacity: 0.75;
}

.nav-item.active .nav-code {
  color: var(--accent);
  opacity: 1;
}

.sidebar.collapsed .nav-text,
.sidebar.collapsed .nav-code {
  display: none;
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
  gap: 12px;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  border-top: 1px solid rgba(56, 189, 248, 0.15);
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(10px);
}

.footer-key {
  color: var(--accent-dim);
}

.sep {
  opacity: 0.35;
}
</style>
