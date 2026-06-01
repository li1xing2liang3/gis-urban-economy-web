import L from 'leaflet';
import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import getShapefile from 'shpjs';
import type { FeatureCollection } from 'geojson';
import { WUHAN_CENTER, DEFAULT_ZOOM } from '@/utils/mapConstants';

/** 与 `web/public/geo/hubei/hubei.*` 对应，供浏览器 fetch shapefile */
function hubeiShapefileBaseHref(): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${window.location.origin}${prefix}geo/hubei/hubei`;
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
    }).setView(WUHAN_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapInstance.value = map;

    void (async () => {
      try {
        const parsed = await getShapefile(hubeiShapefileBaseHref());
        const fc: FeatureCollection = Array.isArray(parsed) ? parsed[0]! : parsed;
        boundaryLayer = L.geoJSON(fc, {
          style: {
            color: '#1d4ed8',
            weight: 2,
            fillColor: '#3b82f6',
            fillOpacity: 0.06,
          },
        }).addTo(map);
        map.fitBounds(boundaryLayer.getBounds(), { padding: [20, 20], maxZoom: 9 });
      } catch (err) {
        console.warn('[GIS] 湖北省界 shapefile 加载失败，使用默认武汉视域', err);
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
