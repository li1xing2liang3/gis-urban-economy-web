import { onMounted, ref } from 'vue';
import { gisDataService } from '@/services/gisDataService';
import { fleetDispatchScenarios as fallbackScenarios } from '@/config/uavFleetScenarios';
import type { FleetDispatchPlanFile, FleetDispatchScenario } from '@/types/uavFleet';

export function useFleetDispatchPlans() {
  const loading = ref(true);
  const error = ref<string | null>(null);
  const meta = ref<FleetDispatchPlanFile['meta'] | null>(null);
  const scenarios = ref<FleetDispatchScenario[]>([...fallbackScenarios]);

  onMounted(async () => {
    try {
      const plan = await gisDataService.getFleetDispatchPlans();
      if (plan?.scenarios?.length) {
        scenarios.value = plan.scenarios;
        meta.value = plan.meta;
      }
    } catch (err) {
      console.warn('[Fleet] failed to load uav-fleet-dispatch-plan.json; using fallback config', err);
      error.value = '编队方案 JSON 加载失败，已使用内置演示数据';
    } finally {
      loading.value = false;
    }
  });

  return { loading, error, meta, scenarios };
}
