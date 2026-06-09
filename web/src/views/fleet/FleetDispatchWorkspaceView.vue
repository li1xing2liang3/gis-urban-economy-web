<template>
  <div class="workspace">
    <main class="sim-main">
      <div class="sim-stage panel">
        <div class="stage-head">
          <div>
            <span class="stage-tag mono">SIM · {{ viewMode === '3d' ? '3D' : '2D' }}</span>
            <strong>{{ activeScenario.name }}</strong>
          </div>
          <div class="stage-badges">
            <span class="badge">{{ activeScenario.strategy }}</span>
            <span class="badge dim">{{ activeScenario.droneCount }} 架</span>
            <span class="badge warn">{{ telemetryBadge }}</span>
            <span v-if="activeFrame" class="badge dim">{{ activeFrame.activeCount }} 机空中</span>
          </div>
        </div>

        <div class="view-toggle" role="tablist" aria-label="仿真视图切换">
          <button type="button" :class="{ active: viewMode === '2d' }" @click="viewMode = '2d'">二维协同</button>
          <button type="button" :class="{ active: viewMode === '3d' }" @click="viewMode = '3d'">Cesium 三维</button>
        </div>

        <div class="stage-viewport" aria-label="多机协同仿真">
          <div class="viewport-grid" aria-hidden="true" />

          <div v-show="viewMode === '2d'" class="viewport-2d">
            <svg class="fleet-preview" viewBox="0 0 640 360" aria-hidden="true">
              <defs>
                <linearGradient id="wsSky" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#041016" />
                  <stop offset="100%" stop-color="#0f172a" />
                </linearGradient>
                <filter id="wsGlow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect width="640" height="360" fill="url(#wsSky)" />
              <g opacity="0.35">
                <polyline
                  v-for="(path, idx) in previewPaths"
                  :key="`full-${idx}`"
                  :points="path.points"
                  fill="none"
                  :stroke="path.color"
                  stroke-width="2"
                  stroke-dasharray="6 4"
                />
              </g>
              <g opacity="0.9">
                <polyline
                  v-for="(path, idx) in progressPaths"
                  :key="`prog-${idx}`"
                  :points="path.points"
                  fill="none"
                  :stroke="path.color"
                  stroke-width="3"
                />
              </g>
              <g v-for="drone in previewDrones" :key="drone.id" :transform="`translate(${drone.x} ${drone.y})`">
                <circle r="16" :fill="drone.color" opacity="0.2" />
                <circle r="7" :fill="drone.color" filter="url(#wsGlow)" />
                <text y="-14" text-anchor="middle" fill="#ccfbf1" font-size="9">{{ drone.label }}</text>
                <text v-if="drone.phase" y="22" text-anchor="middle" fill="#94a3b8" font-size="8">{{ drone.phase }}</text>
              </g>
            </svg>
          </div>

          <div v-show="viewMode === '3d'" ref="cesiumEl" class="viewport-3d">
            <div v-if="sceneError" class="cesium-fallback">
              <strong>三维场景不可用</strong>
              <span>{{ sceneError }}</span>
              <button type="button" @click="retryCesium">重试</button>
            </div>
          </div>

          <div class="timeline-overlay">
            <div class="timeline-head">
              <span>协同时序 Gantt · {{ simSecLabel }}</span>
              <strong>{{ simPercent }}%</strong>
            </div>
            <div class="timeline-track" aria-hidden="true">
              <div
                v-for="ev in activeScenario.schedule"
                :key="ev.id"
                class="timeline-block"
                :class="ev.kind"
                :style="eventStyle(ev)"
                :title="`${ev.label} · ${ev.droneId}`"
              />
              <i class="timeline-cursor" :style="{ left: `${simPercent}%` }" />
            </div>
          </div>
        </div>

        <div class="stage-controls">
          <button type="button" class="flight-btn" @click="togglePlayback">
            {{ isPlaying ? '暂停协同仿真' : simPercent >= 100 ? '重新播放' : '开始协同仿真' }}
          </button>
          <button type="button" class="flight-btn ghost" @click="resetPlayback">重置</button>
          <label class="speed-ctl mono">
            倍速
            <select v-model.number="speed">
              <option :value="0.75">0.75×</option>
              <option :value="1">1×</option>
              <option :value="1.5">1.5×</option>
              <option :value="2.5">2.5×</option>
              <option :value="4">4×</option>
            </select>
          </label>
          <input
            class="seek-slider"
            type="range"
            min="0"
            max="100"
            step="0.5"
            :value="simPercent"
            @input="onSeek"
          />
          <div class="flight-bar" aria-hidden="true">
            <i :style="{ width: `${simPercent}%` }"></i>
          </div>
          <span class="phase mono">{{ phaseLabel }}</span>
        </div>
      </div>
    </main>

    <aside class="side panel">
      <div class="side-head">
        <h3>调度控制台</h3>
        <p>选择协同方案、下发任务并回放多机协同时序。数据来自 Mock 编队仿真集。</p>
        <p v-if="loading" class="hint">正在加载编队方案…</p>
        <p v-else-if="error" class="hint warn">{{ error }}</p>
        <p v-else-if="meta" class="hint mono">{{ meta.version }} · {{ meta.source }}</p>
        <p v-if="simError" class="hint warn">{{ simError }}</p>
        <p v-else-if="registry" class="hint mono">
          机队注册 {{ registry.drones.length }} 架 · 遥测 {{ activeTelemetry?.sampleIntervalSec ?? 2 }}s 采样
        </p>
        <p v-if="dispatchTaskId" class="hint mono task-hint">任务队列 · {{ dispatchTaskMessage }}</p>
      </div>

      <div class="summary">
        <div>
          <span>编队规模</span>
          <strong>{{ activeScenario.droneCount }}</strong>
        </div>
        <div>
          <span>冲突消解</span>
          <strong>{{ activeScenario.metrics.conflictResolved }}</strong>
        </div>
        <div>
          <span>平均间隔</span>
          <strong>{{ activeScenario.metrics.avgSeparationM }}m</strong>
        </div>
      </div>

      <section class="block">
        <div class="block-head">
          <span>当前方案</span>
          <RouterLink class="mini-link" to="/fleet-dispatch/scenarios">方案库 →</RouterLink>
        </div>
        <button
          v-for="scenario in scenarios"
          :key="scenario.id"
          type="button"
          class="scenario-btn"
          :class="{ active: scenario.id === activeScenarioId }"
          @click="selectScenario(scenario.id)"
        >
          <strong>{{ scenario.name }}</strong>
          <span>{{ scenario.district }} · {{ scenario.droneCount }} 架</span>
        </button>
      </section>

      <section class="block">
        <div class="block-head">
          <span>机队编组</span>
          <strong>{{ activeScenario.drones.length }} 架</strong>
        </div>
        <ul class="roster">
          <li v-for="drone in activeScenario.drones" :key="drone.droneId">
            <span class="dot" :style="{ background: drone.color }" />
            <div>
              <strong>{{ drone.droneName }}</strong>
              <em>+{{ drone.startOffsetSec }}s · {{ drone.altitudeLayerM }}m · {{ liveBattery(drone.droneId, drone.batteryPct) }}%</em>
              <em v-if="drone.takeoffSiteId"> · {{ drone.takeoffSiteId }}</em>
            </div>
            <span :class="['status', liveDroneStatus(drone.droneId, drone.status)]">
              {{ liveDroneLabel(drone.droneId, drone.status) }}
            </span>
          </li>
        </ul>
      </section>

      <section class="block">
        <div class="block-head">
          <span>协同规则</span>
          <strong>{{ enabledRuleCount }} / {{ activeScenario.rules.length }}</strong>
        </div>
        <ul class="rules">
          <li v-for="rule in activeScenario.rules" :key="rule.id" :class="{ off: !rule.enabled }">
            <strong>{{ rule.label }}</strong>
            <span>{{ rule.description }}</span>
          </li>
        </ul>
      </section>

      <section class="block">
        <div class="block-head">
          <span>冲突消解</span>
          <strong>{{ activeConflicts.length }} 次</strong>
        </div>
        <ul class="conflicts">
          <li
            v-for="conflict in activeConflicts"
            :key="conflict.id"
            :class="{ hot: isConflictActive(simSec, conflict.simSec) }"
          >
            <strong>{{ conflict.simSec }}s · {{ conflict.conflictType }}</strong>
            <span>{{ conflict.droneIds.join(' / ') }}</span>
            <em>{{ conflict.resolution }}</em>
          </li>
          <li v-if="!activeConflicts.length" class="empty">当前方案无预置冲突记录</li>
        </ul>
      </section>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useFleetDispatchPlans } from '@/composables/useFleetDispatchPlans';
