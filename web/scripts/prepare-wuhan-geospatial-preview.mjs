import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..');
const sourceRoot = path.join(repoRoot, 'data', 'geospatial', 'wuhan');
const publicRoot = path.join(webRoot, 'public', 'geo', 'wuhan');

const roadsSource = path.join(sourceRoot, 'roads.geojson');
const buildingManifestSource = path.join(sourceRoot, 'buildings', 'manifest.json');
const buildingLowRoot = path.join(sourceRoot, 'buildings', 'low');

const roadPreviewTarget = path.join(publicRoot, 'roads-preview.geojson');
const buildingDensityTarget = path.join(publicRoot, 'buildings', 'density-preview.geojson');
const buildingDisplayRoot = path.join(publicRoot, 'buildings', 'display');
const buildingDisplayManifestTarget = path.join(buildingDisplayRoot, 'manifest.json');
const skipMirror = process.argv.includes('--skip-mirror');

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refuse to operate outside ${parent}: ${child}`);
  }
}

function mirrorSourceToPublic() {
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Missing source directory: ${sourceRoot}`);
  }
  assertInside(repoRoot, sourceRoot);
  assertInside(webRoot, publicRoot);

  fs.rmSync(publicRoot, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(publicRoot), { recursive: true });
  fs.cpSync(sourceRoot, publicRoot, { recursive: true });
  console.log(`mirrored ${path.relative(repoRoot, sourceRoot)} -> ${path.relative(repoRoot, publicRoot)}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
  const rel = path.relative(repoRoot, file);
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`wrote ${rel} (${kb} KB)`);
}

function round(value, decimals = 6) {
  return Number(Number(value).toFixed(decimals));
}

function roundCoords(value) {
  if (typeof value[0] === 'number') return [round(value[0]), round(value[1])];
  return value.map(roundCoords);
}

function haversineKm(a, b) {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function lineLengthKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) total += haversineKm(coords[i - 1], coords[i]);
  return total;
}

function pointLineDistanceSq(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return (point[0] - a[0]) ** 2 + (point[1] - a[1]) ** 2;
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return (point[0] - x) ** 2 + (point[1] - y) ** 2;
}

function simplifyLine(coords, toleranceDeg) {
  if (coords.length <= 2) return coords.map((coord) => roundCoords(coord));
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  const toleranceSq = toleranceDeg ** 2;

  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const distance = pointLineDistanceSq(coords[i], coords[start], coords[end]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index >= 0 && maxDistance > toleranceSq) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  return coords.filter((_, index) => keep[index]).map((coord) => roundCoords(coord));
}

function roadImportance(highway) {
  if (['motorway', 'trunk'].includes(highway)) return 6;
  if (['primary', 'motorway_link', 'trunk_link'].includes(highway)) return 5;
  if (['secondary', 'primary_link'].includes(highway)) return 4;
  if (['tertiary', 'secondary_link'].includes(highway)) return 3;
  if (['residential', 'unclassified', 'service'].includes(highway)) return 1;
  return 0;
}

function roadLevel(highway) {
  if (['motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link', 'primary_link'].includes(highway)) return 'primary';
  if (['secondary', 'tertiary', 'secondary_link'].includes(highway)) return 'secondary';
  return 'local';
}

function roadCenter(coords) {
  let lon = 0;
  let lat = 0;
  let count = 0;
  for (const coord of coords) {
    lon += Number(coord[0] ?? 0);
    lat += Number(coord[1] ?? 0);
    count += 1;
  }
  return count ? [lon / count, lat / count] : [0, 0];
}

function roadBbox(features) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const feature of features) {
    for (const [lon, lat] of feature.geometry?.coordinates ?? []) {
      bbox[0] = Math.min(bbox[0], lon);
      bbox[1] = Math.min(bbox[1], lat);
      bbox[2] = Math.max(bbox[2], lon);
      bbox[3] = Math.max(bbox[3], lat);
    }
  }
  return bbox.every(Number.isFinite) ? bbox : [113.8, 30.2, 114.8, 30.9];
}

function roadGridKey(center, bbox, cols = 10, rows = 8) {
  const [west, south, east, north] = bbox;
  const col = Math.max(0, Math.min(cols - 1, Math.floor(((center[0] - west) / Math.max(east - west, 0.000001)) * cols)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor(((center[1] - south) / Math.max(north - south, 0.000001)) * rows)));
  return `${row}:${col}`;
}

const wideRoadConnectors = [
  {
    id: 'wide-ring-north',
    highway: 'motorway',
    level: 'primary',
    coordinates: [[113.83, 30.58], [114.05, 30.68], [114.28, 30.76], [114.52, 30.78], [114.78, 30.88], [115.02, 31.02]],
  },
  {
    id: 'wide-ring-east',
    highway: 'motorway',
    level: 'primary',
    coordinates: [[114.78, 30.88], [114.90, 30.72], [114.84, 30.52], [114.70, 30.32], [114.54, 30.16]],
  },
  {
    id: 'wide-ring-south',
    highway: 'motorway',
    level: 'primary',
    coordinates: [[113.82, 30.30], [114.04, 30.25], [114.27, 30.18], [114.50, 30.13], [114.70, 30.32]],
  },
  {
    id: 'wide-ring-west',
    highway: 'motorway',
    level: 'primary',
    coordinates: [[113.82, 30.30], [113.76, 30.45], [113.83, 30.58], [113.98, 30.70], [114.10, 30.82]],
  },
  {
    id: 'wide-airport-huangpi',
    highway: 'trunk',
    level: 'primary',
    coordinates: [[114.26, 30.62], [114.22, 30.72], [114.25, 30.86], [114.31, 31.04], [114.30, 31.25]],
  },
  {
    id: 'wide-huangpi-eastwest',
    highway: 'secondary',
    level: 'secondary',
    coordinates: [[114.08, 31.05], [114.22, 31.08], [114.38, 31.10], [114.58, 31.08], [114.82, 31.04]],
  },
  {
    id: 'wide-yangluo-xinzhou',
    highway: 'trunk',
    level: 'primary',
    coordinates: [[114.36, 30.66], [114.54, 30.68], [114.72, 30.74], [114.92, 30.80], [115.03, 30.88]],
  },
  {
    id: 'wide-xinzhou-northsouth',
    highway: 'secondary',
    level: 'secondary',
    coordinates: [[114.88, 30.55], [114.90, 30.70], [114.96, 30.86], [115.00, 31.02], [114.94, 31.18]],
  },
  {
    id: 'wide-optics-valley-east',
    highway: 'trunk',
    level: 'primary',
    coordinates: [[114.37, 30.51], [114.52, 30.49], [114.67, 30.46], [114.82, 30.43], [114.96, 30.38]],
  },
  {
    id: 'wide-jiangxia-south',
    highway: 'trunk',
    level: 'primary',
    coordinates: [[114.31, 30.50], [114.34, 30.36], [114.38, 30.22], [114.47, 30.09], [114.60, 30.03]],
  },
  {
    id: 'wide-jiangxia-eastwest',
    highway: 'secondary',
    level: 'secondary',
    coordinates: [[114.08, 30.20], [114.25, 30.22], [114.42, 30.22], [114.60, 30.20], [114.76, 30.18]],
  },
  {
    id: 'wide-caidian-hannan',
    highway: 'trunk',
    level: 'primary',
    coordinates: [[114.20, 30.55], [114.04, 30.52], [113.90, 30.47], [113.79, 30.38], [113.74, 30.24]],
  },
  {
    id: 'wide-caidian-west',
    highway: 'secondary',
    level: 'secondary',
    coordinates: [[113.76, 30.58], [113.88, 30.60], [114.01, 30.58], [114.14, 30.56]],
  },
  {
    id: 'wide-dongxihu-northwest',
    highway: 'secondary',
    level: 'secondary',
    coordinates: [[114.08, 30.58], [114.07, 30.70], [114.10, 30.82], [114.18, 30.94], [114.26, 31.02]],
  },
  {
    id: 'wide-river-cross-city',
    highway: 'primary',
    level: 'primary',
    coordinates: [[113.90, 30.50], [114.08, 30.53], [114.25, 30.56], [114.42, 30.58], [114.62, 30.60], [114.84, 30.64]],
  },
  {
    id: 'wide-economic-dev-southwest',
    highway: 'secondary',
    level: 'secondary',
    coordinates: [[114.18, 30.51], [114.12, 30.43], [114.02, 30.35], [113.90, 30.29], [113.76, 30.22]],
  },
  {
    id: 'wide-south-lakes-corridor',
    highway: 'secondary',
    level: 'secondary',
    coordinates: [[114.22, 30.41], [114.35, 30.36], [114.50, 30.31], [114.66, 30.27], [114.82, 30.24]],
  },
  {
    id: 'wide-north-lakes-corridor',
    highway: 'secondary',
    level: 'secondary',
    coordinates: [[113.96, 30.76], [114.14, 30.77], [114.34, 30.78], [114.56, 30.82], [114.76, 30.90]],
  },
];

function createWideRoadConnectorFeatures() {
  return wideRoadConnectors.map((line) => ({
    type: 'Feature',
    id: line.id,
    properties: {
      id: line.id,
      highway: line.highway,
      level: line.level,
      wideConnector: true,
      lengthKm: Number(lineLengthKm(line.coordinates).toFixed(2)),
      source: 'simulated-wide-connectors',
    },
    geometry: {
      type: 'LineString',
      coordinates: line.coordinates.map((coord) => roundCoords(coord)),
    },
  }));
}

function prepareRoadsPreview() {
  if (!fs.existsSync(roadsSource)) {
    console.warn(`missing ${roadsSource}; skip roads preview`);
    return;
  }
  const source = readJson(roadsSource);
  const sourceLineFeatures = (source.features ?? []).filter((feature) => feature.geometry?.type === 'LineString');
  const bbox = roadBbox(sourceLineFeatures);
  const allCandidates = sourceLineFeatures
    .filter((feature) => feature.geometry?.type === 'LineString')
    .map((feature, index) => {
      const highway = String(feature.properties?.highway ?? '');
      const lengthKm = lineLengthKm(feature.geometry.coordinates);
      const importance = roadImportance(highway);
      const name = feature.properties?.name ? String(feature.properties.name) : '';
      const bridge = Boolean(feature.properties?.bridge);
      const center = roadCenter(feature.geometry.coordinates);
      const gridKey = roadGridKey(center, bbox);
      const score = importance * 1000 + Math.min(lengthKm, 12) * 90 + (name ? 45 : 0) + (bridge ? 80 : 0);
      const keep = importance >= 2 || bridge || lengthKm >= 0.85;
      return { feature, index, highway, lengthKm, importance, name, bridge, score, keep, gridKey };
    })
    .filter((item) => item.keep);

  const selected = new Map();

  const byGrid = new Map();
  for (const item of allCandidates) {
    if (!byGrid.has(item.gridKey)) byGrid.set(item.gridKey, []);
    byGrid.get(item.gridKey).push(item);
  }
  for (const list of byGrid.values()) {
    list
      .sort((a, b) => b.score - a.score)
      .slice(0, 24)
      .forEach((item) => selected.set(item.index, item));
  }

  const quotas = new Map([
    ['motorway', 780],
    ['trunk', 1120],
    ['primary', 760],
    ['motorway_link', 180],
    ['trunk_link', 180],
    ['primary_link', 180],
    ['secondary', 560],
    ['secondary_link', 160],
    ['tertiary', 460],
    ['residential', 260],
    ['unclassified', 180],
    ['service', 120],
  ]);
  const byHighway = new Map();
  for (const item of allCandidates) {
    if (!byHighway.has(item.highway)) byHighway.set(item.highway, []);
    byHighway.get(item.highway).push(item);
  }
  for (const [highway, list] of byHighway) {
    const quota = quotas.get(highway) ?? 80;
    list
      .sort((a, b) => b.score - a.score)
      .slice(0, quota)
      .forEach((item) => selected.set(item.index, item));
  }

  const candidates = [...selected.values()]
    .sort((a, b) => a.index - b.index);

  const features = candidates.map((item) => {
    const tolerance = item.importance >= 5 ? 0.00008 : item.importance >= 3 ? 0.00013 : 0.0002;
    return {
      type: 'Feature',
      id: item.feature.id ?? item.feature.properties?.['@id'] ?? `road-${item.index}`,
      properties: {
        id: item.feature.properties?.['@id'] ?? `road-${item.index}`,
        name: item.name || undefined,
        highway: item.highway || undefined,
        level: roadLevel(item.highway),
        bridge: item.bridge || undefined,
        lengthKm: Number(item.lengthKm.toFixed(2)),
        source: 'data/geospatial/wuhan/roads.geojson',
      },
      geometry: {
        type: 'LineString',
        coordinates: simplifyLine(item.feature.geometry.coordinates, tolerance),
      },
    };
  });
  const connectorFeatures = createWideRoadConnectorFeatures();

  writeJson(roadPreviewTarget, {
    type: 'FeatureCollection',
    name: 'wuhan-roads-preview',
    generatedAt: new Date().toISOString(),
    source: 'data/geospatial/wuhan/roads.geojson',
    sourceFeatureCount: source.features?.length ?? 0,
    previewFeatureCount: features.length + connectorFeatures.length,
    connectorFeatureCount: connectorFeatures.length,
    features: [...features, ...connectorFeatures],
  });
}

function tileAreaKm2(bounds) {
  const [[south, west], [north, east]] = bounds;
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const widthKm = Math.abs(east - west) * 111.32 * Math.cos(midLat);
  const heightKm = Math.abs(north - south) * 110.57;
  return Math.max(widthKm * heightKm, 0.0001);
}

function tilePolygon(bounds) {
  const [[south, west], [north, east]] = bounds;
  return [
    [
      [round(west), round(south)],
      [round(east), round(south)],
      [round(east), round(north)],
      [round(west), round(north)],
      [round(west), round(south)],
    ],
  ];
}

function projectPoint(coord, refLat) {
  const latRad = refLat * (Math.PI / 180);
  return [coord[0] * 111_320 * Math.cos(latRad), coord[1] * 110_540];
}

function ringAreaM2(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  const refLat = ring.reduce((sum, coord) => sum + Number(coord[1] ?? 0), 0) / ring.length;
  const projected = ring.map((coord) => projectPoint(coord, refLat));
  let area = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

function geometryAreaM2(geometry) {
  if (!geometry) return 0;
  if (geometry.type === 'Polygon') return ringAreaM2(geometry.coordinates?.[0] ?? []);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.reduce((sum, polygon) => sum + ringAreaM2(polygon?.[0] ?? []), 0);
  }
  return 0;
}

function displayLimitForCount(count) {
  return Math.min(650, Math.max(220, Math.round(Math.sqrt(count) * 2.2)));
}

function estimatedHeightM(areaM2, tile, index) {
  const coreBoost = tile.id === 'tile_1_1' ? 1.28 : tile.row === 1 ? 1.12 : 0.92;
  const base = 10 + Math.sqrt(Math.max(areaM2, 20)) * 0.78 * coreBoost;
  const rhythm = ((index * 37 + tile.row * 11 + tile.col * 17) % 31) - 10;
  return Math.round(Math.max(8, Math.min(168, base + rhythm)));
}

function selectBuildingFeatures(features, tile, limit) {
  const scored = features
    .map((feature, index) => ({
      feature,
      index,
      areaM2: geometryAreaM2(feature.geometry),
    }))
    .filter((item) => item.feature.geometry?.type === 'Polygon' || item.feature.geometry?.type === 'MultiPolygon');

  const selected = new Set();
  const topCount = Math.min(scored.length, Math.round(limit * 0.55));
  [...scored].sort((a, b) => b.areaM2 - a.areaM2).slice(0, topCount).forEach((item) => selected.add(item.index));

  const remainingTarget = Math.max(0, limit - selected.size);
  const stride = Math.max(1, Math.floor(features.length / Math.max(remainingTarget, 1)));
  for (let i = 0; i < features.length && selected.size < limit; i += stride) {
    selected.add(i);
  }
  for (let i = 0; i < features.length && selected.size < limit; i += 1) {
    selected.add(i);
  }

  return scored
    .filter((item) => selected.has(item.index))
    .sort((a, b) => a.index - b.index)
    .map((item) => {
      const sourceProps = item.feature.properties ?? {};
      const sourceHeight = Number(sourceProps.height ?? 0);
      const height = sourceHeight > 0 ? Math.round(sourceHeight) : estimatedHeightM(item.areaM2, tile, item.index);
      return {
        type: 'Feature',
        id: sourceProps.id ?? `display-${tile.id}-${item.index}`,
        properties: {
          id: sourceProps.id ?? `display-${tile.id}-${item.index}`,
          height,
          num_floors: Number(sourceProps.num_floors ?? 0) || Math.max(1, Math.round(height / 3.2)),
          class: sourceProps.class ?? 'building',
          areaM2: Math.round(item.areaM2),
          sourceTile: tile.id,
          sourceFeatureCount: features.length,
          heightEstimated: !(sourceHeight > 0),
        },
        geometry: {
          type: item.feature.geometry.type,
          coordinates: roundCoords(item.feature.geometry.coordinates),
        },
      };
    });
}

function prepareBuildingPreview() {
  if (!fs.existsSync(buildingManifestSource)) {
    console.warn(`missing ${buildingManifestSource}; skip building preview`);
    return;
  }
  const manifest = readJson(buildingManifestSource);
  const stats = manifest.stats?.low ?? {};
  const counts = manifest.tiles.map((tile) => Number(stats[tile.id] ?? 0));
  const maxCount = Math.max(...counts, 1);

  const densityFeatures = manifest.tiles.map((tile) => {
    const count = Number(stats[tile.id] ?? 0);
    const areaKm2 = tileAreaKm2(tile.bounds);
    return {
      type: 'Feature',
      id: `building-density-${tile.id}`,
      properties: {
        id: tile.id,
        row: tile.row,
        col: tile.col,
        buildingCount: count,
        densityPerKm2: Math.round(count / areaKm2),
        densityRank: Number((count / maxCount).toFixed(4)),
        areaKm2: Number(areaKm2.toFixed(2)),
        source: 'data/geospatial/wuhan/buildings/manifest.json',
      },
      geometry: {
        type: 'Polygon',
        coordinates: tilePolygon(tile.bounds),
      },
    };
  });

  writeJson(buildingDensityTarget, {
    type: 'FeatureCollection',
    name: 'wuhan-building-density-preview',
    generatedAt: new Date().toISOString(),
    source: 'data/geospatial/wuhan/buildings/manifest.json',
    features: densityFeatures,
  });

  fs.mkdirSync(buildingDisplayRoot, { recursive: true });
  const displayStats = {};
  for (const tile of manifest.tiles) {
    const sourceFile = path.join(buildingLowRoot, `${tile.id}.geojson`);
    if (!fs.existsSync(sourceFile)) continue;
    const source = readJson(sourceFile);
    const sourceCount = source.features?.length ?? 0;
    const limit = displayLimitForCount(sourceCount);
    const features = selectBuildingFeatures(source.features ?? [], tile, limit);
    displayStats[tile.id] = { sourceCount, displayCount: features.length };
    writeJson(path.join(buildingDisplayRoot, `${tile.id}.geojson`), {
      type: 'FeatureCollection',
      name: `wuhan-building-display-${tile.id}`,
      source: path.relative(repoRoot, sourceFile).replaceAll(path.sep, '/'),
      sourceFeatureCount: sourceCount,
      displayFeatureCount: features.length,
      generatedAt: new Date().toISOString(),
      features,
    });
  }

  writeJson(buildingDisplayManifestTarget, {
    ...manifest,
    source: 'data/geospatial/wuhan/buildings/manifest.json',
    tileBase: '/geo/wuhan/buildings/display',
    generatedAt: new Date().toISOString(),
    displayStats,
  });
}

if (!skipMirror) mirrorSourceToPublic();
prepareRoadsPreview();
prepareBuildingPreview();
