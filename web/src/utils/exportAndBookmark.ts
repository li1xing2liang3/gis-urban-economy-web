import type { AppBookmark } from '@/types/gis';
import { gis, gisToQuery } from '@/stores/gisState';
import type { LayerItem } from '@/types/layer';
import html2canvas from 'html2canvas';

const KEY = 'gis-economy-bookmarks';

export function loadBookmarks(): AppBookmark[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const a = JSON.parse(raw) as AppBookmark[];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function saveBookmarks(list: AppBookmark[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addBookmark(
  name: string,
  layers: LayerItem[] | undefined,
  note?: string,
): AppBookmark {
  const b: AppBookmark = {
    id: `b-${Date.now()}`,
    name,
    at: new Date().toLocaleString('zh-CN', { hour12: false }),
    timeKey: gis.timeSingle,
    regionKey: String((gisToQuery() as { r?: string }).r ?? 'all'),
    dataSource: gis.dataSource,
    note,
    layerState: layers
      ? Object.fromEntries(
          layers.map((l) => [l.id, { visible: l.visible, opacity: l.opacity ?? 1 }]),
        )
      : undefined,
  };
  const list = [b, ...loadBookmarks()].slice(0, 20);
  saveBookmarks(list);
  return b;
}

export async function downloadMapPng(mapEl: HTMLElement, filename: string) {
  const c = await html2canvas(mapEl, { useCORS: true, backgroundColor: '#0d1b2a' });
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = filename;
  a.click();
}

export function downloadTextReport(
  title: string,
  lines: { k: string; v: string }[],
  filename: string,
) {
  const head = `# ${title}\n${new Date().toLocaleString('zh-CN', { hour12: false })}\n\n`;
  const body = lines.map((x) => `- **${x.k}** ${x.v}`).join('\n');
  const blob = new Blob([head + body], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
