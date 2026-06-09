/** 与 `web/public/data/mock/wuhan/` 下武汉专题静态文件对应。 */

export type WuhanMonthlyRow = {
  month: string;
  popIndex: number;
  econIndex: number;
  vitalityIndex: number;
  nightEconomyIndex?: number;
  consumeIndex?: number;
  trafficIndex?: number;
};

export type WuhanTimeseriesFile = {
  monthly: WuhanMonthlyRow[];
  meta?: Record<string, unknown>;
};

export function mockWuhanDataPrefix(): string {
  const base = import.meta.env.BASE_URL || '/';
  const p = base.endsWith('/') ? base : `${base}/`;
  return `${p}data/mock/wuhan/`;
}

export function vitalityFillColor(idx: number): string {
  const v = Math.max(0, Math.min(100, idx));
  const t = v / 100;
  const r = Math.round(29 + t * 216);
  const g = Math.round(155 + t * 11);
  const b = Math.round(245 - t * 210);
  return `rgb(${r},${g},${b})`;
}

export function popDensityFillColor(val: number, lo: number, hi: number): string {
  const span = Math.max(hi - lo, 1);
  const t = Math.max(0, Math.min(1, (val - lo) / span));
  const r = Math.round(88 + t * 120);
  const g = Math.round(28 + t * 80);
  const b = Math.round(180 + t * 55);
  return `rgb(${r},${g},${b})`;
}

export function consumePotentialFillColor(idx: number): string {
  const v = Math.max(0, Math.min(100, idx));
  const t = v / 100;
  const r = Math.round(16 + t * 40);
  const g = Math.round(185 + t * 45);
  const b = Math.round(129 + t * 40);
  return `rgb(${r},${g},${b})`;
}

const POI_PALETTE: Record<string, string> = {
  retail: '#f472b6',
  food: '#fb923c',
  office: '#60a5fa',
  life: '#a78bfa',
  culture: '#34d399',
  hotel: '#fbbf24',
  finance: '#94a3b8',
};

export function poiCategoryColor(categoryKey: string): string {
  return POI_PALETTE[categoryKey] ?? '#f5a623';
}

export type PoiPointProperties = {
  poiId?: string;
  name?: string;
  categoryKey?: string;
  category?: string;
  cityName?: string;
  districtName?: string;
  importance?: number;
  influenceRadiusKm?: number;
  influenceRadiusM?: number;
  influenceBasis?: string;
  influenceRing?: string;
};

export function poiInfluenceRadiusM(props: PoiPointProperties): number {
  if (props.influenceRadiusM != null && props.influenceRadiusM > 0) return props.influenceRadiusM;
  const km = props.influenceRadiusKm ?? 0.4;
  return Math.round(km * 1000);
}

export const POI_CATEGORY_LEGEND: { key: string; label: string }[] = [
  { key: 'retail', label: '零售' },
  { key: 'food', label: '餐饮' },
  { key: 'office', label: '办公' },
  { key: 'life', label: '生活' },
  { key: 'culture', label: '文旅' },
  { key: 'hotel', label: '住宿' },
  { key: 'finance', label: '金融' },
];
