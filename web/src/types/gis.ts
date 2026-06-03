/** 数据来源：智眼 / 无人机 / POI / 多源 */
export type DataProvenance = '智眼' | '无人机' | 'POI' | '多源' | '模型' | '演示';

export type TimeUiMode = 'single' | 'range' | 'play' | 'compareAB';

export type RegionMode = 'all' | 'point' | 'box' | 'admin';

export type BBox = { south: number; west: number; north: number; east: number };

export type RegionState = {
  mode: RegionMode;
  label: string;
  adminName: string;
  point: { lat: number; lng: number } | null;
  box: BBox | null;
};

export type DataSourceId = 'v2026Q1' | 'v2025Q4' | 'demo-mix';

export type AnalysisTaskStatus = 'idle' | 'running' | 'success' | 'error';

export type AnalysisTask = {
  id: string;
  name: string;
  page: string;
  status: AnalysisTaskStatus;
  message?: string;
  errorCode?: string;
  retryCount?: number;
  startedAt?: string;
  finishedAt?: string;
  saved?: boolean;
};

export type VitalityResult = {
  updatedAt: string;
  topic: string;
  topZones: { name: string; score: number; pct: number; uavBoost?: number; districtName?: string; hotspot?: string }[];
  indexMean: number;
  weights: { foot: number; poi: number; acc: number; uav: number; useUav: boolean };
};

export type DistrictSummary = { id: string; name: string; conf: number; flow: string; level: string; poiStr?: string };

export type UavRouteSummary = {
  id: string;
  name: string;
  quality: number;
  district: string;
  zhiyanSync: boolean;
};

export type AppBookmark = {
  id: string;
  name: string;
  at: string;
  timeKey: string;
  regionKey: string;
  dataSource: DataSourceId;
  layerState?: Record<string, { visible: boolean; opacity: number }>;
  note?: string;
};
