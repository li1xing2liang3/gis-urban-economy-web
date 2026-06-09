<template>
  <div class="home">
    <section class="hero">
      <div class="hero-bg" aria-hidden="true">
        <span class="orbit orbit-a" />
        <span class="orbit orbit-b" />
        <span class="orbit orbit-c" />
      </div>

      <div class="hero-copy">
        <p class="eyebrow mono">WUHAN · MULTI-UAV · COORDINATION</p>
        <h1>多无人机协同调度系统</h1>
        <p class="lead">
          面向城市低空经济的独立调度应用：多机任务分配、空域冲突消解、协同时序编排与三维航线仿真。
          复用平台单机航线与 Cesium 动画能力，扩展为编队级调度演示。
        </p>
        <div class="hero-actions">
          <RouterLink class="btn primary" to="/fleet-dispatch/workspace">进入调度工作台</RouterLink>
          <RouterLink class="btn ghost" to="/fleet-dispatch/scenarios">浏览协同方案库</RouterLink>
        </div>
      </div>

      <div class="hero-visual panel" aria-hidden="true">
        <svg viewBox="0 0 420 280" class="fleet-art">
          <defs>
            <radialGradient id="homeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#2dd4bf" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle cx="210" cy="140" r="110" fill="url(#homeGlow)" />
          <g opacity="0.45">
            <path d="M 60 180 Q 140 80 210 120 T 360 100" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="5 4" />
            <path d="M 80 200 Q 180 60 240 150 T 380 160" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="5 4" />
            <path d="M 100 220 Q 200 100 280 180 T 340 80" fill="none" stroke="#fb7185" stroke-width="2" stroke-dasharray="5 4" />
          </g>
          <g v-for="(node, idx) in droneNodes" :key="idx">
            <circle :cx="node.x" :cy="node.y" r="16" :fill="node.color" opacity="0.15" />
            <circle :cx="node.x" :cy="node.y" r="6" :fill="node.color" />
          </g>
          <text x="210" y="252" text-anchor="middle" fill="#64748b" font-size="11">多航线 · 多机体 · 统一时钟</text>
        </svg>
      </div>
    </section>

    <section class="stats">
      <div v-for="stat in stats" :key="stat.label" class="stat panel">
        <span>{{ stat.label }}</span>
        <strong>{{ stat.value }}</strong>
        <em>{{ stat.note }}</em>
      </div>
    </section>

    <section class="features">
      <h2>应用能力</h2>
      <div class="feature-grid">
        <article v-for="feature in features" :key="feature.title" class="feature panel">
          <span class="feature-icon">{{ feature.icon }}</span>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.desc }}</p>
          <span class="feature-tag mono">{{ feature.tag }}</span>
        </article>
      </div>
    </section>

    <section class="flow panel">
      <h2>调度流程</h2>
      <ol>
        <li v-for="(step, idx) in workflow" :key="step.title">
          <span class="step-num mono">{{ String(idx + 1).padStart(2, '0') }}</span>
          <div>
            <strong>{{ step.title }}</strong>
            <p>{{ step.desc }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="links-bar">
      <span>关联模块</span>
      <RouterLink to="/lowaltitude">单机航线规划</RouterLink>
      <RouterLink to="/scene3d">三维城市漫游</RouterLink>
      <RouterLink to="/vitality">经济活力模型</RouterLink>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useFleetDispatchPlans } from '@/composables/useFleetDispatchPlans';

const { scenarios } = useFleetDispatchPlans();

const stats = computed(() => {
  const list = scenarios.value;
  if (!list.length) {
    return [
      { label: '预置协同方案', value: '0', note: '武汉低空演示场景' },
      { label: '最大编队规模', value: '—', note: '支持多机并行调度' },
      { label: '冲突消解演示', value: '—', note: '时间/高度/航廊规则' },
    ];
  }
  const maxDrones = Math.max(...list.map((s) => s.droneCount));
  const totalConflicts = list.reduce((sum, s) => sum + s.metrics.conflictResolved, 0);
  return [
    { label: '预置协同方案', value: String(list.length), note: 'uav-fleet-dispatch-plan.json' },
    { label: '最大编队规模', value: `${maxDrones} 架`, note: '支持多机并行调度' },
    { label: '冲突消解演示', value: `${totalConflicts} 次`, note: '时间/高度/航廊规则' },
  ];
});

const droneNodes = [
  { x: 120, y: 150, color: '#38bdf8' },
  { x: 210, y: 110, color: '#fbbf24' },
  { x: 300, y: 140, color: '#fb7185' },
  { x: 250, y: 200, color: '#34d399' },
];

