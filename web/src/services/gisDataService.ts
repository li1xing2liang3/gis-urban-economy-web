import type { Feature, FeatureCollection, LineString } from 'geojson';
import type { ProvinceTimeseriesFile } from '@/utils/mockHubeiDataset';

export type ApiHealth = {
  ok: boolean;
  service: string;
  time: string;
};

export type UavRoute = {
  id: string;
  name: string;
  district: string;
  scene: string;
  status: string;
  time: string;
  altitude: number;
  speed: number;
  res: string;
  quality: number;
  zhiyanSync: boolean;
  model: boolean;
  overlay: boolean;
  waypoints: [number, number][];
  imageUrl?: string;
  imageTitle?: string;
  imageCredit?: string;
  imageLicense?: string;
  imageSource?: string;
};

export type UavRoutesFile = {
  routes: UavRoute[];
};

export type DataSourceMeta = {
  id: string;
  label: string;
  description?: string;
  isActive?: boolean;
};

export type LayerCatalogMeta = {
  id: string;
  name: string;
  dataSource: string;
  tableName?: string;
  geomType?: string;
  metric?: string;
  ruleText?: string;
  unit?: string;
  sortOrder?: number;
};

export type ModelRunPayload = Record<string, unknown>;
export type ModelRunResult = Record<string, unknown>;

export type VitalityModelResult = ModelRunResult & {
  id?: string;
  taskType?: string;
  status?: string;
  result?: {
    indexMean?: number;
    topZones?: Array<{ name?: string; districtName?: string; hotspot?: string; score?: number; uavBoost?: number }>;
    explanation?: string;
  };
  createdAt?: string;
  finishedAt?: string;
};

export type DistrictModelDistrict = {
  id?: string;
  name?: string;
  confidence?: number;
  dominantCategories?: string[];
  flowLevel?: string;
  vitalityLevel?: string;
  uavEvidence?: string;
};

export type DistrictModelResult = ModelRunResult & {
  id?: string;
  taskType?: string;
  status?: string;
  districts?: DistrictModelDistrict[];
  createdAt?: string;
  finishedAt?: string;
};

type UavRouteProperties = {
  id?: unknown;
  name?: unknown;
  district?: unknown;
  scene?: unknown;
  status?: unknown;
  time?: unknown;
  altitude?: unknown;
  speed?: unknown;
  resolution?: unknown;
  res?: unknown;
  quality?: unknown;
  zhiyanSync?: unknown;
  participatesModel?: unknown;
  model?: unknown;
  overlay?: unknown;
  imageUrl?: unknown;
  imageTitle?: unknown;
  imageCredit?: unknown;
  imageLicense?: unknown;
  imageSource?: unknown;
};

const uavImageDefaults: Record<string, Pick<UavRoute, 'imageUrl' | 'imageTitle' | 'imageCredit' | 'imageLicense' | 'imageSource'>> = {
  'route-jianghan-night': {
    imageUrl: '/data/uav-images/wuhan-night-aerial.jpg',
    imageTitle: '武汉城市夜景航拍',
    imageCredit: 'Wikimedia Commons',
    imageLicense: 'Commons 许可，项目演示引用',
    imageSource: 'https://commons.wikimedia.org/wiki/File:20231209_Aerial_night_view_of_Wuhan.jpg',
  },
  'route-optics-valley': {
    imageUrl: '/data/uav-images/wuhan-east-station-preview.jpg',
    imageTitle: '武汉东站片区高清航拍',
    imageCredit: 'Wikimedia Commons 公开共享图像',
    imageLicense: 'Commons 许可，项目演示引用',
    imageSource: 'https://commons.wikimedia.org/wiki/File:%E6%AD%A6%E6%B1%89%E4%B8%9C%E7%AB%99%E4%B8%9C%E5%B9%BF%E5%9C%BA.png',
  },
  'route-river-crossing': {
    imageUrl: '/data/uav-images/wuhan-yangtze-bridge-preview.jpg',
    imageTitle: '武汉长江大桥航拍',
    imageCredit: 'Wikimedia Commons 公开共享图像',
    imageLicense: 'Commons 许可，项目演示引用',
    imageSource:
      'https://commons.wikimedia.org/wiki/File:%E5%A4%8F%E5%AD%A3%E7%9A%84%E6%AD%A6%E6%B1%89%E9%95%BF%E6%B1%9F%E5%A4%A7%E6%A1%A5.png',
  },
};

const uavPreviewImageUrl: Record<string, string> = {
  '/data/uav-images/hankou-dazhimen-hd.png': '/data/uav-images/hankou-dazhimen-preview.jpg',
  '/data/uav-images/wuhan-east-station-hd.png': '/data/uav-images/wuhan-east-station-preview.jpg',
  '/data/uav-images/wuhan-yangtze-bridge-hd.png': '/data/uav-images/wuhan-yangtze-bridge-preview.jpg',
  '/data/uav-images/wuhan-gymnasium-hd.png': '/data/uav-images/wuhan-gymnasium-preview.jpg',
};