import {
  enrichScenarioWithRegistry,
  projectFleetTracksToSvg,
  useFleetSimulationData,
} from '@/composables/useFleetSimulationData';
import {
  dronePhaseAtSec,
  isConflictActive,
  useFleetSimulationPlayback,
} from '@/composables/useFleetSimulationPlayback';
import { useCesiumUavFleet } from '@/composables/useCesiumUavFleet';
import { gis, pushTask, updateTask } from '@/stores/gisState';
import type { FleetDroneStatus, FleetScheduleEvent } from '@/types/uavFleet';

const route = useRoute();
const { scenarios, loading, error, meta } = useFleetDispatchPlans();
const activeScenarioId = ref('');
const { loading: simLoading, error: simError, activeTelemetry, activeConflicts, registry } =
  useFleetSimulationData(activeScenarioId);

const viewMode = ref<'2d' | '3d'>('2d');
const cesiumEl = ref<HTMLElement | null>(null);

const activeScenarioBase = computed(
  () => scenarios.value.find((s) => s.id === activeScenarioId.value) ?? scenarios.value[0]!,
);

const activeScenario = computed(() =>
  enrichScenarioWithRegistry(activeScenarioBase.value, registry.value),
);

const durationSec = computed(() => activeTelemetry.value?.durationSec ?? activeScenario.value.durationSec);

