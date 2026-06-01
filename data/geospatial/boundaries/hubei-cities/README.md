# 湖北省市州界 · GADM 提取

本目录存放从 `../china-gadm41/` **2 级**区划中提取的湖北省内地级单元 GeoJSON。

| 文件 | 说明 |
|------|------|
| `cities.geojson` | 17 个市州 / 省直管县级单位（GADM v4.1） |

属性字段含 `name`（中文）、`adcode`（国标代码，能映射时）、`GADM_GID` 等。

**重新生成：** 在 `database/` 目录执行 `npm run process:gadm`，再按需同步省界到 `web/public/geo/hubei/`。

当前前端演示用的 `city-units.geojson` 仍为脚本生成的模拟圆/多边形；后续可改为读取本目录真实市界。
