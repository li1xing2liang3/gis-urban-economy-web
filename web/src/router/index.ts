import { createRouter, createWebHistory } from 'vue-router';

import MainLayout from '@/layouts/MainLayout.vue';

import FleetDispatchLayout from '@/layouts/FleetDispatchLayout.vue';



const router = createRouter({

  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [

    {

      path: '/',

      name: 'home',

      component: () => import('@/views/HomeView.vue'),

      meta: { title: 'AI+GIS 城市低空经济驱动的城市经济空间展示平台（融合武汉智眼）' },

    },

    {

      path: '/fleet-dispatch',

      component: FleetDispatchLayout,

      children: [

        {

          path: '',

          name: 'fleet-home',

          component: () => import('@/views/fleet/FleetAppHomeView.vue'),

          meta: { title: '多无人机协同调度 · 应用首页' },

        },

        {

          path: 'workspace',

          name: 'fleet-workspace',

          component: () => import('@/views/fleet/FleetDispatchWorkspaceView.vue'),

          meta: { title: '调度工作台' },

        },

        {

          path: 'scenarios',

          name: 'fleet-scenarios',

          component: () => import('@/views/fleet/FleetScenariosView.vue'),

          meta: { title: '协同方案库' },

        },

      ],

    },

    {

      path: '/',

      component: MainLayout,

      children: [

        {

          path: 'overview',

          name: 'overview',

          component: () => import('@/views/OverviewView.vue'),

          meta: { title: '城市经济空间总览' },

        },

        {

          path: 'scene3d',

          name: 'scene3d',

          component: () => import('@/views/Scene3DView.vue'),

          meta: { title: '三维城市与经济空间' },

        },

        {

          path: 'vitality',

          name: 'vitality',

          component: () => import('@/views/VitalityView.vue'),

          meta: { title: '经济活力与商业分析' },

        },

        {

          path: 'districts',

          name: 'districts',

          component: () => import('@/views/BusinessDistrictView.vue'),

          meta: { title: '商圈识别与结构地图' },

        },

        {

          path: 'population',

          name: 'population',

          component: () => import('@/views/PopulationView.vue'),

          meta: { title: '人口密度与消费潜力' },

        },

        {

          path: 'dynamics',

          name: 'dynamics',

          component: () => import('@/views/DynamicsView.vue'),

          meta: { title: '经济动态与时序分析' },

        },

        {

          path: 'lowaltitude',

          name: 'lowaltitude',

          component: () => import('@/views/LowAltitudeView.vue'),

          meta: { title: '低空数据增强中心' },

        },

      ],

    },

    {

      path: '/uav-fleet',

      redirect: '/fleet-dispatch/workspace',

    },

  ],

});



export default router;


