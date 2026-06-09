# 武汉低空经济与城市运行仿真数据

本目录由 `web/scripts/generate-wuhan-simulation-extension.mjs` 生成，数据用于课程项目展示、前后端接口联调和页面功能演示，不代表真实政务、飞控或空域管制数据。

**应用群用途：** 主 GIS 平台七专题 + **多无人机协同调度子应用**（`/fleet-dispatch`）共用本目录及 `web/public/data/mock/wuhan/` 中的编队相关 JSON。

## 文件清单

| 文件 | 用途 |
| --- | --- |
| `low-altitude-risk-zones.geojson` | 低空风险区、禁飞/限高与规则 |
| `uav-takeoff-sites.geojson` | 无人机起降点、容量与就绪度 |
| `uav-task-records.json` | 无人机任务记录、成果、质量与耗电 |
| `uav-fleet-dispatch-plan.json` | 多无人机协同调度方案、编组与时序 |
| `uav-fleet-registry.json` | 机队注册表、机型与就绪度 |
| `uav-fleet-telemetry.json` | 多机统一时钟遥测与同步帧 |
| `uav-fleet-conflicts.json` | 空域冲突检测与消解记录 |
| `uav-telemetry.json` | 无人机飞行遥测轨迹点 |
| `hourly-flow-timeseries.json` | 小时级人流、车流与异常得分 |
| `business-vitality-daily.json` | 商圈日级活力、消费、夜间经济趋势 |
| `building-white-models.geojson` | 三维城市建筑白模 |
| `manifest.json` | 数据包清单 |

## 重新生成

```powershell
cd web
npm.cmd run generate:sim-wuhan
```
