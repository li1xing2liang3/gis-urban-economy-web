import { computed, reactive, watch } from 'vue';
import { useRoute, useRouter, type LocationQuery } from 'vue-router';
import type {
  AnalysisTask,
  BBox,
  DataSourceId,
  RegionState,
  TimeUiMode,
  VitalityResult,
  DistrictSummary,
  UavRouteSummary,
} from '@/types/gis';

/** 由 gis 写入 URL 的键；合并 query 时须先剔除此类旧值，避免无法清除 `did` 等 */
export const GIS_QUERY_KEYS = new Set([
  't',
  't0',
  't1',
  'r',
  'ds',
  'ta',
  'tb',
  'cmp',
  'popA',
  'popB',
  'did',
  'pops',
  'tm',
  'uav',
]);
import { WUHAN_CENTER } from '@/utils/mapConstants';

const ADMIN_OPTIONS = [
  '武汉市（全市）',
  '江岸区',
  '江汉区',
  '硚口区',
  '汉阳区',
  '武昌区',
  '洪山区',
  '青山区',
  '东西湖区',
  '蔡甸区',
  '江夏区',
];

const defaultRegion = (): RegionState => ({
  mode: 'all',
  label: '全市',
  adminName: '武汉市（全市）',
  point: null,
  box: null,
});

export const gis = reactive({
  // 时间
  timeMode: 'single' as TimeUiMode,
  timeSingle: '2026-04-08',
  timeRangeStart: '2026-04-01',
  timeRangeEnd: '2026-04-15',
  /** 动态分析 / 播放 当前槽位 0~n-1 */
  timeSlotIndex: 0,
  timeCompareA: '2026-04-01',
  timeCompareB: '2026-04-15',
  // 区域
  region: defaultRegion(),
  // 数据源
  dataSource: 'v2026Q1' as DataSourceId,
  /** 低空：至少一条源参与模型（与 LowAltitude 复选联动） */
  uavInVitalityModel: true,
  /** 低空对活力模型的“精度”加成 0~0.2 */
  uavQualityBoost: 0.12,
  selectedUavRouteId: 'route-jianghan-night',
  uavRoute: null as UavRouteSummary | null,
  // 共享结果
  vitality: null as VitalityResult | null,
  districts: [] as DistrictSummary[],
  // 分析任务（全局可订阅）
  tasks: [] as AnalysisTask[],
  // 选中的商圈用于对比/跳转
  selectedDistrictId: null as string | null,
  compareDistrictIds: [] as string[],
  // 区域对比：人口页 A/B
  popCompareA: '江汉路',
  popCompareB: '光谷',
  // 双时间对比在 dynamics
  dynamicsCompareOn: false,
  lastJumpNote: '' as string,
});

export const adminDistrictOptions = ADMIN_OPTIONS;

const DATA_SOURCE_LABEL: Record<DataSourceId, string> = {
  v2026Q1: '智眼型 v2026Q1（模拟）',
  v2025Q4: '智眼型 v2025Q4（模拟）',
  'demo-mix': '混编·演示',
};

let routerHooked = false;
let _routerReplaceTimer: ReturnType<typeof setTimeout> | null = null;

function regionToQuery(r: RegionState): string {
  if (r.mode === 'all') return 'all';
  if (r.mode === 'admin') return `a:${encodeURIComponent(r.adminName)}`;
  if (r.mode === 'point' && r.point) return `p:${r.point.lat},${r.point.lng}`;
  if (r.mode === 'box' && r.box)
    return `b:${r.box.south},${r.box.west},${r.box.north},${r.box.east}`;
  return 'all';
}

function parseRegionQuery(s: string | undefined): RegionState {
  const b = defaultRegion();
  if (!s || s === 'all') return b;
  if (s.startsWith('a:')) {
    b.mode = 'admin';
    b.adminName = decodeURIComponent(s.slice(2));
    b.label = b.adminName;
  } else if (s.startsWith('p:')) {
    const rest = s.slice(2).split(',');
    const lat = parseFloat(rest[0]!);
    const lng = parseFloat(rest[1]!);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      b.mode = 'point';
      b.point = { lat, lng };
      b.label = '点选区域';
    }
  } else if (s.startsWith('b:')) {
    const p = s.slice(2).split(',').map(Number);
    if (p.length === 4 && p.every((n) => Number.isFinite(n))) {
      b.mode = 'box';
      b.box = { south: p[0]!, west: p[1]!, north: p[2]!, east: p[3]! };
      b.label = '框选区域';
    }
  }
  return b;
}

