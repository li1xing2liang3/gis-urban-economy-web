import { onUnmounted, ref, watch, type Ref } from 'vue';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { FleetScenarioTelemetry } from '@/types/uavFleet';
import { getFleetFrameAtSec } from '@/composables/useFleetSimulationPlayback';

export type FleetLivePosition = {
  lng: number;
  lat: number;
  altitudeM: number;
  color: string;
  phase: string;
};

function makeDroneSvg(color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-36 -36 72 72">
      <circle cx="0" cy="0" r="28" fill="${color}22" stroke="${color}" stroke-width="2"/>
      <g stroke="#e0f2fe" stroke-width="3.4" stroke-linecap="round">
        <line x1="-17" y1="-14" x2="17" y2="14"/>
        <line x1="17" y1="-14" x2="-17" y2="14"/>
      </g>
      <path d="M0-22 8-4 5 17 0 22-5 17-8-4Z" fill="${color}" stroke="#fff7ed" stroke-width="2.5"/>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function boundsFromTelemetry(telemetry: FleetScenarioTelemetry) {
  const pts = telemetry.tracks.flatMap((t) => t.samples.map((s) => [s.lng, s.lat] as const));
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

export function useCesiumUavFleet(
  containerRef: Ref<HTMLElement | null>,
  telemetry: Ref<FleetScenarioTelemetry | null>,
  simSec: Ref<number>,
) {
  const sceneError = ref('');
  const ready = ref(false);

  let viewer: Cesium.Viewer | null = null;
  let routeEntities: Cesium.Entity[] = [];
  let droneEntities: Cesium.Entity[] = [];
  const livePositions = ref<Record<string, FleetLivePosition>>({});

  function dispose() {
    routeEntities = [];
    droneEntities = [];
    livePositions.value = {};
    viewer?.destroy();
    viewer = null;
    ready.value = false;
  }

  function syncLivePositions() {
    const frame = getFleetFrameAtSec(telemetry.value, simSec.value);
    if (!frame) {
      livePositions.value = {};
      return;
    }
    livePositions.value = Object.fromEntries(
      frame.positions.map((p) => [
        p.droneId,
        { lng: p.lng, lat: p.lat, altitudeM: p.altitudeM, color: p.color, phase: p.phase },
      ]),
    );
  }

  function flyToFleet(tele: FleetScenarioTelemetry) {
    if (!viewer) return;
    const b = boundsFromTelemetry(tele);
    const centerLng = (b.minLng + b.maxLng) / 2;
    const centerLat = (b.minLat + b.maxLat) / 2;
    const span = Math.max(b.maxLng - b.minLng, b.maxLat - b.minLat, 0.01);
    const height = 800 + span * 85000;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, height),
      orientation: {
        heading: Cesium.Math.toRadians(25),
        pitch: Cesium.Math.toRadians(-42),
        roll: 0,
      },
    });
  }

  function buildScene(tele: FleetScenarioTelemetry) {
    if (!viewer) return;

    routeEntities.forEach((e) => viewer!.entities.remove(e));
    droneEntities.forEach((e) => viewer!.entities.remove(e));
    routeEntities = [];
    droneEntities = [];

    tele.tracks.forEach((track) => {
      const samples = track.samples.filter((s) => s.phase !== 'ground' && s.phase !== 'done');
      if (samples.length < 2) return;

      const positions = samples.map((s) => Cesium.Cartesian3.fromDegrees(s.lng, s.lat, s.altitudeM));
      const color = Cesium.Color.fromCssColorString(track.color);

      routeEntities.push(
        viewer!.entities.add({
          name: `${track.droneId}-route`,
          polyline: {
            positions,
            width: 3,
            material: new Cesium.PolylineDashMaterialProperty({
              color: color.withAlpha(0.55),
              dashLength: 14,
            }),
          },
        }),
      );

      const droneId = track.droneId;
      const position = new Cesium.CallbackPositionProperty((time, result) => {
        const live = livePositions.value[droneId];
        if (!live) return undefined;
        return Cesium.Cartesian3.fromDegrees(live.lng, live.lat, live.altitudeM, undefined, result);
      }, false);

      droneEntities.push(
        viewer!.entities.add({
          name: droneId,
          position,
          billboard: {
            image: makeDroneSvg(track.color),
            width: 46,
            height: 46,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: droneId.replace('WH-UAV-', ''),
            font: '11px sans-serif',
            fillColor: color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -36),
          },
          path: {
            resolution: 1,
            leadTime: 0,
            trailTime: 12,
            width: 5,
            material: new Cesium.PolylineGlowMaterialProperty({
              color: color.withAlpha(0.85),
              glowPower: 0.18,
            }),
          },
        }),
      );
    });

    syncLivePositions();
    flyToFleet(tele);
    ready.value = true;
  }

  function initViewer() {
    const el = containerRef.value;
    if (!el || viewer) return;

    sceneError.value = '';
    try {
      viewer = new Cesium.Viewer(el, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        vrButton: false,
        infoBox: false,
        selectionIndicator: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });

      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          minimumLevel: 0,
          maximumLevel: 19,
        }),
      );

      if (telemetry.value) buildScene(telemetry.value);
    } catch (err) {
      console.warn('[Fleet Cesium] init failed', err);
      sceneError.value = '三维场景初始化失败，可切换至二维协同视图继续演示。';
      dispose();
    }
  }

  onUnmounted(() => {
    dispose();
  });

  function ensureReady() {
    if (!viewer) initViewer();
    else viewer.resize();
  }

  watch(containerRef, (el) => {
    if (el && !viewer) ensureReady();
  });

  watch(telemetry, (tele) => {
    if (!tele || !viewer) return;
    buildScene(tele);
  });

  watch(simSec, () => {
    syncLivePositions();
  });

  function retry() {
    dispose();
    initViewer();
  }

  return { sceneError, ready, retry, ensureReady };
}
