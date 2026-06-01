# 数据目录

本目录存放**非前端代码**的空间与业务原始数据，按类型分子目录，便于版本管理与协作说明。

| 路径 | 说明 |
|------|------|
| `geospatial/boundaries/china-gadm41/` | [GADM](https://www.gadm.org/) 中国行政区原始 **Shapefile**（0–3 级，`gadm41_CHN_*`） |
| `geospatial/boundaries/hubei-province/` | 湖北省界 **Shapefile**（`湖北省.*`，由 GADM 1 级提取）。更新后请运行 `node scripts/sync-hubei-to-web-public.mjs` 同步到 `web/public/geo/hubei/` |
| `geospatial/boundaries/hubei-cities/` | 湖北省市州界 **GeoJSON**（`cities.geojson`，由 GADM 2 级提取） |

从 GADM 更新省界：在 `database/` 目录执行 `npm run process:gadm`，再执行上述同步命令。

后续可扩展例如：`geospatial/admin/`（市、区、街道）、`rasters/`（DEM、人口栅格）、`samples/`（脱敏样例）等，并在各子目录补充 `README.md` 说明来源与坐标系。
