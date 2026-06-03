/**
 * 将 data/geospatial/WuHanDEM 山体阴影 GeoTIFF 转为 Leaflet 可用的 PNG + bounds JSON。
 * 优先 HillShadeWH.tif（与武汉演示范围匹配较好）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromFile } from 'geotiff';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const demDir = path.join(repoRoot, 'data/geospatial/WuHanDEM');
const outDir = path.join(repoRoot, 'web/public/geo/wuhan');

const CANDIDATES = ['HillShadeWH.tif', 'WuhanDEM84.tif', 'WuHanDEM.tif'];
const MAX_EDGE = 2048;

function pickSource() {
  for (const name of CANDIDATES) {
    const p = path.join(demDir, name);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`未找到 DEM 文件，请确认 ${demDir} 下有 HillShadeWH.tif`);
}

function scaleToMax(w, h, maxEdge) {
  if (Math.max(w, h) <= maxEdge) return { w, h };
  const s = maxEdge / Math.max(w, h);
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

function readWorldFile(tfwPath) {
  const lines = fs.readFileSync(tfwPath, 'utf8').trim().split(/\r?\n/);
  if (lines.length < 6) return null;
  const pixelW = Number(lines[0]);
  const pixelH = Number(lines[3]);
  const ulX = Number(lines[4]);
  const ulY = Number(lines[5]);
  return { pixelW, pixelH, ulX, ulY };
}

function boundsFromWorldFile(tfw, width, height) {
  const west = tfw.ulX - tfw.pixelW / 2;
  const north = tfw.ulY - tfw.pixelH / 2;
  const east = west + width * tfw.pixelW;
  const south = north + height * tfw.pixelH;
  return { west, south, east, north };
}

async function main() {
  const src = pickSource();
  const base = path.basename(src, path.extname(src));
  const tfwPath = path.join(demDir, `${base}.tfw`);
  console.log('[DEM] 源文件:', src);

  fs.mkdirSync(outDir, { recursive: true });

  const tiff = await fromFile(src);
  const image = await tiff.getImage();
  let width = image.getWidth();
  let height = image.getHeight();
  const bbox = image.getBoundingBox?.() ?? null;

  const { w: outW, h: outH } = scaleToMax(width, height, MAX_EDGE);
  const raw = await image.readRasters({ width: outW, height: outH, interleave: true });
  const samples =
    raw instanceof Uint8Array || raw instanceof Uint16Array || raw instanceof Float32Array
      ? raw
      : raw[0];

  let west;
  let south;
  let east;
  let north;

  if (bbox && bbox.length === 4 && bbox.every((n) => Number.isFinite(n))) {
    [west, south, east, north] = bbox;
    if (south > north) [south, north] = [north, south];
  } else if (fs.existsSync(tfwPath)) {
    const tfw = readWorldFile(tfwPath);
    const b = boundsFromWorldFile(tfw, width, height);
    ({ west, south, east, north } = b);
  } else {
    throw new Error('无法确定 DEM 地理范围（无 bbox 且无 .tfw）');
  }

  const png = new PNG({ width: outW, height: outH });
  const channels = samples.length / (outW * outH);

  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const srcIdx = (y * outW + x) * Math.max(1, channels);
      let v = Number(samples[srcIdx] ?? 0);
      if (v > 255) v = Math.min(255, v / 256);
      v = Math.max(0, Math.min(255, Math.round(v)));
      const dst = (y * outW + x) << 2;
      png.data[dst] = v;
      png.data[dst + 1] = v;
      png.data[dst + 2] = v;
      png.data[dst + 3] = 255;
    }
  }

  const pngPath = path.join(outDir, 'hillshade.png');
  const metaPath = path.join(outDir, 'hillshade.meta.json');
  await fs.promises.writeFile(pngPath, PNG.sync.write(png));

  const meta = {
    source: path.relative(repoRoot, src),
    width: outW,
    height: outH,
    bounds: [
      [south, west],
      [north, east],
    ],
    crs: 'EPSG:4326',
    generatedAt: new Date().toISOString(),
  };
  await fs.promises.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  console.log('[DEM] 已写入', pngPath);
  console.log('[DEM] 范围 [[南,西],[北,东]]:', meta.bounds);
  console.log('[DEM] 元数据', metaPath);
}

main().catch((err) => {
  console.error('[DEM] 转换失败:', err.message);
  process.exit(1);
});
