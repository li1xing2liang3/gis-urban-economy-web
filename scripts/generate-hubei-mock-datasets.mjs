/**
 * 兼容从仓库根目录调用：在 web 目录下执行真实脚本以解析 shpjs 依赖。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(root, '..', 'web');
const script = path.join(webDir, 'scripts', 'generate-hubei-mock-datasets.mjs');

const r = spawnSync(process.execPath, [script], {
  cwd: webDir,
  stdio: 'inherit',
});

process.exit(r.status ?? 1);
