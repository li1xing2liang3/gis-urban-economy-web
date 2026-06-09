<template>
  <div class="scenarios">
    <header class="page-head">
      <div>
        <h1>协同方案库</h1>
        <p>
          预置武汉低空经济多机协同调度演示方案，数据文件为
          <code>uav-fleet-dispatch-plan.json</code>（{{ loading ? '加载中…' : `${scenarios.length} 套方案` }}）。
        </p>
        <p v-if="meta" class="meta-line mono">{{ meta.version }} · {{ meta.source }}</p>
      </div>
      <RouterLink class="btn" to="/fleet-dispatch/workspace">打开调度工作台</RouterLink>
    </header>

    <div class="cards">
      <article v-for="scenario in scenarios" :key="scenario.id" class="card panel">
        <div class="card-top">
          <span class="tag mono">{{ scenario.strategy }}</span>
          <strong>{{ scenario.name }}</strong>
          <p>{{ scenario.summary }}</p>
        </div>

        <dl class="meta">
          <div>
            <dt>覆盖区域</dt>
            <dd>{{ scenario.district }}</dd>
          </div>
          <div>
            <dt>编队规模</dt>
            <dd>{{ scenario.droneCount }} 架</dd>
          </div>
          <div>
            <dt>任务时长</dt>
            <dd>{{ formatDuration(scenario.durationSec) }}</dd>
          </div>
          <div>
            <dt>冲突消解</dt>
            <dd>{{ scenario.metrics.conflictResolved }} 次</dd>
          </div>
        </dl>

        <div class="drones">
          <span
            v-for="drone in scenario.drones"
            :key="drone.droneId"
            class="drone-chip"
            :style="{ borderColor: drone.color, color: drone.color }"
          >
            {{ drone.droneName }}
          </span>
        </div>

        <ul class="rules-preview">
          <li v-for="rule in scenario.rules.filter((r) => r.enabled)" :key="rule.id">{{ rule.label }}</li>
        </ul>

        <RouterLink
          class="load-btn"
          :to="{ path: '/fleet-dispatch/workspace', query: { scenario: scenario.id } }"
        >
          载入工作台
        </RouterLink>
      </article>
    </div>

    <section class="roadmap panel">
      <h2>后续实现计划</h2>
      <div class="roadmap-grid">
        <div v-for="step in roadmap" :key="step.title" :class="{ done: step.done }">
          <span class="mono">{{ step.phase }}{{ step.done ? ' ✓' : '' }}</span>
          <strong>{{ step.title }}</strong>
          <p>{{ step.desc }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useFleetDispatchPlans } from '@/composables/useFleetDispatchPlans';

const { scenarios, meta, loading } = useFleetDispatchPlans();

const roadmap = [
  { phase: 'P1', title: '编队方案数据', desc: '已完成：uav-fleet-dispatch-plan.json + gisDataService 加载', done: true },
  { phase: 'P2', title: '协同仿真回放', desc: '已完成：统一时钟 Gantt + 二维轨迹 + 冲突高亮', done: true },
  { phase: 'P3', title: 'Cesium 多机', desc: '已完成：useCesiumUavFleet 多实体同步驱动', done: true },
  { phase: 'P4', title: '任务联动', desc: '部分完成：任务队列下发 + 活力模型回写（四机方案）', done: false },
];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}
</script>

<style scoped>
.scenarios {
  flex: 1;
  overflow: auto;
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.page-head h1 {
  margin: 0 0 8px;
  font-size: 24px;
  color: #ccfbf1;
}

.page-head p {
  margin: 0;
  max-width: 560px;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.55;
}

.meta-line {
  margin-top: 6px !important;
  font-size: 11px !important;
  color: #2dd4bf !important;
}

.page-head code {
  color: #2dd4bf;
  font-size: 12px;
}

.btn {
  flex-shrink: 0;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #042f2e;
  background: linear-gradient(120deg, #2dd4bf, #14b8a6);
}

.panel {
  border: 1px solid rgba(45, 212, 191, 0.18);
  background: rgba(6, 24, 28, 0.55);
  border-radius: 12px;
}

.cards {
  display: grid;
  gap: 14px;
  margin-bottom: 20px;
}

.card {
  padding: 18px;
  display: grid;
  gap: 14px;
}

.tag {
  display: inline-block;
  margin-bottom: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 9px;
  letter-spacing: 0.1em;
  color: #2dd4bf;
  border: 1px solid rgba(45, 212, 191, 0.3);
}

.card strong {
  display: block;
  font-size: 17px;
  margin-bottom: 6px;
}

.card p {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.55;
}

.meta {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 0;
}

.meta div {
  padding: 10px;
  border-radius: 8px;
  background: rgba(4, 16, 22, 0.5);
  border: 1px solid rgba(45, 212, 191, 0.08);
}

.meta dt {
  font-size: 10px;
  color: #64748b;
  margin-bottom: 4px;
}

.meta dd {
  margin: 0;
  font-size: 13px;
  color: #e2e8f0;
}

.drones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.drone-chip {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10px;
  border: 1px solid;
  background: rgba(4, 16, 22, 0.45);
}

.rules-preview {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.6;
}

.load-btn {
  justify-self: start;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #2dd4bf;
  border: 1px solid rgba(45, 212, 191, 0.35);
  background: rgba(45, 212, 191, 0.08);
}

.roadmap {
  padding: 18px;
}

.roadmap h2 {
  margin: 0 0 14px;
  font-size: 16px;
}

.roadmap-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.roadmap-grid div.done {
  border-style: solid;
  border-color: rgba(45, 212, 191, 0.28);
}

.roadmap-grid div.done span {
  color: #2dd4bf;
}

.roadmap-grid div {
  padding: 12px;
  border-radius: 8px;
  background: rgba(4, 16, 22, 0.45);
  border: 1px dashed rgba(45, 212, 191, 0.15);
}

.roadmap-grid span {
  font-size: 10px;
  color: #fbbf24;
}

.roadmap-grid strong {
  display: block;
  margin: 4px 0;
  font-size: 13px;
}

.roadmap-grid p {
  margin: 0;
  font-size: 11px;
  color: #64748b;
  line-height: 1.45;
}

.mono {
  font-family: var(--font-mono);
}

@media (max-width: 800px) {
  .meta,
  .roadmap-grid {
    grid-template-columns: 1fr 1fr;
  }

  .page-head {
    flex-direction: column;
  }
}
</style>