function previewImageUrl(value: unknown, fallback?: string): string | undefined {
  if (typeof value !== 'string') return fallback;
  return uavPreviewImageUrl[value] ?? value;
}

const hubeiMockBase = () => {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}data/mock/hubei/`;
};

const apiBase = () => {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!raw) return '/api';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function fetchMock<T>(path: string): Promise<T> {
  return fetchJson<T>(`${hubeiMockBase()}${path}`);
}

async function fetchApi<T>(path: string, fallback: () => Promise<T>, init?: RequestInit): Promise<T> {
  const base = apiBase();
  if (!base) return fallback();
  const normalizedPath = path.startsWith('/api/') && base.endsWith('/api') ? path.slice(4) : path;
  try {
    return await fetchJson<T>(`${base}${normalizedPath}`, init);
  } catch (err) {
    console.warn(`[GIS API] ${path} failed; fallback to mock`, err);
    return fallback();
  }
}

async function postApi<T>(path: string, payload: ModelRunPayload, fallback: () => Promise<T>): Promise<T> {
  return fetchApi<T>(path, fallback, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function fetchBackendFixture<T>(key: string): Promise<T> {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const fixtures = await fetchJson<{ endpoints: Record<string, T> }>(`${prefix}data/mock/hubei/api-fixtures.json`);
  const value = fixtures.endpoints[key];
  if (!value) throw new Error(`Missing fixture: ${key}`);
  return value;
}

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return Boolean(value && typeof value === 'object' && (value as FeatureCollection).type === 'FeatureCollection');
}

function isUavRoutesFile(value: unknown): value is UavRoutesFile {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as UavRoutesFile).routes));
}

function uavFeatureToRoute(feature: Feature<LineString, UavRouteProperties>): UavRoute {
  const p = feature.properties ?? {};
  const waypoints = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  const id = String(p.id ?? feature.id ?? 'uav-route');
  const defaults = uavImageDefaults[id];

  return {
    id,
    name: String(p.name ?? '未命名无人机航线'),
    district: String(p.district ?? '武汉重点区域'),
    scene: String(p.scene ?? '低空巡航'),
    status: String(p.status ?? '演示'),
    time: String(p.time ?? ''),
    altitude: Number(p.altitude ?? 120),
    speed: Number(p.speed ?? 8),
    res: String(p.res ?? p.resolution ?? '5 cm'),
    quality: Number(p.quality ?? 80),
    zhiyanSync: Boolean(p.zhiyanSync),
    model: Boolean(p.model ?? p.participatesModel),
    overlay: Boolean(p.overlay ?? true),
    waypoints,
    imageUrl: previewImageUrl(p.imageUrl, defaults?.imageUrl),
    imageTitle: typeof p.imageTitle === 'string' ? p.imageTitle : defaults?.imageTitle,
    imageCredit: typeof p.imageCredit === 'string' ? p.imageCredit : defaults?.imageCredit,
    imageLicense: typeof p.imageLicense === 'string' ? p.imageLicense : defaults?.imageLicense,
    imageSource: typeof p.imageSource === 'string' ? p.imageSource : defaults?.imageSource,
  };
}

function withUavImageDefaults(route: UavRoute): UavRoute {
  const defaults = uavImageDefaults[route.id];
  const imageUrl = previewImageUrl(route.imageUrl, defaults?.imageUrl);
  if (!defaults) return { ...route, imageUrl };
  return { ...defaults, ...route, imageUrl };
}

function normalizeUavRoutes(value: unknown): UavRoutesFile {
  if (isUavRoutesFile(value)) return { routes: value.routes.map(withUavImageDefaults) };
  if (isFeatureCollection(value)) {
    return {
      routes: value.features
        .filter((feature): feature is Feature<LineString, UavRouteProperties> => feature.geometry?.type === 'LineString')
        .map(uavFeatureToRoute),
    };
  }
  throw new Error('Unsupported UAV routes response format');
}

async function fallbackUavRoutes(): Promise<UavRoutesFile> {
  try {
    const geojson = await fetchBackendFixture<FeatureCollection>('GET /api/v1/hubei/uav/routes?ds=v2026Q1');
    return normalizeUavRoutes(geojson);
  } catch {
    return fetchMock<UavRoutesFile>('uav-routes.json');
  }
}

async function fallbackModelRun(key: string, payload: ModelRunPayload, prefix: string): Promise<ModelRunResult> {
  const latest = await fetchBackendFixture<ModelRunResult>(key);
  return {
    ...latest,
    id: `${prefix}-local-${Date.now()}`,
    params: {
      ...((latest.params as Record<string, unknown> | undefined) ?? {}),
      ...payload,
    },
    createdAt: new Date().toISOString(),
  };
}

export const gisDataService = {
  getHealth(): Promise<ApiHealth> {
    return fetchApi<ApiHealth>('/api/v1/health', async () => ({
      ok: false,
      service: 'static-fallback',
      time: new Date().toISOString(),
    }));
  },

  getCityUnits(): Promise<FeatureCollection> {
    return fetchApi<FeatureCollection>('/api/v1/hubei/geo/city-units?ds=v2026Q1', () =>
      fetchMock<FeatureCollection>('city-units.geojson'),
    );
  },

  getVitalityGrid(): Promise<FeatureCollection> {
    return fetchApi<FeatureCollection>('/api/v1/hubei/geo/vitality-grid?ds=v2026Q1', () =>
      fetchMock<FeatureCollection>('vitality-grid.geojson'),
    );
  },

  getPoiSample(): Promise<FeatureCollection> {
    return fetchApi<FeatureCollection>('/api/v1/hubei/poi/sample?ds=v2026Q1', () =>
      fetchMock<FeatureCollection>('poi-sample.geojson'),
    );
  },

  getPoiInfluence(): Promise<FeatureCollection> {
    return fetchApi<FeatureCollection>('/api/v1/hubei/poi/influence?ds=v2026Q1', () =>
      fetchMock<FeatureCollection>('poi-influence.geojson'),
    );
  },

  getProvinceTimeseries(): Promise<ProvinceTimeseriesFile> {
    return fetchApi<ProvinceTimeseriesFile>('/api/v1/hubei/timeseries/province?ds=v2026Q1', () =>
      fetchMock<ProvinceTimeseriesFile>('timeseries-province.json'),
    );
  },

  /** @deprecated 兼容旧调用，等同 getProvinceTimeseries */
  getWuhanTimeseries(): Promise<ProvinceTimeseriesFile> {
    return this.getProvinceTimeseries();
  },

  getCityTimeseries(): Promise<unknown> {
    return fetchApi<unknown>('/api/v1/hubei/timeseries/cities?ds=v2026Q1', () =>
      fetchMock<unknown>('timeseries-cities.json'),
    );
  },

  async getUavRoutes(): Promise<UavRoutesFile> {
    const value = await fetchApi<unknown>('/api/v1/hubei/uav/routes?ds=v2026Q1', fallbackUavRoutes);
    return normalizeUavRoutes(value);
  },

  getUavCoverages(): Promise<FeatureCollection> {
    return fetchApi<FeatureCollection>('/api/v1/hubei/uav/coverages?ds=v2026Q1', () =>
      fetchBackendFixture<FeatureCollection>('GET /api/v1/hubei/uav/coverages?ds=v2026Q1'),
    );
  },

  getZhiyanObservations(): Promise<FeatureCollection> {
    return fetchApi<FeatureCollection>('/api/v1/hubei/sensing/zhiyan-observations?ds=v2026Q1&date=2026-04-08', () =>
      fetchBackendFixture<FeatureCollection>('GET /api/v1/hubei/sensing/zhiyan-observations?ds=v2026Q1&date=2026-04-08'),
    );
  },

  getDataSources(): Promise<DataSourceMeta[]> {
    return fetchApi<DataSourceMeta[]>('/api/v1/hubei/metadata/data-sources', () =>
      fetchBackendFixture<DataSourceMeta[]>('GET /api/v1/hubei/metadata/data-sources'),
    );
  },

  getLayerCatalog(): Promise<LayerCatalogMeta[]> {
    return fetchApi<LayerCatalogMeta[]>('/api/v1/hubei/metadata/layers', () =>
      fetchBackendFixture<LayerCatalogMeta[]>('GET /api/v1/hubei/metadata/layers'),
    );
  },

  getLatestVitalityModel(): Promise<VitalityModelResult> {
    return fetchApi<VitalityModelResult>('/api/v1/hubei/models/vitality/latest', () =>
      fetchBackendFixture<VitalityModelResult>('GET /api/v1/hubei/models/vitality/latest'),
    );
  },

  getLatestDistrictModel(): Promise<DistrictModelResult> {
    return fetchApi<DistrictModelResult>('/api/v1/hubei/models/districts/latest', () =>
      fetchBackendFixture<DistrictModelResult>('GET /api/v1/hubei/models/districts/latest'),
    );
  },

  runVitalityModel(payload: ModelRunPayload): Promise<VitalityModelResult> {
    return postApi<VitalityModelResult>('/api/v1/hubei/models/vitality/run', payload, () =>
      fallbackModelRun('GET /api/v1/hubei/models/vitality/latest', payload, 'vitality') as Promise<VitalityModelResult>,
    );
  },

  runDistrictModel(payload: ModelRunPayload): Promise<DistrictModelResult> {
    return postApi<DistrictModelResult>('/api/v1/hubei/models/districts/run', payload, () =>
      fallbackModelRun('GET /api/v1/hubei/models/districts/latest', payload, 'district') as Promise<DistrictModelResult>,
    );
  },
};
