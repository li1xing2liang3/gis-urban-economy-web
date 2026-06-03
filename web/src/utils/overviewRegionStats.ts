import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import type { BBox, RegionState } from '@/types/gis';
import type { PoiPointProperties } from '@/utils/mockHubeiDataset';

const R_EARTH_M = 6371000;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.sqrt(a));
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-14) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygonGeom(lng: number, lat: number, geom: Polygon): boolean {
  const outer = geom.coordinates[0];
  if (!outer || !pointInRing(lng, lat, outer)) return false;
  for (let h = 1; h < geom.coordinates.length; h++) {
    if (pointInRing(lng, lat, geom.coordinates[h]!)) return false;
  }
  return true;
}

function pointInBBox(lng: number, lat: number, box: BBox): boolean {
  return lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;
}

export function polygonCentroid(geom: Polygon): { lat: number; lng: number } {
  const ring = geom.coordinates[0];
  if (!ring?.length) return { lat: 30.59, lng: 114.31 };
  let lat = 0;
  let lng = 0;
  for (const c of ring) {
    lng += c[0]!;
    lat += c[1]!;
  }
  const n = ring.length;
  return { lat: lat / n, lng: lng / n };
}

/** 行政区是否落在当前顶栏区域筛选内 */
export function districtMatchesRegion(
  districtName: string,
  cityUnits: FeatureCollection | null,
  region: RegionState,
): boolean {
  if (region.mode === 'all' || region.adminName === '武汉市（全市）') return true;
  if (region.mode === 'admin') {
    const key = region.adminName.replace(/武汉市（全市）/, '').trim();
    return (
      region.adminName.includes(districtName) ||
      districtName.includes(key.replace(/区$/, '')) ||
      key.includes(districtName.replace(/区$/, ''))
    );
  }
  const feat = findDistrictFeature(cityUnits, districtName);
  if (!feat?.geometry || feat.geometry.type !== 'Polygon') return true;
  const { lat, lng } = polygonCentroid(feat.geometry);
  if (region.mode === 'point' && region.point) {
    return haversineM(lat, lng, region.point.lat, region.point.lng) <= 2500;
  }
  if (region.mode === 'box' && region.box) {
    return pointInBBox(lng, lat, region.box);
  }
  return true;
}

/** 行政区名 → city-units 要素 */
export function findDistrictFeature(
  cityUnits: FeatureCollection | null,
  adminName: string,
): Feature<Polygon> | null {
  if (!cityUnits?.features?.length) return null;
  const key = adminName.replace(/武汉市（全市）/, '').trim() || adminName;
  for (const f of cityUnits.features) {
    const name = String((f.properties as { name?: string })?.name ?? '');
    if (name === key || adminName.includes(name) || name.includes(key.replace(/区$/, ''))) {
      if (f.geometry?.type === 'Polygon') return f as Feature<Polygon>;
    }
  }
  return null;
}

export function poiMatchesRegion(
  lng: number,
  lat: number,
  props: PoiPointProperties,
  region: RegionState,
  cityUnits: FeatureCollection | null,
): boolean {
  if (region.mode === 'all' || region.adminName === '武汉市（全市）') return true;

  if (region.mode === 'point' && region.point) {
    return haversineM(lat, lng, region.point.lat, region.point.lng) <= 1000;
  }

  if (region.mode === 'box' && region.box) {
    return pointInBBox(lng, lat, region.box);
  }

  if (region.mode === 'admin') {
    const district = findDistrictFeature(cityUnits, region.adminName);
    if (district?.geometry) return pointInPolygonGeom(lng, lat, district.geometry);
    if (props.districtName && region.adminName.includes(String(props.districtName).replace(/区$/, ''))) {
      return true;
    }
    return false;
  }

  return true;
}

export type OverviewRegionKpis = {
  v: number;
  foot: string;
  comm: string;
  poiCount: number;
  inRegion: boolean;
};

