import type { Feature, Point } from 'geojson';

export type PoiCluster = {
  id: string;
  name: string;
  center: [number, number];
  ring: [number, number][];
  poiCount: number;
  dominantCategories: string[];
  confidence: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  retail: '零售',
  food: '餐饮',
  office: '办公',
  life: '生活',
  culture: '文体',
  hotel: '住宿',
  finance: '金融',
};

/** 与 api-fixtures 模型商圈名一致的示意锚点（EPSG:4326，lat/lng） */
export const MODEL_DISTRICT_ANCHORS: Record<string, [number, number]> = {
  '江汉路-循礼门商圈': [30.582, 114.285],
  '光谷-武汉东站商圈': [30.507, 114.399],
  '武昌滨江文旅商圈': [30.548, 114.297],
  '汉阳钟家村-王家湾': [30.549, 114.254],
  '徐东-岳家嘴商务圈': [30.592, 114.348],
  '街道口-广埠屯': [30.528, 114.352],
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function anchorRing(lat: number, lng: number, pad = 0.004): [number, number][] {
  return [
    [lat - pad, lng - pad],
    [lat + pad, lng - pad],
    [lat + pad, lng + pad],
    [lat - pad, lng + pad],
  ];
}

export type DistrictZoneSummary = {
  id: string;
  name: string;
  conf: number;
  flow: string;
  level: string;
  poiStr?: string;
};

/** 按锚点距离将 POI 聚类与后端/mock 模型商圈对齐（避免按序号硬套） */
export function mergeClustersWithModel(
  clusters: PoiCluster[],
  modelRows: DistrictZoneSummary[],
  opts: { minPoi: number; maxMatchKm?: number },
): { clusters: PoiCluster[]; summaries: DistrictZoneSummary[] } {
  if (!modelRows.length) {
    return { clusters, summaries: clustersToSummaries(clusters) };
  }

  const maxKm = opts.maxMatchKm ?? 4.5;
  const used = new Set<number>();
  const mergedClusters: PoiCluster[] = [];
  const summaries: DistrictZoneSummary[] = [];

  for (const m of modelRows) {
    const anchor = MODEL_DISTRICT_ANCHORS[m.name];
    let bestIdx = -1;
    let bestD = Infinity;
    clusters.forEach((c, i) => {
      if (used.has(i)) return;
      const refLat = anchor?.[0] ?? c.center[0];
      const refLng = anchor?.[1] ?? c.center[1];
      const d = haversineKm(c.center[0], c.center[1], refLat, refLng);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    });

    if (bestIdx >= 0 && bestD <= maxKm) {
      used.add(bestIdx);
      const c = clusters[bestIdx]!;
      mergedClusters.push({ ...c, id: m.id, name: m.name, confidence: m.conf });
      summaries.push({
        ...m,
        poiStr: m.poiStr ?? c.dominantCategories.join('、'),
      });
    } else if (anchor) {
      mergedClusters.push({
        id: m.id,
        name: m.name,
        center: anchor,
        ring: anchorRing(anchor[0], anchor[1]),
        poiCount: opts.minPoi,
        dominantCategories: m.poiStr?.split('、').filter(Boolean) ?? [],
        confidence: m.conf,
      });
      summaries.push(m);
    } else {
      summaries.push(m);
    }
  }

  clusters.forEach((c, i) => {
    if (used.has(i)) return;
    mergedClusters.push(c);
    summaries.push(...clustersToSummaries([c]));
  });

  return { clusters: mergedClusters, summaries };
}

function cellKey(lat: number, lng: number, cellDeg: number): string {
  const gy = Math.floor(lat / cellDeg);
  const gx = Math.floor(lng / cellDeg);
  return `${gy}:${gx}`;
}

function ringFromPoints(pts: [number, number][], padDeg: number): [number, number][] {
  if (!pts.length) return [];
  let minLat = pts[0][0];
  let maxLat = pts[0][0];
  let minLng = pts[0][1];
  let maxLng = pts[0][1];
  for (const [la, lo] of pts) {
    minLat = Math.min(minLat, la);
    maxLat = Math.max(maxLat, la);
    minLng = Math.min(minLng, lo);
    maxLng = Math.max(maxLng, lo);
  }
  const p = Math.max(padDeg, 0.0015);
  return [
    [minLat - p, minLng - p],
    [maxLat + p, minLng - p],
    [maxLat + p, maxLng + p],
    [minLat - p, maxLng + p],
  ];
}

/** 基于 POI 网格聚类生成商圈面（演示级，参数与侧栏阈值联动） */
export function clusterPoisToDistricts(
  features: Feature<Point>[],
  options: { threshold: number; minPoi: number; categoryKeys: Set<string> },
): PoiCluster[] {
  const filtered = features.filter((f) =>
    options.categoryKeys.has(String(f.properties?.categoryKey ?? '')),
  );
  if (!filtered.length) return [];

  const cellDeg = 0.002 + (21 - Math.min(20, Math.max(1, options.threshold))) * 0.00035;
  const buckets = new Map<
    string,
    { pts: [number, number][]; cats: Record<string, number>; names: string[] }
  >();

  for (const f of filtered) {
    const [lng, lat] = f.geometry.coordinates;
    const key = cellKey(lat, lng, cellDeg);
    const cat = String(f.properties?.categoryKey ?? '');
    const bucket = buckets.get(key) ?? { pts: [], cats: {}, names: [] };
    bucket.pts.push([lat, lng]);
    bucket.cats[cat] = (bucket.cats[cat] ?? 0) + 1;
    const nm = String(f.properties?.name ?? '');
    if (nm) bucket.names.push(nm);
    buckets.set(key, bucket);
  }

  const clusters: PoiCluster[] = [];
  let idx = 0;
  for (const bucket of buckets.values()) {
    if (bucket.pts.length < options.minPoi) continue;
    idx += 1;
    const centerLat = bucket.pts.reduce((s, p) => s + p[0], 0) / bucket.pts.length;
    const centerLng = bucket.pts.reduce((s, p) => s + p[1], 0) / bucket.pts.length;
    const sortedCats = Object.entries(bucket.cats).sort((a, b) => b[1] - a[1]);
    const dominantCategories = sortedCats.slice(0, 3).map(([k]) => CATEGORY_LABEL[k] ?? k);
    const label = dominantCategories[0] ?? '综合';
    const sample = bucket.names.find((n) => n.length >= 2)?.slice(0, 6) ?? `簇${idx}`;
    const name = `${sample}${label}商圈`;
    const density = Math.min(1, bucket.pts.length / (options.minPoi * 3));
    clusters.push({
      id: String(idx),
      name,
      center: [centerLat, centerLng],
      ring: ringFromPoints(bucket.pts, cellDeg * 0.6),
      poiCount: bucket.pts.length,
      dominantCategories,
      confidence: Math.min(0.99, 0.72 + density * 0.22),
    });
  }

  return clusters.sort((a, b) => b.poiCount - a.poiCount).slice(0, 8);
}

export function clustersToSummaries(clusters: PoiCluster[]): DistrictZoneSummary[] {
  return clusters.map((c, i) => ({
    id: c.id,
    name: c.name,
    conf: c.confidence,
    flow: c.poiCount >= 20 ? '高' : c.poiCount >= 10 ? '中' : '低',
    level: i === 0 ? '核心' : i < 3 ? '次核心' : '识别',
    poiStr: c.dominantCategories.join('、'),
  }));
}
