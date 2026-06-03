# 武汉 DEM 数据

| 文件 | 说明 |
|------|------|
| `HillShadeWH.tif` | 山体阴影（**推荐**用于二维地图叠加） |
| `HillShadeWH.tfw` | 世界文件（WGS84 地理坐标） |
| `WuhanDEM84.tif` | 高程栅格（84 坐标系） |
| `WuHanDEM.tif` | 高程栅格 |

## 前端使用

在 `web/` 目录执行：

```bash
npm run prepare:wuhan-dem
```

输出：

- `web/public/geo/wuhan/hillshade.png`
- `web/public/geo/wuhan/hillshade.meta.json`

空间总览页勾选 **「DEM / 地形」** 图层即可在 Leaflet 上看到山体阴影叠加。

若更新了 `data/geospatial/WuHanDEM/` 下的 tif，请重新运行上述命令。
