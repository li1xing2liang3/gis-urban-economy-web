/** 武汉 DEM 山体阴影（由 data/geospatial/WuHanDEM 转换，见 npm run prepare:wuhan-dem） */

export type WuhanHillshadeMeta = {
  source: string;
  width: number;
  height: number;
  /** Leaflet bounds: [[south, west], [north, east]] */
  bounds: [[number, number], [number, number]];
  crs: string;
  generatedAt: string;
};

export const WUHAN_HILLSHADE_URL = '/geo/wuhan/hillshade.png';
export const WUHAN_HILLSHADE_META_URL = '/geo/wuhan/hillshade.meta.json';

export async function loadWuhanHillshadeMeta(): Promise<WuhanHillshadeMeta | null> {
  try {
    const res = await fetch(WUHAN_HILLSHADE_META_URL);
    if (!res.ok) return null;
    return (await res.json()) as WuhanHillshadeMeta;
  } catch {
    return null;
  }
}