function applyQueryToGis(q: LocationQuery) {
  if (q.ds && typeof q.ds === 'string' && q.ds in DATA_SOURCE_LABEL) gis.dataSource = q.ds as DataSourceId;
  if (q.t && typeof q.t === 'string') gis.timeSingle = q.t;
  if (q.t0 && typeof q.t0 === 'string') gis.timeRangeStart = q.t0;
  if (q.t1 && typeof q.t1 === 'string') gis.timeRangeEnd = q.t1;
  if (q.r && typeof q.r === 'string') gis.region = parseRegionQuery(q.r);
  if (q.ta && typeof q.ta === 'string') gis.timeCompareA = q.ta;
  if (q.tb && typeof q.tb === 'string') gis.timeCompareB = q.tb;
  if (q.cmp === '1') gis.dynamicsCompareOn = true;
  if (q.cmp === '0') gis.dynamicsCompareOn = false;
  if (q.pops && typeof q.pops === 'string') gis.uavInVitalityModel = q.pops === '1';
  if (q.uav && typeof q.uav === 'string') gis.selectedUavRouteId = q.uav;
  if (q.popA && typeof q.popA === 'string') gis.popCompareA = q.popA;
  if (q.popB && typeof q.popB === 'string') gis.popCompareB = q.popB;
  if (q.did && typeof q.did === 'string') gis.selectedDistrictId = q.did;
  if (q.tm && typeof q.tm === 'string') {
    const m = q.tm as TimeUiMode;
    if (m === 'single' || m === 'range' || m === 'play' || m === 'compareAB') gis.timeMode = m;
  }
}

export function gisToQuery(partial: Record<string, string | null | undefined> = {}) {
  return {
    t: gis.timeSingle,
    t0: gis.timeRangeStart,
    t1: gis.timeRangeEnd,
    r: regionToQuery(gis.region),
    ds: gis.dataSource,
    ta: gis.timeCompareA,
    tb: gis.timeCompareB,
    tm: gis.timeMode,
    cmp: gis.dynamicsCompareOn ? '1' : '0',
    popA: gis.popCompareA,
    popB: gis.popCompareB,
    did: gis.selectedDistrictId != null ? String(gis.selectedDistrictId) : undefined,
    pops: gis.uavInVitalityModel ? '1' : '0',
    uav: gis.selectedUavRouteId,
    ...partial,
  };
}

export function useGisRouterSync() {
  const route = useRoute();
  const router = useRouter();
  if (!routerHooked) {
    routerHooked = true;
    router.afterEach((to) => {
      applyQueryToGis(to.query);
    });
    applyQueryToGis(route.query);
  }

  const replaceUrl = (extra?: Record<string, string | undefined | null>) => {
    if (_routerReplaceTimer) clearTimeout(_routerReplaceTimer);
    _routerReplaceTimer = setTimeout(() => {
      const next = gisToQuery() as Record<string, string | undefined | null>;
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          if (v == null) delete next[k];
          else next[k] = v;
        }
      }
      const q: Record<string, string> = {};
      for (const [k, v] of Object.entries(route.query)) {
        if (v == null) continue;
        if (GIS_QUERY_KEYS.has(k)) continue;
        q[k] = Array.isArray(v) ? String(v[0]) : String(v);
      }
      for (const [k, v] of Object.entries(next)) {
        if (v !== undefined && v !== null && v !== '') q[k] = String(v);
      }
      void router.replace({ path: route.path, query: q });
    }, 100);
  };

  watch(
    () =>
      [
        gis.dataSource,
        gis.timeSingle,
        gis.timeMode,
        gis.timeRangeStart,
        gis.timeRangeEnd,
        gis.timeCompareA,
        gis.timeCompareB,
        gis.dynamicsCompareOn,
        gis.popCompareA,
        gis.popCompareB,
        gis.selectedDistrictId,
        regionToQuery(gis.region),
        gis.uavInVitalityModel,
        gis.selectedUavRouteId,
      ].join('|'),
    () => replaceUrl(),
  );

  return { replaceUrl, route };
}