const {
  isPlaying,
  simSec,
  simPercent,
  speed,
  phase,
  currentFrame: activeFrame,
  toggle,
  reset,
  seekPercent,
  play,
} = useFleetSimulationPlayback(activeTelemetry, durationSec);

const { sceneError, retry: retryCesium, ensureReady: ensureCesiumReady } = useCesiumUavFleet(
  cesiumEl,
  activeTelemetry,
  simSec,
);

watch(viewMode, (mode) => {
  if (mode === '3d') {
    window.requestAnimationFrame(() => ensureCesiumReady());
  }
});

const dispatchTaskId = ref<string | null>(null);
const dispatchTaskMessage = ref('');

watch(
  scenarios,
  (list) => {
    if (!list.length) return;
    if (!list.some((s) => s.id === activeScenarioId.value)) {
      activeScenarioId.value = list[0]!.id;
    }
  },
  { immediate: true },
);

watch(
  () => route.query.scenario,
  (id) => {
    if (typeof id === 'string' && scenarios.value.some((s) => s.id === id)) {
      activeScenarioId.value = id;
    }
  },
  { immediate: true },
);

watch(activeScenarioId, () => {
  dispatchTaskId.value = null;
  dispatchTaskMessage.value = '';
});

watch(phase, (p, prev) => {
  if (p === 'dispatching' && prev !== 'dispatching' && !dispatchTaskId.value) {
    dispatchTaskId.value = pushTask({
      name: `编队调度 · ${activeScenario.value.name}`,
      page: 'fleet-dispatch',
      message: `${activeScenario.value.droneCount} 机任务下发中…`,
    });
    dispatchTaskMessage.value = '下发中…';
  }
  if (p === 'completed' && dispatchTaskId.value) {
    updateTask(dispatchTaskId.value, {
      status: 'success',
      message: `协同仿真完成 · ${activeScenario.value.droneCount} 机`,
      finishedAt: new Date().toISOString(),
    });
    dispatchTaskMessage.value = '已完成';
    if (activeScenario.value.id === 'scenario-vitality-sync') {
      gis.uavInVitalityModel = true;
      gis.uavQualityBoost = Math.min(0.2, gis.uavQualityBoost + 0.03);
    }
  }
});

