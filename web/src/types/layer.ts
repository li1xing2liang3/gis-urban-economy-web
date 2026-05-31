export type DataProvenance = '智眼' | '无人机' | 'POI' | '多源' | '模型' | '演示';

export type LayerItem = {
  id: string;
  name: string;
  visible: boolean;
  opacity?: number;
  dataSource: DataProvenance;
  /** 指标说明 */
  metric: string;
  /** 分级规则 */
  rule: string;
  /** 单位 */
  unit: string;
};
