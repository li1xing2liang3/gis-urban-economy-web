<template>
  <div class="fleet-app">
    <div class="fleet-grid" aria-hidden="true" />
    <header class="fleet-header">
      <RouterLink class="brand" to="/fleet-dispatch">
        <span class="brand-icon" aria-hidden="true">🚁</span>
        <div>
          <strong>UAV Fleet Coordination</strong>
          <span>多无人机协同调度系统</span>
        </div>
      </RouterLink>

      <nav class="fleet-nav" aria-label="协同调度应用导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          active-class="active"
        >
          <span class="nav-code mono">{{ item.code }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="header-actions">
        <span class="live mono">
          <i />
          SIM
        </span>
        <time class="clock mono">{{ clock }}</time>
        <RouterLink class="back-link" to="/overview">← 返回 GIS 平台</RouterLink>
      </div>
    </header>

    <main class="fleet-main">
      <router-view />
    </main>

    <footer class="fleet-footer mono">
      <span>WUHAN · LOW ALTITUDE FLEET</span>
      <span class="sep">│</span>
      <span>{{ footerTitle }}</span>
      <span class="sep">│</span>
      <span>演示数据 · 本地 Mock</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();
const clock = ref('');
let timer: ReturnType<typeof setInterval> | undefined;

const navItems = [
  { to: '/fleet-dispatch', label: '应用首页', code: 'HOME' },
  { to: '/fleet-dispatch/workspace', label: '调度工作台', code: 'OPS' },
  { to: '/fleet-dispatch/scenarios', label: '方案库', code: 'PLAN' },
];

const footerTitle = computed(() => (route.meta.title as string) || '多无人机协同调度');

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
</script>

<style scoped>
.fleet-app {
  --fleet-accent: #2dd4bf;
  --fleet-accent-hot: #fbbf24;
  --fleet-accent-dim: #14b8a6;
  --fleet-surface: rgba(6, 24, 28, 0.92);
  --fleet-border: rgba(45, 212, 191, 0.22);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #e6fffb;
  background:
    radial-gradient(circle at 12% 18%, rgba(45, 212, 191, 0.12), transparent 28%),
    radial-gradient(circle at 88% 12%, rgba(251, 191, 36, 0.08), transparent 22%),
    linear-gradient(180deg, #041016 0%, #071821 48%, #030a10 100%);
  position: relative;
}

.fleet-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.35;
  background-image:
    linear-gradient(rgba(45, 212, 191, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.05) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 90% 80% at 50% 35%, black 10%, transparent 75%);
}

.fleet-app > :not(.fleet-grid) {
  position: relative;
  z-index: 1;
}

.fleet-header {
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
  border-bottom: 1px solid var(--fleet-border);
  background: rgba(4, 16, 22, 0.88);
  backdrop-filter: blur(12px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  flex-shrink: 0;
}

.brand-icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(45, 212, 191, 0.22), rgba(20, 184, 166, 0.08));
  border: 1px solid var(--fleet-border);
  font-size: 18px;
}

.brand strong {
  display: block;
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--fleet-accent);
}

.brand span {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

.fleet-nav {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 6px;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: #94a3b8;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.nav-link:hover {
  color: #e2e8f0;
  background: rgba(45, 212, 191, 0.06);
}

.nav-link.active {
  color: var(--fleet-accent);
  border-color: var(--fleet-border);
  background: rgba(45, 212, 191, 0.1);
  box-shadow: inset 0 -2px 0 var(--fleet-accent);
}

.nav-code {
  font-size: 9px;
  letter-spacing: 0.12em;
  opacity: 0.7;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--fleet-accent);
}

.live i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fleet-accent);
  box-shadow: 0 0 10px var(--fleet-accent);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

.clock {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--fleet-border);
  color: var(--fleet-accent-dim);
}

.back-link {
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  color: #94a3b8;
}

.back-link:hover {
  color: #e2e8f0;
  border-color: rgba(45, 212, 191, 0.35);
}

.fleet-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.fleet-footer {
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: #64748b;
  border-top: 1px solid rgba(45, 212, 191, 0.12);
  background: rgba(4, 12, 18, 0.9);
}

.sep {
  opacity: 0.35;
}

.mono {
  font-family: var(--font-mono);
}
</style>
