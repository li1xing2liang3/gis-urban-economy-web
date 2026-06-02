# 前后端 API 连接设计

本文档定义城市低空经济空间展示平台的前后端连接方式。当前工程提供一个 Node mock API，后续可替换为 Express、FastAPI、Spring Boot 或 PostGIS 服务。

## 运行方式

前端：

```powershell
cd web
npm.cmd run dev
```

Mock API：

```powershell
cd database
npm.cmd run mock-api
```

如果出现 `EADDRINUSE: address already in use 127.0.0.1:8787`，说明 mock API 已经在运行，或者 8787 端口被其它程序占用。可先打开健康检查确认：

```powershell
Invoke-WebRequest http://127.0.0.1:8787/api/v1/health
```

也可以临时换端口启动：

```powershell
cd database
$env:PORT=8788
npm.cmd run mock-api
```

此时前端需要同步指定代理目标：

```powershell
cd web
$env:VITE_API_PROXY_TARGET='http://127.0.0.1:8788'
npm.cmd run dev
```

默认地址：

| 服务 | 地址 |
| --- | --- |
| 前端 | `http://127.0.0.1:5173` |
| Mock API | `http://127.0.0.1:8787` |

Vite 已配置代理：前端访问 `/api/*` 时会转发到 `http://127.0.0.1:8787`。

## 前端配置

前端统一服务层：

`web/src/services/gisDataService.ts`

默认请求同源 `/api`，开发环境由 Vite 代理到 mock API。这样浏览器只访问 `http://127.0.0.1:5173/api/...`，避免跨域问题。

如需直连其它后端地址，可设置：

```env
VITE_API_BASE_URL=http://127.0.0.1:8787
```

若 API 不可用，前端会回退到 `web/public/data/mock/hubei` 下的静态数据。

### 前端调用边界

页面不要直接写 `fetch('/api/...')`，统一通过 `gisDataService` 调用：

```ts
import { gisDataService } from '@/services/gisDataService';

const cityUnits = await gisDataService.getCityUnits();
const uavRoutes = await gisDataService.getUavRoutes();
const result = await gisDataService.runVitalityModel({
  ds: 'v2026Q1',
  time: '2026-04-08',
  uavRouteIds: ['route-jianghan-night'],
});
```

这样后端从 mock API 切换到真实服务时，页面逻辑不用改。

## 接口清单

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/v1/health` | API 健康检查 |
| GET | `/api/v1/hubei/metadata/data-sources` | 数据源元数据 |
| GET | `/api/v1/hubei/metadata/layers` | 图层目录 |
| GET | `/api/v1/hubei/geo/city-units?ds=v2026Q1` | 湖北市州 GeoJSON |
| GET | `/api/v1/hubei/poi/sample?ds=v2026Q1` | 湖北 POI 样点 GeoJSON |
| GET | `/api/v1/hubei/timeseries/province?ds=v2026Q1` | 全省聚合时序 |
| GET | `/api/v1/hubei/timeseries/cities?ds=v2026Q1` | 各市州时序 |
| GET | `/api/v1/hubei/sensing/zhiyan-observations?ds=v2026Q1&date=2026-04-08` | 武汉智眼型感知观测点 |
| GET | `/api/v1/hubei/uav/routes?ds=v2026Q1` | 武汉无人机航线 GeoJSON |
| GET | `/api/v1/hubei/uav/coverages?ds=v2026Q1` | 武汉无人机覆盖面 GeoJSON |
| GET | `/api/v1/hubei/models/vitality/latest` | 最新活力模型结果 |
| GET | `/api/v1/hubei/models/districts/latest` | 最新商圈识别结果 |
| POST | `/api/v1/hubei/models/vitality/run` | 触发活力模型 |
| POST | `/api/v1/hubei/models/districts/run` | 触发商圈识别 |

## 服务层方法

| 方法 | 后端接口 | 说明 |
| --- | --- | --- |
| `getHealth()` | `GET /api/v1/health` | 后端可用性检查 |
| `getDataSources()` | `GET /api/v1/hubei/metadata/data-sources` | 数据源列表 |
| `getLayerCatalog()` | `GET /api/v1/hubei/metadata/layers` | 图层目录 |
| `getCityUnits()` | `GET /api/v1/hubei/geo/city-units?ds=v2026Q1` | 湖北市州 GeoJSON |
| `getPoiSample()` | `GET /api/v1/hubei/poi/sample?ds=v2026Q1` | 湖北 POI 样点 |
| `getProvinceTimeseries()` | `GET /api/v1/hubei/timeseries/province?ds=v2026Q1` | 全省聚合时序 |
| `getCityTimeseries()` | `GET /api/v1/hubei/timeseries/cities?ds=v2026Q1` | 各市州时序 |
| `getZhiyanObservations()` | `GET /api/v1/hubei/sensing/zhiyan-observations?ds=v2026Q1&date=2026-04-08` | 武汉智眼型观测点 |
| `getUavRoutes()` | `GET /api/v1/hubei/uav/routes?ds=v2026Q1` | 武汉无人机航线，服务层转换为前端 Leaflet 结构 |
| `getUavCoverages()` | `GET /api/v1/hubei/uav/coverages?ds=v2026Q1` | 武汉无人机覆盖面 |
| `getLatestVitalityModel()` | `GET /api/v1/hubei/models/vitality/latest` | 最新活力模型结果 |
| `getLatestDistrictModel()` | `GET /api/v1/hubei/models/districts/latest` | 最新商圈模型结果 |
| `runVitalityModel(payload)` | `POST /api/v1/hubei/models/vitality/run` | 触发活力模型 |
| `runDistrictModel(payload)` | `POST /api/v1/hubei/models/districts/run` | 触发商圈识别 |

## 请求示例

### 无人机航线

后端建议返回标准 GeoJSON，坐标为 `[lng, lat]`：

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "route-jianghan-night",
        "name": "江汉路夜间商圈巡航",
        "district": "江汉路",
        "scene": "夜间经济 / 客流热点",
        "status": "已入库",
        "time": "2026-03-18 19:30",
        "altitude": 120,
        "speed": 8,
        "resolution": "5 cm",
        "quality": 88,
        "zhiyanSync": true,
        "participatesModel": true,
        "imageUrl": "/data/uav-images/wuhan-night-aerial.jpg",
        "imageTitle": "武汉城市夜景航拍",
        "imageCredit": "Wikimedia Commons 公开共享图像",
        "imageLicense": "Commons 许可，项目演示引用",
        "imageSource": "https://commons.wikimedia.org/wiki/File:20231209_Aerial_night_view_of_Wuhan.jpg"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[114.2772, 30.6026], [114.2886, 30.6008]]
      }
    }
  ]
}
```

