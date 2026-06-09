/** 多无人机协同调度 — 类型定义（后续实现复用） */

export type FleetDroneStatus = 'idle' | 'queued' | 'airborne' | 'holding' | 'landing' | 'done';

export type FleetCoordinationRule = {
  id: string;
  label: string;
  description: string;
  /** 演示用：是否在当前方案中启用 */
  enabled: boolean;
};

export type FleetScheduleEvent = {
  id: string;
  droneId: string;
  label: string;
  /** 相对仿真起点偏移（秒） */
  startSec: number;
  /** 持续时长（秒） */
  durationSec: number;
  kind: 'takeoff' | 'cruise' | 'hold' | 'handoff' | 'landing';
};

export type FleetDroneAssignment = {
  droneId: string;
  droneName: string;
  routeId: string;
  routeName: string;
  district: string;
  takeoffSiteId?: string;
  /** 起飞相对偏移（秒），用于错峰调度 */
  startOffsetSec: number;
  /** 巡航高度层（米），用于垂直间隔 */
  altitudeLayerM: number;
  color: string;
  status: FleetDroneStatus;
  batteryPct: number;
};

export type FleetDispatchScenario = {
  id: string;
  name: string;
  summary: string;
  district: string;
  /** 协同策略标签 */
  strategy: string;
  droneCount: number;
  /** 预计总时长（秒） */
  durationSec: number;
  /** 关联现有 uav-routes 中的 routeId */
  routeIds: string[];
  drones: FleetDroneAssignment[];
  schedule: FleetScheduleEvent[];
  rules: FleetCoordinationRule[];
  /** 演示指标 */
  metrics: {
    coverageKm2: number;
    conflictResolved: number;
    avgSeparationM: number;
  };
};

export type FleetSimulationPhase = 'idle' | 'planning' | 'dispatching' | 'coordinating' | 'completed';

export type FleetDispatchPlanFile = {
  meta: {
    scope: string;
    version: string;
    generatedAt?: string;
    source: string;
    note?: string;
  };
  scenarios: FleetDispatchScenario[];
};

export type FleetDroneRegistryEntry = {
  droneId: string;
  model: string;
  vendor: string;
  maxFlightMin: number;
  maxSpeedMps: number;
  defaultTakeoffSiteId: string;
  payloads: string[];
  readinessScore: number;
  status: 'available' | 'maintenance' | 'airborne';
};

export type FleetRegistryFile = {
  meta: {
    scope: string;
    version: string;
    generatedAt?: string;
    source: string;
  };
  drones: FleetDroneRegistryEntry[];
};

export type FleetTelemetrySample = {
  simSec: number;
  ts: string;
  phase: 'ground' | 'takeoff' | 'airborne' | 'holding' | 'landing' | 'handoff' | 'done';
  lng: number;
  lat: number;
  altitudeM: number;
  speedMps: number;
  headingDeg: number;
  batteryPct: number;
  signalPct: number;
  riskScore: number;
};

export type FleetDroneTrack = {
  droneId: string;
  routeId: string;
  color: string;
  startOffsetSec: number;
  takeoffSiteId?: string;
  samples: FleetTelemetrySample[];
};

export type FleetSyncFrame = {
  simSec: number;
  activeCount: number;
  positions: Array<{
    droneId: string;
    color: string;
    lng: number;
    lat: number;
    altitudeM: number;
    phase: FleetTelemetrySample['phase'];
  }>;
};

export type FleetScenarioTelemetry = {
  scenarioId: string;
  durationSec: number;
  simulationStart: string;
  sampleIntervalSec: number;
  tracks: FleetDroneTrack[];
  frames: FleetSyncFrame[];
};

export type FleetTelemetryFile = {
  meta: {
    scope: string;
    version: string;
    generatedAt?: string;
    source: string;
    sampleIntervalSec: number;
    note?: string;
  };
  scenarios: FleetScenarioTelemetry[];
};

export type FleetConflictRecord = {
  id: string;
  simSec: number;
  droneIds: [string, string];
  conflictType: 'time' | 'altitude' | 'corridor';
  minSeparationM: number;
  resolvedBy: string;
  resolution: string;
};

export type FleetConflictsFile = {
  meta: {
    scope: string;
    version: string;
    generatedAt?: string;
    source: string;
  };
  scenarios: Array<{
    scenarioId: string;
    conflicts: FleetConflictRecord[];
  }>;
};