const enabledRuleCount = computed(() => activeScenario.value.rules.filter((r) => r.enabled).length);

const phaseLabel = computed(() => {
  const map = {
    idle: 'IDLE',
    planning: 'PLAN',
    dispatching: 'DISP',
    coordinating: 'COORD',
    completed: 'DONE',
  };
  return map[phase.value];
});

const simSecLabel = computed(() => `${simSec.value.toFixed(1)}s / ${durationSec.value}s`);

const svgProjection = computed(() => {
  const projected = projectFleetTracksToSvg(activeTelemetry.value, 640, 360, simSec.value);
  if (projected.paths.length) return projected;
  return {
    paths: activeScenario.value.drones.map((d, idx) => ({
      color: d.color,
      points: buildPreviewPath(idx, activeScenario.value.drones.length),
    })),
    progressPaths: [] as Array<{ color: string; points: string }>,
    drones: activeScenario.value.drones.map((drone, idx) => {
      const total = activeScenario.value.drones.length;
      const angle = (idx / total) * Math.PI * 1.6 - Math.PI * 0.3;
      return {
        id: drone.droneId,
        x: 320 + Math.cos(angle) * 140,
        y: 180 + Math.sin(angle) * 70,
        color: drone.color,
        label: drone.droneName.split('·')[0]?.trim() ?? drone.droneId,
      };
    }),
  };
});

const previewPaths = computed(() => svgProjection.value.paths);
const progressPaths = computed(() => svgProjection.value.progressPaths);
const previewDrones = computed(() => svgProjection.value.drones);

const telemetryBadge = computed(() => {
  if (simLoading.value) return '加载遥测数据…';
  if (activeTelemetry.value) {
    return `${activeTelemetry.value.tracks.length} 机轨迹 · ${activeTelemetry.value.frames.length} 同步帧`;
  }
  return '遥测数据待生成';
});

function selectScenario(id: string) {
  activeScenarioId.value = id;
  reset();
  dispatchTaskId.value = null;
  dispatchTaskMessage.value = '';
}

function togglePlayback() {
  if (simPercent.value >= 100 && !isPlaying.value) {
    reset();
    play();
    return;
  }
  toggle();
}

function resetPlayback() {
  reset();
  dispatchTaskId.value = null;
  dispatchTaskMessage.value = '';
}

function onSeek(ev: Event) {
  const val = Number((ev.target as HTMLInputElement).value);
  seekPercent(val);
}

function liveDroneLabel(droneId: string, fallback: FleetDroneStatus) {
  if (simSec.value <= 0) return statusLabel(fallback);
  return dronePhaseAtSec(activeScenario.value, droneId, simSec.value);
}

function liveDroneStatus(droneId: string, fallback: FleetDroneStatus): FleetDroneStatus {
  const label = liveDroneLabel(droneId, fallback);
  if (label === '完成') return 'done';
  if (label === '待命' || label === '排队') return fallback === 'queued' ? 'queued' : 'idle';
  if (label === '悬停') return 'holding';
  if (label === '降落') return 'landing';
  if (['起飞', '巡航', '交接'].includes(label)) return 'airborne';
  return fallback;
}

function liveBattery(droneId: string, fallback: number) {
  const track = activeTelemetry.value?.tracks.find((t) => t.droneId === droneId);
  if (!track?.samples.length) return fallback;
  const sample = [...track.samples].reverse().find((s) => s.simSec <= simSec.value) ?? track.samples[0]!;
  return sample.batteryPct;
}

function statusLabel(status: FleetDroneStatus): string {
  const map: Record<FleetDroneStatus, string> = {
    idle: '待命',
    queued: '排队',
    airborne: '空中',
    holding: '悬停',
    landing: '降落',
    done: '完成',
  };
  return map[status];
}

function eventStyle(ev: FleetScheduleEvent) {
  const total = activeScenario.value.durationSec || 1;
  const drone = activeScenario.value.drones.find((d) => d.droneId === ev.droneId);
  return {
    left: `${(ev.startSec / total) * 100}%`,
    width: `${Math.max(4, (ev.durationSec / total) * 100)}%`,
    background: drone?.color ?? '#64748b',
  };
}