function fakeStatsForRegion(): { v: number; foot: string; comm: string } {
  const seed = (gis.region.label + gis.timeSingle + gis.dataSource)
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const v = 45 + (seed % 32) + (gis.uavInVitalityModel ? 5 : 0);
  const comm = 30 + (seed % 45);
  const foots = ['低', '中', '高'] as const;
  return { v, foot: foots[seed % 3]!, comm: comm.toFixed(0) + ' /km²' };
}

export const regionKpis = computed(() => fakeStatsForRegion());

export function setRegionAll() {
  gis.region = defaultRegion();
}

export function setRegionAdmin(name: string) {
  gis.region.mode = 'admin';
  gis.region.adminName = name;
  gis.region.label = name;
  gis.region.point = null;
  gis.region.box = null;
}

export function setRegionPoint(lat: number, lng: number) {
  gis.region.mode = 'point';
  gis.region.point = { lat, lng };
  gis.region.label = '点选 1 km 缓冲';
  gis.region.box = null;
}

export function setRegionBox(b: BBox) {
  gis.region.mode = 'box';
  gis.region.box = b;
  gis.region.label = '框选区域';
  gis.region.point = null;
}

export function setVitalityResult(v: VitalityResult | null) {
  gis.vitality = v;
}

export function pushTask(task: Omit<AnalysisTask, 'id' | 'status'> & { status?: AnalysisTask['status'] }) {
  const t: AnalysisTask = {
    id: `j-${Date.now()}`,
    status: task.status ?? 'running',
    name: task.name,
    page: task.page,
    message: task.message,
    errorCode: task.errorCode,
    retryCount: task.retryCount ?? 0,
    startedAt: new Date().toISOString(),
  };
  gis.tasks.unshift(t);
  if (gis.tasks.length > 8) gis.tasks.pop();
  return t.id;
}

export function updateTask(
  id: string,
  patch: Partial<Pick<AnalysisTask, 'status' | 'message' | 'errorCode' | 'retryCount' | 'finishedAt' | 'saved'>>,
) {
  const x = gis.tasks.find((x) => x.id === id);
  if (x) Object.assign(x, patch);
}

export function retryTask(id: string) {
  const x = gis.tasks.find((x) => x.id === id);
  if (!x) return;
  x.status = 'running';
  x.retryCount = (x.retryCount ?? 0) + 1;
  x.errorCode = undefined;
  x.message = `重试中（第 ${x.retryCount} 次）`;
  x.startedAt = new Date().toISOString();
  x.finishedAt = undefined;
  setTimeout(() => {
    updateTask(id, {
      status: 'success',
      message: '重试完成，结果已恢复',
      finishedAt: new Date().toISOString(),
    });
  }, 700);
}

export function setDistrictSummaries(list: DistrictSummary[]) {
  gis.districts = list;
}

export function setUavRouteSummary(route: UavRouteSummary | null) {
  gis.uavRoute = route;
  if (route) gis.selectedUavRouteId = route.id;
}

/**
 * 规范权重到和为 1；若 uav 关闭，仅对其余三项归一。
 */
export function normalizeWeights(
  w: { foot: number; poi: number; acc: number; uav: number; useUav: boolean },
): { foot: number; poi: number; acc: number; uav: number; useUav: boolean } {
  const { useUav } = w;
  if (!useUav) {
    const s = w.foot + w.poi + w.acc || 1;
    return { foot: w.foot / s, poi: w.poi / s, acc: w.acc / s, uav: 0, useUav: false };
  }
  const s2 = w.foot + w.poi + w.acc + w.uav || 1;
  return { foot: w.foot / s2, poi: w.poi / s2, acc: w.acc / s2, uav: w.uav / s2, useUav: true };
}

export function timeFactorFromPeriod(): number {
  const m = gis.timeSingle || '2026-01';
  const n = (parseInt(m.slice(5, 7), 10) || 4) / 12;
  return 0.85 + n * 0.2;
}

export const dataSourceLabel = computed(() => DATA_SOURCE_LABEL[gis.dataSource]);

export { WUHAN_CENTER };
