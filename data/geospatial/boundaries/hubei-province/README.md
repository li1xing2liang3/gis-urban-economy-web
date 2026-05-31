# 湖北省界 · 原始 Shapefile

将 **完整的** `湖北省.shp` 同套文件（`.shx`、`.dbf`、`.prj`，以及可选的 `.cpg`、`.sbn`、`.sbx`）放在本目录。

前端不直接读取此处路径，需同步到 `web/public/geo/hubei/`（英文名 `hubei.*`）。在仓库根目录执行：

```bash
node scripts/sync-hubei-to-web-public.mjs
```

或在 `web` 目录执行：`npm run sync:geo`

更新省界数据后：**先替换本目录中的文件，再执行上述同步命令**，然后刷新浏览器。