`gisDataService.getUavRoutes()` 会转换为页面使用的结构：

```json
{
  "routes": [
    {
      "id": "route-jianghan-night",
      "name": "江汉路夜间商圈巡航",
      "waypoints": [[30.6026, 114.2772], [30.6008, 114.2886]],
      "imageUrl": "/data/uav-images/wuhan-night-aerial.jpg",
      "model": true,
      "overlay": true
    }
  ]
}
```

当前服务层也兼容后端直接返回 `{ "routes": [...] }` 的情况。

### 触发活力模型

```http
POST /api/v1/hubei/models/vitality/run
Content-Type: application/json

{
  "ds": "v2026Q1",
  "time": "2026-04-08",
  "region": "all",
  "weights": {
    "flow": 0.35,
    "poi": 0.3,
    "traffic": 0.25,
    "uav": 0.1
  },
  "uavRouteIds": ["route-jianghan-night"]
}
```

响应：

```json
{
  "id": "vitality-1710000000000",
  "taskType": "vitality_assessment",
  "status": "success",
  "params": {},
  "result": {
    "indexMean": 78,
    "topZones": [],
    "explanation": "人流/车流热力作为宏观触发，无人机路径覆盖作为精细尺度校正项。"
  }
}
```

## 数据格式约定

- GeoJSON 坐标顺序统一为 `[lng, lat]`。
- 前端 Leaflet 绘制航点时使用 `[lat, lng]`，由 `gisDataService` 负责转换。
- 时间字段使用 ISO 字符串或 `YYYY-MM-DD`。
- 所有“智眼型”数据必须标注为体系参考或模拟数据，不声明真实接入政务生产库。
- API 错误时建议返回 `{ "error": "error_code", "message": "可读说明" }`，前端会先回退静态数据，后续可接入任务条错误提示。

## 联调检查

1. 启动 mock API：

```powershell
cd database
npm.cmd run mock-api
```

2. 启动前端：

```powershell
cd web
npm.cmd run dev
```

3. 打开健康检查：

```powershell
Invoke-WebRequest http://127.0.0.1:8787/api/v1/health
```

4. 打开前端页面，确认 `/lowaltitude` 能展示无人机航线。

## 后端替换建议

1. 保持接口路径不变，先替换 `database/scripts/mock-api.mjs` 为真实服务。
2. 将 `database/mock/backend-sim/schema-extension.sql` 合并到正式数据库迁移。
3. 前端不直接读数据库，只通过 `gisDataService` 调接口。
4. 长耗时模型可将 POST 返回改成 `taskId`，再增加 `GET /api/v1/tasks/:id` 查询任务状态。

