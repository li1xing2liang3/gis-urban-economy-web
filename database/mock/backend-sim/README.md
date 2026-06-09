# 后端仿真数据包

生成时间：2026-06-01T14:05:21.478Z

本目录为后端 API、PostGIS 或接口联调准备仿真数据。数据只用于课程/项目展示，不代表真实武汉智眼或无人机生产数据。

## 文件清单

| 文件 | 用途 |
| --- | --- |
| data-sources.json | 数据源元数据 |
| layer-catalog.json | 图层目录元数据 |
| zhiyan-observations.geojson | 智眼型人车流感知点，含 anomalyScore 与 triggerUav |
| uav-routes.geojson | 无人机航线 LineString |
| uav-coverages.geojson | 无人机覆盖面 Polygon |
| low-altitude-risk-zones.geojson | 低空风险区、禁飞/限高与规则 |
| uav-takeoff-sites.geojson | 无人机起降点、容量与就绪度 |
| uav-task-records.json | 无人机任务记录、成果、质量与耗电 |
| uav-fleet-dispatch-plan.json | 多无人机协同调度方案、编组与时序 |
| uav-fleet-registry.json | 机队注册表、机型与就绪度 |
| uav-fleet-telemetry.json | 多机统一时钟遥测与同步帧 |
| uav-fleet-conflicts.json | 空域冲突检测与消解记录 |
| uav-telemetry.json | 无人机飞行遥测轨迹点 |
| hourly-flow-timeseries.json | 小时级人流、车流与异常得分 |
| business-vitality-daily.json | 商圈日级活力、消费、夜间经济趋势 |
| building-white-models.geojson | 三维城市建筑白模 |
| model-vitality-result.json | 经济活力模型仿真结果 |
| model-district-result.json | 商圈识别模型仿真结果 |
| api-fixtures.json | 按接口路径组织的响应样例 |
| schema-extension.sql | 后端可选扩展表：智眼观测、无人机航线、覆盖面、风险区、起降点、任务、**编队调度**、白模 |

## 数据规模

- 智眼型观测点：40
- 无人机航线：3
- 无人机覆盖面：3
- 低空风险区：5
- 起降点：5
- 无人机任务记录：3
- 无人机遥测航班：3
- 小时级人车流片区：5
- 商圈日活力天数：14
- 建筑白模：6
- POI 样点来源：70
- 武汉功能片区来源：10
- 武汉聚合时序月份：8
- 武汉片区时序数量：10

## 后端接入建议

1. 先执行 `database/sql/02_schema.sql`。
2. 如需无人机与智眼仿真表，执行 `schema-extension.sql`。
3. GeoJSON 可直接由后端接口返回，也可通过 GDAL/ogr2ogr 或 PostGIS `ST_GeomFromGeoJSON` 入库。
4. 接口可先按 `api-fixtures.json` 的路径返回静态响应，前端后续只需替换 `gisDataService` 内部 URL。
