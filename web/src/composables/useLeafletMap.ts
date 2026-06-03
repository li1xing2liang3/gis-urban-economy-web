import L from 'leaflet';
import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import type { FeatureCollection } from 'geojson';
import { WUHAN_CENTER, DEFAULT_ZOOM, WUHAN_MAX_BOUNDS } from '@/utils/mapConstants';

function wuhanBoundaryHref(): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${window.location.origin}${prefix}geo/wuhan/wuhan-boundary.geojson`;
}

export function useLeafletMap(container: Ref<HTMLElement | null>) {
  const mapInstance = ref<L.Map | null>(null);
  let boundaryLayer: L.GeoJSON | null = null;

  onMounted(() => {
    const el = container.value;
    if (!el) return;
    const map = L.map(el, {
      zoomControl: true,
      preferCanvas: true,
      maxBounds: WUHAN_MAX_BOUNDS,
      maxBoundsViscosity: 0.85,
    }).setView(WUHAN_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapInstance.value = map;

    void (async () => {
      try {
        const res = await fetch(wuhanBoundaryHref());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const fc = (await res.json()) as FeatureCollection;
        boundaryLayer = L.geoJSON(fc, {
          style: {
            color: '#1d4ed8',
            weight: 2,
            fillColor: '#3b82f6',
            fillOpacity: 0.06,
          },
        }).addTo(map);
        map.fitBounds(boundaryLayer.getBounds(), { padding: [24, 24], maxZoom: 12 });
      } catch (err) {
        console.warn('[GIS] 武汉市区边界加载失败，使用默认武汉视域', err);
        map.setView(WUHAN_CENTER, DEFAULT_ZOOM);
      }
    })();
  });

  onUnmounted(() => {
    boundaryLayer?.remove();
    boundaryLayer = null;
    mapInstance.value?.remove();
    mapInstance.value = null;
  });

  return mapInstance;
}
