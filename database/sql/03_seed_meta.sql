SET search_path TO gis, public;

INSERT INTO data_sources (id, label, description) VALUES
  ('v2026Q1', '2026Q1·模拟切片', '演示用时间切片标签'),
  ('v2025Q4', '2025Q4·模拟切片', '演示用时间切片标签'),
  ('demo-mix', '混编·演示', '多源混编演示版本')
ON CONFLICT (id) DO NOTHING;

INSERT INTO layer_catalog (id, name, data_source, table_name, geom_type, metric, rule_text, unit, sort_order) VALUES
  ('dem', 'DEM / 地形', '多源', NULL, NULL, '高程、坡度', '5 类色带：低地 → 台地', '米 (m)', 10),
  ('buildings', '建筑高度', '智眼', NULL, NULL, '建筑体块高度/体量', '分位数分级', '米 (m)', 20),
  ('roads', '道路网络', '多源', NULL, NULL, '路等级与连通度', '主/次/支 三级线宽', '—', 30),
  ('poi', 'POI 商业', 'POI', 'poi_points', 'Point', '商业 POI 密度/业态', '按业态聚合分级', '个/km²', 40),
  ('pop', '人口密度', '智眼', 'city_units', 'Polygon', '人口密度示意', '分位数 5 级', '人/km²', 50),
  ('vitality', '经济活力分布（模型）', '模型', 'city_units', 'Polygon', '综合活力指数', '0–100 五类色带', '指数', 60),
  ('uav', '无人机成果', '无人机', NULL, NULL, '航测/倾斜模型覆盖', '按采集批次', '—', 70),
  ('hubei-province', '湖北省界', '多源', 'admin_boundaries', 'MultiPolygon', '省级行政界', '边界线', '—', 5),
  ('hubei-cities', '市州单元（演示）', '演示', 'city_units', 'Polygon', '各地市示意面与合成指标', '按 vitality_idx 分级', '—', 15)
ON CONFLICT (id) DO NOTHING;