export function aggregateRegionKpis(
  poiFeatures: Feature<Point>[],
  region: RegionState,
  cityUnits: FeatureCollection | null,
  uavBoost: boolean,
): OverviewRegionKpis {
  const inRegion = poiFeatures.filter((f) => {
    const [lng, lat] = f.geometry.coordinates;
    return poiMatchesRegion(lng, lat, (f.properties ?? {}) as PoiPointProperties, region, cityUnits);
  });

  const count = inRegion.length;
  if (count === 0) {
    const seed = (region.label + region.mode).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      v: 38 + (seed % 15) + (uavBoost ? 4 : 0),
      foot: '低',
      comm: '0 /km²',
      poiCount: 0,
      inRegion: false,
    };
  }

  const impSum = inRegion.reduce((s, f) => s + Number((f.properties as PoiPointProperties).importance ?? 0.5), 0);
  const avgImp = impSum / count;
  const v = Math.min(100, Math.round(42 + avgImp * 38 + Math.log10(count + 1) * 8 + (uavBoost ? 5 : 0)));
  const foot = v >= 72 ? '高' : v >= 55 ? '中' : '低';
  const areaKm2 = region.mode === 'point' ? Math.PI * 1 * 1 : region.mode === 'box' && region.box
    ? Math.max(0.01, (region.box.north - region.box.south) * 111 * (region.box.east - region.box.west) * 96)
    : 25;
  const comm = (count / Math.max(areaKm2, 0.5)).toFixed(0) + ' /km²';

  return { v, foot, comm, poiCount: count, inRegion: true };
}

export type CityTimeseriesEntry = {
  id: string;
  name: string;
  monthly: Array<{
    month: string;
    vitalityIndex?: number;
    popIndex?: number;
    footTrafficIdx?: number;
    poiActivityIdx?: number;
    trafficReachIdx?: number;
  }>;
};

/** 热点/商圈名 → 行政区（演示映射，用于模型结果定位） */
const ZONE_DISTRICT_HINTS: Array<[RegExp, string]> = [
  [/江汉路|循礼门/, '江汉区'],
  [/武昌|黄鹤楼|徐东|岳家嘴|街道口|滨江/, '武昌区'],
  [/汉阳|钟家村|王家湾/, '汉阳区'],
  [/光谷|武汉东站|南湖/, '洪山区'],
  [/青山|工业更新/, '青山区'],
  [/江岸/, '江岸区'],
  [/硚口/, '硚口区'],
  [/东西湖/, '东西湖区'],
  [/蔡甸/, '蔡甸区'],
  [/江夏/, '江夏区'],
];

/** 热点名或行政区名 → 可定位的行政区全称 */
export function resolveZoneDistrictName(zoneName: string, cityUnits: FeatureCollection | null): string {
  const direct = findDistrictFeature(cityUnits, zoneName);
  if (direct) {
    return String((direct.properties as { name?: string })?.name ?? zoneName);
  }
  for (const [re, district] of ZONE_DISTRICT_HINTS) {
    if (re.test(zoneName)) return district;
  }
  return zoneName;
}

function findCityEntry(cities: CityTimeseriesEntry[], districtName: string | null): CityTimeseriesEntry | undefined {
  if (!districtName || districtName === '全市' || districtName.includes('全市')) return undefined;
  return cities.find((c) => districtName.includes(c.name) || c.name.includes(districtName.replace(/区$/, '')));
}

export function factorAtMonth(
  cities: CityTimeseriesEntry[],
  districtName: string | null,
  month: string,
  key: 'vitalityIndex' | 'footTrafficIdx' | 'poiActivityIdx' | 'trafficReachIdx',
): number | null {
  if (!month) return null;
  const normalized = month.length === 10 ? month.slice(0, 7) : month;
  if (!districtName || districtName === '全市' || districtName.includes('全市')) {
    const all: number[] = [];
    for (const c of cities) {
      const row = c.monthly.find((m) => m.month === normalized);
      const v = row?.[key];
      if (v != null) all.push(v);
    }
    return all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : null;
  }
  const city = findCityEntry(cities, districtName);
  const row = city?.monthly.find((m) => m.month === normalized);
  const v = row?.[key];
  return v != null ? v : null;
}

export function vitalityAtMonth(
  cities: CityTimeseriesEntry[],
  districtName: string | null,
  month: string,
): number | null {
  return factorAtMonth(cities, districtName, month, 'vitalityIndex');
}
