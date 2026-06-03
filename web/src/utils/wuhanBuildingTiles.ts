import type { FeatureCollection, Polygon } from 'geojson';

export type BuildingDetailLevel = 'low' | 'mid' | 'high';

export type WuhanBuildingTileMeta = {
  id: string;
  row: number;
  col: number;
  bounds: [[number, number], [number, number]];
};

export type WuhanBuildingManifest = {
  bbox: [number, number, number, number];
  cols: number;
  rows: number;
  levels: Record<
    BuildingDetailLevel,
    { minZoom: number; maxZoom: number; toleranceDeg: number | null }
  >;
  tiles: WuhanBuildingTileMeta[];
};

const MANIFEST_URL = '/geo/wuhan/buildings/manifest.json';
const tileCache = new Map<string, FeatureCollection<Polygon>>();

let manifestPromise: Promise<WuhanBuildingManifest | null> | null = null;

export async function loadWuhanBuildingManifest(): Promise<WuhanBuildingManifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then((res) => (res.ok ? (res.json() as Promise<WuhanBuildingManifest>) : null))
      .catch(() => null);
  }
  return manifestPromise;
}

export function detailLevelForZoom(zoom: number): BuildingDetailLevel | null {
  if (zoom >= 16) return 'high';
  if (zoom >= 14) return 'mid';
  if (zoom >= 12) return 'low';
  return null;
}

function boundsIntersect(
  a: { south: number; west: number; north: number; east: number },
  b: [[number, number], [number, number]],
): boolean {
  const [sw, ne] = b;
  const south = sw[0];
  const west = sw[1];
  const north = ne[0];
  const east = ne[1];
  return !(a.east < west || a.west > east || a.north < south || a.south > north);
}

export function tilesForViewport(
  manifest: WuhanBuildingManifest,
  bounds: { south: number; west: number; north: number; east: number },
): WuhanBuildingTileMeta[] {
  return manifest.tiles.filter((t) => boundsIntersect(bounds, t.bounds));
}

export async function fetchBuildingTile(
  level: BuildingDetailLevel,
  tileId: string,
): Promise<FeatureCollection<Polygon> | null> {
  const key = `${level}:${tileId}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const res = await fetch(`/geo/wuhan/buildings/${level}/${tileId}.geojson`);
  if (!res.ok) return null;
  const fc = (await res.json()) as FeatureCollection<Polygon>;
  if (fc?.type === 'FeatureCollection' && Array.isArray(fc.features)) {
    tileCache.set(key, fc);
    return fc;
  }
  return null;
}

export function clearBuildingTileCache() {
  tileCache.clear();
  manifestPromise = null;
}
