import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import type { FleetDispatchScenario, FleetScenarioTelemetry, FleetSimulationPhase, FleetSyncFrame } from '@/types/uavFleet';

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** 按 simSec 插值同步帧（供 SVG / Cesium 共用） */
export function getFleetFrameAtSec(
  telemetry: FleetScenarioTelemetry | null,
  simSec: number,
): FleetSyncFrame | null {
  if (!telemetry?.frames?.length) return null;
  const frames = telemetry.frames;
  if (simSec <= frames[0]!.simSec) return frames[0]!;
  const last = frames[frames.length - 1]!;
  if (simSec >= last.simSec) return last;

  let i = 0;
  while (i < frames.length - 1 && frames[i + 1]!.simSec <= simSec) i += 1;
  const a = frames[i]!;
  const b = frames[i + 1]!;
  const span = b.simSec - a.simSec || 1;
  const t = (simSec - a.simSec) / span;

  const droneIds = new Set([
    ...a.positions.map((p) => p.droneId),
    ...b.positions.map((p) => p.droneId),
  ]);

  const positions = [...droneIds]
    .map((droneId) => {
      const pa = a.positions.find((p) => p.droneId === droneId);
      const pb = b.positions.find((p) => p.droneId === droneId);
      if (pa && pb) {
        return {
          ...pa,
          lng: lerp(pa.lng, pb.lng, t),
          lat: lerp(pa.lat, pb.lat, t),
          altitudeM: lerp(pa.altitudeM, pb.altitudeM, t),
        };
      }
      return pa ?? pb ?? null;
    })
    .filter((p): p is FleetSyncFrame['positions'][number] => p != null);

  return {
    simSec,
    activeCount: positions.length,
    positions,
  };
}

export function resolveFleetPhase(
  simSec: number,
  durationSec: number,
  frame: FleetSyncFrame | null,
): FleetSimulationPhase {
  if (simSec <= 0) return 'idle';
  if (simSec >= durationSec) return 'completed';
  const active = frame?.activeCount ?? 0;
  if (simSec < durationSec * 0.06) return 'planning';
  if (active <= 1 && simSec < durationSec * 0.18) return 'dispatching';
  return 'coordinating';
}

export function useFleetSimulationPlayback(
  telemetry: Ref<FleetScenarioTelemetry | null>,
  durationSec: Ref<number>,
) {
  const isPlaying = ref(false);
  const simSec = ref(0);
  const speed = ref(1.5);

  let rafId = 0;
  let lastTs = 0;

  const simPercent = computed(() => {
    const total = durationSec.value || 1;
    return Math.min(100, Math.round((simSec.value / total) * 100));
  });

  const currentFrame = computed(() => getFleetFrameAtSec(telemetry.value, simSec.value));

  const phase = computed(() =>
    resolveFleetPhase(simSec.value, durationSec.value, currentFrame.value),
  );

  function tick(ts: number) {
    if (!lastTs) lastTs = ts;
    const deltaSec = (ts - lastTs) / 1000;
    lastTs = ts;

    if (isPlaying.value) {
      const total = durationSec.value || 1;
      simSec.value = Math.min(total, simSec.value + deltaSec * speed.value);
      if (simSec.value >= total) {
        simSec.value = total;
        isPlaying.value = false;
      }
    }

    rafId = window.requestAnimationFrame(tick);
  }

  onMounted(() => {
    rafId = window.requestAnimationFrame(tick);
  });

  onUnmounted(() => {
    window.cancelAnimationFrame(rafId);
  });

  function play() {
    if (simSec.value >= durationSec.value) simSec.value = 0;
    isPlaying.value = true;
    lastTs = 0;
  }

  function pause() {
    isPlaying.value = false;
  }

  function toggle() {
    if (isPlaying.value) {
      pause();
    } else {
      play();
    }
  }

  function reset() {
    simSec.value = 0;
    isPlaying.value = false;
    lastTs = 0;
  }

  function seekPercent(pct: number) {
    const total = durationSec.value || 1;
    simSec.value = Math.max(0, Math.min(total, (pct / 100) * total));
  }

  watch(telemetry, () => {
    reset();
  });

  return {
    isPlaying,
    simSec,
    simPercent,
    speed,
    phase,
    currentFrame,
    play,
    pause,
    toggle,
    reset,
    seekPercent,
  };
}

/** 判断冲突记录是否处于当前仿真时刻附近 */
export function isConflictActive(simSec: number, conflictSimSec: number, windowSec = 4) {
  return Math.abs(simSec - conflictSimSec) <= windowSec;
}

/** 根据 schedule 推断当前阶段标签（侧栏机队状态用） */
export function dronePhaseAtSec(
  scenario: FleetDispatchScenario,
  droneId: string,
  simSec: number,
): string {
  const events = scenario.schedule.filter((e) => e.droneId === droneId);
  for (const ev of events) {
    if (simSec >= ev.startSec && simSec < ev.startSec + ev.durationSec) {
      const map: Record<string, string> = {
        takeoff: '起飞',
        cruise: '巡航',
        hold: '悬停',
        handoff: '交接',
        landing: '降落',
      };
      return map[ev.kind] ?? ev.label;
    }
  }
  if (simSec <= 0) return '待命';
  const last = events.at(-1);
  if (last && simSec >= last.startSec + last.durationSec) return '完成';
  return '排队';
}
