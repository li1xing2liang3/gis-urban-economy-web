import { computed, onMounted, ref, type Ref } from 'vue';
import { gisDataService } from '@/services/gisDataService';
import { getFleetFrameAtSec } from '@/composables/useFleetSimulationPlayback';
import type {
  FleetConflictsFile,
  FleetDispatchScenario,
  FleetRegistryFile,
  FleetScenarioTelemetry,
  FleetTelemetryFile,
} from '@/types/uavFleet';

export function useFleetSimulationData(activeScenarioId: Ref<string>) {
  const loading = ref(true);
  const error = ref<string | null>(null);
  const telemetryMeta = ref<FleetTelemetryFile['meta'] | null>(null);
  const registry = ref<FleetRegistryFile | null>(null);
  const telemetryByScenario = ref<Record<string, FleetScenarioTelemetry>>({});
  const conflictsByScenario = ref<Record<string, FleetConflictsFile['scenarios'][number]>>({});

  onMounted(async () => {
    try {
      const [telemetry, registryFile, conflicts] = await Promise.all([
        gisDataService.getFleetTelemetry(),
        gisDataService.getFleetRegistry(),
        gisDataService.getFleetConflicts(),
      ]);
      telemetryMeta.value = telemetry.meta;
      registry.value = registryFile;
      telemetryByScenario.value = Object.fromEntries(
        telemetry.scenarios.map((item) => [item.scenarioId, item]),
      );
      conflictsByScenario.value = Object.fromEntries(
        conflicts.scenarios.map((item) => [item.scenarioId, item]),
      );
    } catch (err) {
      console.warn('[Fleet] failed to load fleet simulation data', err);
      error.value = '编队遥测/机队/冲突数据加载失败';
    } finally {
      loading.value = false;
    }
  });

  const activeTelemetry = computed(
    () => telemetryByScenario.value[activeScenarioId.value] ?? null,
  );

  const activeConflicts = computed(
    () => conflictsByScenario.value[activeScenarioId.value]?.conflicts ?? [],
  );

  return {
    loading,
    error,
    telemetryMeta,
    registry,
    activeTelemetry,
    activeConflicts,
  };
}

export type FleetSvgProjection = {
  paths: Array<{ color: string; points: string }>;
  drones: Array<{ id: string; x: number; y: number; color: string; label: string; phase?: string }>;
  progressPaths: Array<{ color: string; points: string }>;
};

export function projectFleetTracksToSvg(
  telemetry: FleetScenarioTelemetry | null,
  width = 640,
  height = 360,
  simSec?: number,
): FleetSvgProjection {
  const empty: FleetSvgProjection = { paths: [], drones: [], progressPaths: [] };
  if (!telemetry?.tracks?.length) return empty;

  const points = telemetry.tracks.flatMap((track) =>
    track.samples
      .filter((sample) => sample.phase !== 'ground' && sample.phase !== 'done')
      .map((sample) => ({ lng: sample.lng, lat: sample.lat })),
  );
  if (!points.length) return empty;

  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const pad = 28;

  const project = (lng: number, lat: number) => {
    const xSpan = Math.max(maxLng - minLng, 0.001);
    const ySpan = Math.max(maxLat - minLat, 0.001);
    return {
      x: pad + ((lng - minLng) / xSpan) * (width - pad * 2),
      y: height - pad - ((lat - minLat) / ySpan) * (height - pad * 2),
    };
  };

  const paths = telemetry.tracks.map((track) => ({
    color: track.color,
    points: track.samples
      .filter((sample) => sample.phase !== 'ground' && sample.phase !== 'done')
      .map((sample) => {
        const { x, y } = project(sample.lng, sample.lat);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' '),
  }));

  const progressPaths =
    simSec == null
      ? []
      : telemetry.tracks.map((track) => ({
          color: track.color,
          points: track.samples
            .filter((sample) => sample.simSec <= simSec && sample.phase !== 'ground' && sample.phase !== 'done')
            .map((sample) => {
              const { x, y } = project(sample.lng, sample.lat);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' '),
        }));

  let drones: FleetSvgProjection['drones'];
  if (simSec != null) {
    const frame = getFleetFrameAtSec(telemetry, simSec);
    drones =
      frame?.positions.map((pos) => {
        const { x, y } = project(pos.lng, pos.lat);
        return {
          id: pos.droneId,
          x,
          y,
          color: pos.color,
          label: pos.droneId.replace('WH-UAV-', ''),
          phase: pos.phase,
        };
      }) ?? [];
  } else {
    drones = telemetry.tracks.map((track) => {
      const last =
        [...track.samples].reverse().find((sample) => sample.phase !== 'ground' && sample.phase !== 'done') ??
        track.samples.at(-1)!;
      const { x, y } = project(last.lng, last.lat);
      return {
        id: track.droneId,
        x,
        y,
        color: track.color,
        label: track.droneId.replace('WH-UAV-', ''),
      };
    });
  }

  return { paths, drones, progressPaths };
}

export function enrichScenarioWithRegistry(
  scenario: FleetDispatchScenario,
  registry: FleetRegistryFile | null,
) {
  if (!registry) return scenario;
  const byId = Object.fromEntries(registry.drones.map((drone) => [drone.droneId, drone]));
  return {
    ...scenario,
    drones: scenario.drones.map((drone) => {
      const spec = byId[drone.droneId];
      if (!spec) return drone;
      return {
        ...drone,
        droneName: `${spec.model} · ${drone.droneName.split('·').pop()?.trim() ?? drone.routeName.slice(0, 4)}`,
        batteryPct: Math.min(drone.batteryPct, spec.readinessScore),
      };
    }),
  };
}
