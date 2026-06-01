# GADM 中国行政区 · v4.1

本目录存放从 [GADM](https://www.gadm.org/) 下载的中国行政区划 **Shapefile**（`gadm41_CHN_*`）。

| 文件 | 行政级别 | 说明 |
|------|----------|------|
| `gadm41_CHN_0.*` | 0 级 | 国界（含港澳台等多块） |
| `gadm41_CHN_1.*` | 1 级 | 省 / 自治区 / 直辖市（37 条） |
| `gadm41_CHN_2.*` | 2 级 | 地级市 / 自治州 / 盟等（368 条） |
| `gadm41_CHN_3.*` | 3 级 | 县级（2421 条） |

- **坐标系：** WGS 84（`.prj` 为 GEOGCS WGS 1984）
- **编码：** UTF-8（`.cpg`）
- **许可：** GADM 数据仅供非商业用途，使用前请阅读 [GADM 许可说明](https://www.gadm.org/license.html)

## 更新流程

1. 从 GADM 下载最新 `CHN` shapefile，解压后将 `gadm41_CHN_*.shp` 及同套文件放入本目录（覆盖旧文件）。
2. 在 `database/` 目录执行：

```bash
npm run process:gadm
```

3. 在仓库根目录同步省界到前端可读路径：

```bash
node scripts/sync-hubei-to-web-public.mjs
```

脚本会从 **1 级** 提取湖北省界写入 `../hubei-province/湖北省.*`，从 **2 级** 提取市州面写入 `../hubei-cities/cities.geojson`。
