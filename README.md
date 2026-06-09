# gis-urban-economy-web

城市经济空间 **WebGIS** 演示前端（Vue 3 + Vite + Leaflet + Cesium），与《GIS 工程初步文档》及前端设计说明对齐。整合共创版能力：统一数据服务层、本地 mock API、低空航线仿真与三维 UAV 演示。

**产品形态：** 同一仓库内包含 **应用群** —— **主 GIS 平台**（首页 + 七大专题模块）与 **多无人机协同调度应用**（独立子应用 `/fleet-dispatch`），共用 Mock 数据服务与部分全局状态（任务队列、活力模型联动）。

**在线仓库：** [https://github.com/li1xing2liang3/gis-urban-economy-web](https://github.com/li1xing2liang3/gis-urban-economy-web)

---

## 目录结构（代码 · 文档 · 数据）

```
仓库根目录/
├── web/                    # 前端工程（npm 命令在此或经 --prefix 调用）
│   ├── src/
│   │   ├── services/       # gisDataService：API + 静态 mock 兜底
│   │   ├── views/          # 页面（HomeView、Overview、fleet 协同调度等）
│   │   ├── layouts/        # MainLayout（主平台）· FleetDispatchLayout（编队应用）
│   │   └── ...
│   ├── public/
│   │   ├── geo/hubei/      # 浏览器可访问的省界副本（hubei.*，由脚本从 data 同步）
│   │   ├── data/mock/hubei/  # 湖北专题 mock（17 市州、POI、UAV 航线等）
│   │   └── data/uav-images/  # 低空页航拍预览图
│   └── package.json
├── database/               # PostgreSQL + PostGIS 数据层（可选）
│   ├── sql/                # 建库脚本
│   └── scripts/            # seed、mock-api、GADM 处理等
├── docs/                   # 设计说明、启动教程、API 文档等
├── data/                   # 原始空间数据（权威源）
│   └── geospatial/boundaries/
│       ├── china-gadm41/       # GADM 中国行政区原始 shp（0–3 级）
│       ├── hubei-province/     # 湖北省界（由 GADM 提取 → 湖北省.*）
│       └── hubei-cities/       # 湖北市州界 GeoJSON（由 GADM 提取）
├── scripts/                # 小工具（省界同步、后端仿真数据生成等）
└── README.md               # 本文件
```

---

## 本地运行（最短路径）

1. 安装 [Node.js](https://nodejs.org/) LTS。  
2. 克隆仓库后，在仓库根目录执行一次省界同步（保证 `web/public/geo/hubei/` 有文件）：

   ```bash
   node scripts/sync-hubei-to-web-public.mjs
   ```

3. 安装依赖并启动开发服务：

   ```bash
   cd web
   npm install
   npm run dev
   ```

4. 浏览器打开 **http://localhost:5173/**  
   - 主平台：首页 `/` 或空间总览 `/overview`  
   - 编队应用：`/fleet-dispatch`（或首页 / 低空页入口）

另开终端：

```bash
cd database
npm install
npm run mock-api
```

前端 Vite 已将 `/api` 代理到 `http://127.0.0.1:8787`。详见 **[docs/前后端API连接设计.md](./docs/前后端API连接设计.md)**。

### 可选：PostgreSQL + PostGIS

见 **[database/README.md](./database/README.md)**。更新 mock 后：

```bash
cd web && npm run generate:mock-hubei
cd ../database && npm run seed && npm run verify
```

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/GIS平台启动与数据需求说明.md](./docs/GIS平台启动与数据需求说明.md) | 零基础启动、数据清单 |
| [docs/详细功能说明文档.md](./docs/详细功能说明文档.md) | **主文档 v2.1**：应用群说明、功能、接口与演示 |
| [docs/交互功能说明.md](./docs/交互功能说明.md) | 各页按钮、滑条、地图交互（含编队应用） |
| [docs/PRD-城市经济空间平台.md](./docs/PRD-城市经济空间平台.md) | 产品目标、全局三态、URL 键 |
| [docs/数据与智眼说明.md](./docs/数据与智眼说明.md) | 智眼数据定位与最低数据清单 |
| [docs/前后端API连接设计.md](./docs/前后端API连接设计.md) | mock-api 与 Vite 代理 |
| [docs/数据字段与前端接口.md](./docs/数据字段与前端接口.md) | `gisDataService` 接口约定 |

---

## 数据维护

更新省界：从 [GADM](https://www.gadm.org/) 下载中国数据放入 `data/geospatial/boundaries/china-gadm41/`，在 `database/` 执行 **`npm run process:gadm`**，再执行 **`node scripts/sync-hubei-to-web-public.mjs`**（或在 `web` 下 **`npm run sync:geo`**），然后刷新页面。

重新生成湖北 mock：

```bash
cd web
npm run generate:mock-hubei
```

---

## 修改代码后：如何更新 GitHub 仓库

以下假设你已配置好 Git，且远程名为 `origin`、默认分支为 `main`（与当前 GitHub 仓库一致）。

### 1. 查看改了什么

在**仓库根目录**打开终端（Git Bash / PowerShell / Cursor 终端均可）：

```bash
git status
```

### 2. 把改动加入暂存区

**全部纳入本次提交：**

```bash
git add .
```

**只添加部分文件（示例）：**

```bash
git add docs/GIS平台启动与数据需求说明.md web/src/views/OverviewView.vue
```

### 3. 写提交说明并提交到本地

```bash
git commit -m "简要说明本次修改，用中文或英文均可"
```

若提示「nothing to commit」，说明没有新改动或文件被 `.gitignore` 忽略（例如 `web/node_modules`）。

### 4. 推送到 GitHub

```bash
git push origin main
```

首次在本机推送时，GitHub 可能要求登录（浏览器授权或 Personal Access Token）。

### 5. 在另一台电脑或重新克隆后继续开发

```bash
git clone https://github.com/li1xing2liang3/gis-urban-economy-web.git
cd gis-urban-economy-web
```

进入项目后同样执行：`node scripts/sync-hubei-to-web-public.mjs`，再 `cd web && npm install && npm run dev`。

### 6. 若远程有别人推送的新提交，先拉再推

```bash
git pull origin main --rebase
git push origin main
```

---

## 忽略规则说明

根目录 **`.gitignore`** 已忽略 **`web/node_modules/`** 与 **`web/dist/`**，请勿把依赖和构建产物提交到仓库。省界数据在 **`data/`** 与 **`web/public/geo/`** 的副本可提交，便于克隆后开箱即用；若数据涉密，请改为私有仓库或仅从内部源同步。

整合完成后可删除临时目录 **`gis-urban-economy-web-main/`**（共创版源码包，内容已合并入主仓库）。

---

## 许可证

未特别声明前，以仓库内文件为准；对外发布前请补充 `LICENSE` 与数据使用授权说明。