function buildPreviewPath(index: number, count: number): string {
  const cx = 320;
  const cy = 190;
  const r = 90 + index * 18;
  const start = index * 0.8;
  const pts: string[] = [];
  const steps = Math.max(6, count * 2);
  for (let i = 0; i <= steps; i += 1) {
    const t = start + (i / steps) * Math.PI * 1.2;
    pts.push(`${cx + Math.cos(t) * r},${cy + Math.sin(t) * (r * 0.55)}`);
  }
  return pts.join(' ');
}
</script>

<style scoped>
.workspace {
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 12px;
  gap: 12px;
}

.panel {
  border: 1px solid rgba(45, 212, 191, 0.18);
  background: rgba(6, 24, 28, 0.55);
  border-radius: 12px;
}

.sim-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.sim-stage {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 14px;
  gap: 10px;
}

.stage-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.stage-head strong {
  display: block;
  font-size: 17px;
  margin-top: 4px;
}

.stage-tag {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: #2dd4bf;
}

.stage-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.badge {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  border: 1px solid rgba(45, 212, 191, 0.35);
  color: #2dd4bf;
}

.badge.dim {
  border-color: rgba(148, 163, 184, 0.25);
  color: #94a3b8;
}

.badge.warn {
  border-color: rgba(251, 191, 36, 0.4);
  color: #fbbf24;
}

.view-toggle {
  display: flex;
  gap: 6px;
}

.view-toggle button {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 11px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(4, 16, 22, 0.45);
  color: #94a3b8;
  cursor: pointer;
}

.view-toggle button.active {
  color: #2dd4bf;
  border-color: rgba(45, 212, 191, 0.4);
  background: rgba(45, 212, 191, 0.1);
}

.stage-viewport {
  position: relative;
  flex: 1;
  min-height: 360px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(45, 212, 191, 0.15);
  background: #041016;
}

.viewport-grid {
  position: absolute;
  inset: 0;
  opacity: 0.3;
  z-index: 0;
  background-image:
    linear-gradient(rgba(45, 212, 191, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.07) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}

.viewport-2d,
.viewport-3d {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.fleet-preview {
  width: 100%;
  height: 100%;
  display: block;
}

.viewport-3d :deep(.cesium-viewer),
.viewport-3d :deep(.cesium-viewer-cesiumWidgetContainer),
.viewport-3d :deep(.cesium-widget),
.viewport-3d :deep(.cesium-widget canvas) {
  width: 100% !important;
  height: 100% !important;
}

.cesium-fallback {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-content: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
  background: rgba(4, 16, 22, 0.92);
}

.cesium-fallback strong {
  color: #fbbf24;
}

.cesium-fallback span {
  font-size: 12px;
  color: #94a3b8;
  max-width: 280px;
}

.cesium-fallback button {
  justify-self: center;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(45, 212, 191, 0.35);
  background: rgba(45, 212, 191, 0.1);
  color: #2dd4bf;
  cursor: pointer;
}

.timeline-overlay {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 3;
  padding: 10px;
  border-radius: 8px;
  background: rgba(4, 16, 22, 0.88);
  border: 1px solid rgba(45, 212, 191, 0.2);
}

.timeline-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
  color: #94a3b8;
}

.timeline-head strong {
  color: #2dd4bf;
}

.timeline-track {
  position: relative;
  height: 28px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.85);
}

.timeline-block {
  position: absolute;
  top: 4px;
  height: 20px;
  border-radius: 4px;
  opacity: 0.75;
  min-width: 8px;
}

.timeline-block.hold {
  opacity: 0.45;
}

.timeline-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #fff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.6);
}

.stage-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.flight-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(45, 212, 191, 0.35);
  background: rgba(45, 212, 191, 0.12);
  color: #2dd4bf;
  cursor: pointer;
  font-weight: 600;
}

.flight-btn.ghost {
  color: #94a3b8;
  border-color: rgba(148, 163, 184, 0.25);
  background: transparent;
  font-weight: 500;
}

