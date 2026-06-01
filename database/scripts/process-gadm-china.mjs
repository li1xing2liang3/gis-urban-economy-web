#!/usr/bin/env node
/**
 * 从 GADM 中国行政区 shapefile 提取湖北省界与市州面，写入 data/geospatial/boundaries/。
 * 用法（在 database/ 目录）：npm run process:gadm
 * 或：node scripts/process-gadm-china.mjs
 *
 * 完成后请在仓库根目录执行：node scripts/sync-hubei-to-web-public.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import shp from 'shpjs';

const require = createRequire(import.meta.url);
const geojsonUtil = require('shp-write/src/geojson');
const shpWrite = require('shp-write/src/write');
const shpPrj = require('shp-write/src/prj');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const GADM_DIR = path.join(ROOT, 'data', 'geospatial', 'boundaries', 'china-gadm41');
const HUBEI_DIR = path.join(ROOT, 'data', 'geospatial', 'boundaries', 'hubei-province');
const CITIES_DIR = path.join(ROOT, 'data', 'geospatial', 'boundaries', 'hubei-cities');
const LEGACY_GADM_DIR = path.join(ROOT, 'data');

const GADM_LEVELS = [0, 1, 2, 3];
const HUBEI_ADCODE = '420000';

/** GADM 2 级名称 → 国标 adcode（含省直管县级市） */
const CITY_ADCODE = {
  Wuhan: '420100',
  Huangshi: '420200',
  Shiyan: '420300',
  Yichang: '420500',
  Xiangfan: '420600',
  Ezhou: '420700',
  Jingmen: '420800',
  Xiaogan: '420900',
  Jingzhou: '421000',
  Huanggang: '421100',
  Xianning: '421200',
  Suizhou: '421300',
  'Enshi Tujia and Miao': '422800',
  Xiantao: '429004',
  Qianjiang: '429005',
  Tianmen: '429006',
  Shennongjia: '429021',
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function moveLegacyGadmFiles() {
  ensureDir(GADM_DIR);
  let moved = 0;
  for (const level of GADM_LEVELS) {
    const prefix = `gadm41_CHN_${level}`;
    for (const ext of ['shp', 'shx', 'dbf', 'prj', 'cpg']) {
      const src = path.join(LEGACY_GADM_DIR, `${prefix}.${ext}`);
      if (!fs.existsSync(src)) continue;
      const dest = path.join(GADM_DIR, `${prefix}.${ext}`);
      if (!fs.existsSync(dest)) {
        fs.renameSync(src, dest);
        moved++;
      }
    }
  }
  if (moved) console.log(`[ok] 已将 ${moved} 个 GADM 文件移入`, GADM_DIR);
}

async function readGadm(level) {
  const base = path.join(GADM_DIR, `gadm41_CHN_${level}`);
  const shpPath = `${base}.shp`;
  if (!fs.existsSync(shpPath)) {
    throw new Error(`缺少 GADM 文件: ${shpPath}，请从 https://www.gadm.org/ 下载中国数据`);
  }
  const obj = {
    shp: fs.readFileSync(`${base}.shp`),
    dbf: fs.readFileSync(`${base}.dbf`),
  };
  if (fs.existsSync(`${base}.prj`)) obj.prj = fs.readFileSync(`${base}.prj`);
  if (fs.existsSync(`${base}.cpg`)) obj.cpg = fs.readFileSync(`${base}.cpg`);
  return shp(obj);
}

function isHubei(props) {
  return /hubei/i.test(props?.NAME_1 || '') || /湖北/.test(props?.NL_NAME_1 || '');
}

function provinceFeature(raw) {
  const p = raw.properties || {};
  return {
    type: 'Feature',
    geometry: raw.geometry,
    properties: {
      NAME_1: p.NAME_1 || 'Hubei',
      NL_NAME1: 'Hubei',
      adcode: HUBEI_ADCODE,
      SOURCE: 'GADM41',
      GADM_GID: p.GID_1,
      HASC_1: p.HASC_1,
      ISO_1: p.ISO_1,
    },
  };
}

function cityFeature(raw) {
  const p = raw.properties || {};
  const nameEn = p.NAME_2 || '';
  const nameZh = (p.NL_NAME_2 || nameEn).replace(/\s*市$|自治州$|林区$/u, (m) => m);
  return {
    type: 'Feature',
    geometry: raw.geometry,
    properties: {
      ...p,
      id: CITY_ADCODE[nameEn] || p.HASC_2 || p.GID_2,
      name: p.NL_NAME_2 || nameEn,
      NAME: p.NL_NAME_2 || nameEn,
      adcode: CITY_ADCODE[nameEn] || null,
      SOURCE: 'GADM v4.1',
      GADM_GID: p.GID_2,
    },
  };
}

function writeProvinceShapefile(feature) {
  ensureDir(HUBEI_DIR);
  const fc = { type: 'FeatureCollection', features: [feature] };
  const layer = geojsonUtil.polygon(fc);
  if (!layer.geometries.length || !layer.geometries[0].length) {
    throw new Error('无法从 GeoJSON 生成省界多边形');
  }
  const outPrefix = path.join(HUBEI_DIR, '湖北省');
  shpWrite(layer.properties, layer.type, layer.geometries, (err, files) => {
    if (err) throw err;
    fs.writeFileSync(`${outPrefix}.shp`, Buffer.from(files.shp.buffer));
    fs.writeFileSync(`${outPrefix}.shx`, Buffer.from(files.shx.buffer));
    fs.writeFileSync(`${outPrefix}.dbf`, Buffer.from(files.dbf.buffer));
    fs.writeFileSync(`${outPrefix}.prj`, shpPrj);
    fs.writeFileSync(`${outPrefix}.cpg`, 'UTF-8', 'utf8');
  });
  console.log('[ok] 省界 shapefile →', `${outPrefix}.*`);
}

function writeCitiesGeojson(features) {
  ensureDir(CITIES_DIR);
  const fc = {
    type: 'FeatureCollection',
    name: 'hubei-cities-gadm41',
    features,
  };
  const out = path.join(CITIES_DIR, 'cities.geojson');
  fs.writeFileSync(out, JSON.stringify(fc), 'utf8');
  console.log('[ok] 市州 GeoJSON →', out, `(${features.length} 个)`);
}

async function main() {
  moveLegacyGadmFiles();

  const level1 = await readGadm(1);
  const hubeiRows = level1.features.filter((f) => isHubei(f.properties));
  if (hubeiRows.length !== 1) {
    throw new Error(`GADM 一级区划中湖北省记录数异常: ${hubeiRows.length}`);
  }
  const province = provinceFeature(hubeiRows[0]);
  writeProvinceShapefile(province);

  const level2 = await readGadm(2);
  const cities = level2.features.filter((f) => isHubei(f.properties)).map(cityFeature);
  writeCitiesGeojson(cities);

  console.log('\n下一步：在仓库根目录执行 node scripts/sync-hubei-to-web-public.mjs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
