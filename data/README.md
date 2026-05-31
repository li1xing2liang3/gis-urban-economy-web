# 数据目录

本目录存放**非前端代码**的空间与业务原始数据，按类型分子目录，便于版本管理与协作说明。

| 路径 | 说明 |
|------|------|
| `geospatial/boundaries/hubei-province/` | 湖北省界 **Shapefile**（`湖北省.*`）。更新后请运行仓库根目录的 `node scripts/sync-hubei-to-web-public.mjs`，同步到 `web/public/geo/hubei/`。 |

后续可扩展例如：`geospatial/admin/`（市、区、街道）、`rasters/`（DEM、人口栅格）、`samples/`（脱敏样例）等，并在各子目录补充 `README.md` 说明来源与坐标系。
