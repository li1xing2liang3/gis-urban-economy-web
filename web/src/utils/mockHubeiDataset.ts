/** 与 `web/public/data/mock/hubei/` 下静态文件对应（由 scripts/generate-hubei-mock-datasets.mjs 生成） */

export function mockHubeiDataPrefix(): string {
  const base = import.meta.env.BASE_URL || '/';
  const p = base.endsWith('/') ? base : `${base}/`;
  return `${p}data/mock/hubei/`;
}

/** 活力指数 0–100 → 填充色（冷蓝→暖橙） */
export function vitalityFillColor(idx: number): string {
  const v = Math.max(0, Math.min(100, idx));
  const t = v / 100;
  const r = Math.round(29 + t * 216);
  const g = Math.round(155 + t * 11);
  const b = Math.round(245 - t * 210);
  return `rgb(${r},${g},${b})`;
}

/** 人口密度示意 → 紫系深浅 */
export function popDensityFillColor(val: number, lo: number, hi: number): string {
  const span = Math.max(hi - lo, 1);
  const t = Math.max(0, Math.min(1, (val - lo) / span));
  const r = Math.round(88 + t * 120);
  const g = Math.round(28 + t * 80);
  const b = Math.round(180 + t * 55);
  return `rgb(${r},${g},${b})`;
}

/** 消费潜力 0–100 → 青绿系 */
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

export const POI_CATEGORY_LEGEND: { key: string; label: string }[] = [
  { key: 'retail', label: '零售' },
  { key: 'food', label: '餐饮' },
  { key: 'office', label: '办公' },
  { key: 'life', label: '生活' },
  { key: 'culture', label: '文体' },
  { key: 'hotel', label: '住宿' },
  { key: 'finance', label: '金融' },
];

export type ProvinceMonthlyRow = {
  month: string;
  popIndex: number;
  econIndex: number;
  vitalityIndex: number;
  nightEconomyIndex?: number;
  consumeIndex?: number;
  trafficIndex?: number;
};

export type ProvinceTimeseriesFile = {
  monthly: ProvinceMonthlyRow[];
  meta?: Record<string, unknown>;
};
