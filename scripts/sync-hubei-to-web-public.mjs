/**
 * 将「数据目录」中的湖北省 shapefile（湖北省.*）复制为 web/public/geo/hubei/hubei.*
 * 供 Vite 开发服务器与 shpjs 加载。
 * 用法（在仓库根目录）：node scripts/sync-hubei-to-web-public.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'data', 'geospatial', 'boundaries', 'hubei-province');
const destDir = path.join(repoRoot, 'web', 'public', 'geo', 'hubei');
const SRC_PREFIX = '湖北省';

function main() {
  if (!fs.existsSync(srcDir)) {
    console.error('缺少源目录:', srcDir);
    process.exit(1);
  }
  fs.mkdirSync(destDir, { recursive: true });
  const REQUIRED_EXTS = ['shp', 'shx', 'dbf', 'prj', 'cpg'];
  let n = 0;
  for (const ext of REQUIRED_EXTS) {
    const srcName = `${SRC_PREFIX}.${ext}`;
    const srcPath = path.join(srcDir, srcName);
    if (!fs.existsSync(srcPath)) {
      if (ext === 'cpg') continue;
      console.error('缺少源文件:', srcPath);
      process.exit(1);
    }
    const destName = `hubei.${ext}`;
    fs.copyFileSync(srcPath, path.join(destDir, destName));
    console.log('→', destName);
    n++;
  }
  for (const stale of ['sbn', 'sbx']) {
    const stalePath = path.join(destDir, `hubei.${stale}`);
    if (fs.existsSync(stalePath)) {
      fs.unlinkSync(stalePath);
      console.log('× 已移除过时索引', `hubei.${stale}`);
    }
  }
  if (n === 0) {
    console.error('未在', srcDir, '下找到', SRC_PREFIX + '.* 文件');
    process.exit(1);
  }
  console.log('已同步', n, '个文件到 web/public/geo/hubei/');
}

main();