.speed-ctl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #64748b;
}

.speed-ctl select {
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(4, 16, 22, 0.8);
  color: #cbd5e1;
  font-size: 10px;
}

.seek-slider {
  flex: 1;
  min-width: 80px;
  accent-color: #2dd4bf;
}

.flight-bar {
  flex: 1;
  min-width: 60px;
  height: 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.9);
  overflow: hidden;
}

.flight-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #2dd4bf, #fbbf24);
  transition: width 0.08s linear;
}

.phase {
  font-size: 10px;
  color: #64748b;
}

.side {
  width: 340px;
  flex-shrink: 0;
  padding: 14px;
  overflow: auto;
}

.side-head h3 {
  margin: 0 0 6px;
  font-size: 15px;
}

.side-head p {
  margin: 0 0 12px;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.45;
}

.hint {
  margin-top: -6px !important;
  margin-bottom: 10px !important;
}

.hint.warn {
  color: #fbbf24;
}

.task-hint {
  color: #2dd4bf !important;
}

.side-head code {
  font-size: 10px;
  color: #2dd4bf;
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.summary div {
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(45, 212, 191, 0.12);
  background: rgba(4, 16, 22, 0.5);
}

.summary span {
  display: block;
  font-size: 10px;
  color: #64748b;
}

.summary strong {
  font-size: 18px;
  color: #2dd4bf;
}

.block {
  margin-bottom: 12px;
}

.block-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  font-size: 10px;
  color: #64748b;
}

.block-head strong {
  color: #fbbf24;
  font-size: 12px;
}

.mini-link {
  font-size: 10px;
  color: #2dd4bf;
}

.scenario-btn {
  display: grid;
  gap: 3px;
  width: 100%;
  margin-bottom: 6px;
  padding: 9px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(4, 16, 22, 0.45);
  color: #e2e8f0;
  text-align: left;
  cursor: pointer;
}

.scenario-btn.active {
  border-color: rgba(45, 212, 191, 0.4);
  box-shadow: inset 2px 0 0 #2dd4bf;
}

.scenario-btn span {
  font-size: 10px;
  color: #94a3b8;
}

.roster,
.rules {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.roster li {
  display: grid;
  grid-template-columns: 8px 1fr auto;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(4, 16, 22, 0.45);
  border: 1px solid rgba(45, 212, 191, 0.08);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 4px;
}

.roster strong {
  display: block;
  font-size: 11px;
}

.roster em {
  font-style: normal;
  font-size: 10px;
  color: #64748b;
}

.status {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

.status.queued {
  color: #fbbf24;
}

.status.airborne,
.status.holding {
  color: #2dd4bf;
}

.rules li {
  padding: 8px;
  border-radius: 6px;
  background: rgba(4, 16, 22, 0.4);
  border: 1px solid rgba(45, 212, 191, 0.08);
}

.rules li.off {
  opacity: 0.45;
}

.rules strong {
  display: block;
  font-size: 11px;
}

.rules span {
  font-size: 10px;
  color: #64748b;
  line-height: 1.35;
}

.conflicts {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.conflicts li {
  padding: 8px;
  border-radius: 6px;
  background: rgba(4, 16, 22, 0.45);
  border: 1px solid rgba(251, 191, 36, 0.12);
  transition: border-color 0.15s, background 0.15s;
}

.conflicts li.hot {
  border-color: rgba(251, 191, 36, 0.55);
  background: rgba(251, 191, 36, 0.08);
  box-shadow: inset 2px 0 0 #fbbf24;
}

.conflicts strong {
  display: block;
  font-size: 11px;
  color: #fbbf24;
}

.conflicts span {
  display: block;
  font-size: 10px;
  color: #94a3b8;
  margin: 2px 0;
}

.conflicts em {
  display: block;
  font-style: normal;
  font-size: 10px;
  color: #64748b;
  line-height: 1.35;
}

.conflicts .empty {
  color: #64748b;
  font-size: 11px;
  border-style: dashed;
}

.mono {
  font-family: var(--font-mono);
}
</style>