const features = [
  {
    icon: '📋',
    title: '任务分配',
    desc: '将多条航线绑定到不同机体，按优先级、电量与起降点生成编组计划。',
    tag: 'ASSIGN',
  },
  {
    icon: '🛡',
    title: '空域协同',
    desc: '通过错峰起飞、高度分层与航廊互斥，消解多机同域飞行冲突。',
    tag: 'DE-CONFLICT',
  },
  {
    icon: '🎬',
    title: '三维仿真',
    desc: '复用 Cesium 单机航线动画，扩展为多实体统一时钟驱动的编队漫游。',
    tag: 'CESIUM',
  },
  {
    icon: '⏱',
    title: '时序编排',
    desc: 'Gantt 式协同时序轴，展示起飞、巡航、悬停、交接与返航阶段。',
    tag: 'SCHEDULE',
  },
];

const workflow = [
  { title: '选择协同方案', desc: '从方案库载入预置编队任务，或后续支持自定义编组。' },
  { title: '校验协同规则', desc: '启用垂直间隔、起飞错峰、分区空域等约束并预览调度结果。' },
  { title: '下发调度任务', desc: '播放仿真时自动写入全局任务队列，活力联动方案完成后回写模型权重。' },
  { title: '三维仿真回放', desc: '在工作台播放多机协同动画，观察空域占用与冲突消解过程。' },
];
</script>

<style scoped>
.home {
  flex: 1;
  overflow: auto;
  padding: 24px;
  display: grid;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.panel {
  border: 1px solid rgba(45, 212, 191, 0.18);
  background: rgba(6, 24, 28, 0.55);
  border-radius: 12px;
}

.hero {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 20px;
  align-items: center;
  position: relative;
  min-height: 320px;
}

.hero-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.orbit {
  position: absolute;
  border: 1px solid rgba(45, 212, 191, 0.12);
  border-radius: 50%;
}

.orbit-a {
  width: 420px;
  height: 420px;
  right: -80px;
  top: -60px;
}

.orbit-b {
  width: 280px;
  height: 280px;
  right: 20px;
  top: 20px;
}

.orbit-c {
  width: 160px;
  height: 160px;
  right: 80px;
  top: 80px;
  border-color: rgba(251, 191, 36, 0.2);
}

.hero-copy {
  position: relative;
  z-index: 1;
}

.eyebrow {
  margin: 0 0 10px;
  font-size: 10px;
  letter-spacing: 0.22em;
  color: #2dd4bf;
}

h1 {
  margin: 0 0 14px;
  font-size: clamp(28px, 4vw, 38px);
  line-height: 1.15;
  background: linear-gradient(120deg, #e6fffb, #2dd4bf 55%, #fbbf24);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.lead {
  margin: 0 0 20px;
  max-width: 520px;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.65;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}

.btn.primary {
  color: #042f2e;
  background: linear-gradient(120deg, #2dd4bf, #14b8a6);
  box-shadow: 0 0 24px rgba(45, 212, 191, 0.25);
}

.btn.ghost {
  color: #cbd5e1;
  border: 1px solid rgba(45, 212, 191, 0.28);
  background: rgba(45, 212, 191, 0.06);
}

.hero-visual {
  position: relative;
  z-index: 1;
  padding: 16px;
  min-height: 280px;
}

.fleet-art {
  width: 100%;
  height: 100%;
  display: block;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat {
  padding: 16px;
}

.stat span {
  display: block;
  font-size: 11px;
  color: #64748b;
}

.stat strong {
  display: block;
  margin: 6px 0 4px;
  font-size: 28px;
  color: #2dd4bf;
}

.stat em {
  font-style: normal;
  font-size: 11px;
  color: #94a3b8;
}

.features h2,
.flow h2 {
  margin: 0 0 14px;
  font-size: 18px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.feature {
  padding: 16px;
  display: grid;
  gap: 8px;
}

.feature-icon {
  font-size: 22px;
}

.feature h3 {
  margin: 0;
  font-size: 15px;
}

.feature p {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.55;
}

.feature-tag {
  font-size: 9px;
  letter-spacing: 0.14em;
  color: #14b8a6;
}

.flow {
  padding: 18px;
}

.flow ol {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}

.flow li {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  align-items: start;
  padding: 12px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid rgba(45, 212, 191, 0.1);
}

.step-num {
  font-size: 18px;
  color: #fbbf24;
  padding-top: 2px;
}

.flow strong {
  display: block;
  margin-bottom: 4px;
}

.flow p {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

.links-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.links-bar a {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}

.mono {
  font-family: var(--font-mono);
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .stats,
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
