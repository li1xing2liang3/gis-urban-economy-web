<template>

  <div v-if="gis.tasks.length" class="strip panel">

    <div class="head">

      <span class="head-tag mono">JOB</span>

      <span class="head-title">分析任务队列</span>

      <span class="head-sub mono">ASYNC · LOCAL</span>

    </div>

    <ul>

      <li v-for="t in gis.tasks" :key="t.id" class="row">

        <span :class="['st', 'mono', t.status]">{{ statusLabel(t.status) }}</span>

        <span class="name">{{ t.name }}</span>

        <span v-if="t.message" class="msg mono">{{ t.message }}</span>

        <button

          v-if="t.status === 'success' && !t.saved"

          type="button"

          class="btn btn-ghost mini"

          @click="save(t.id)"

        >

          固化

        </button>

        <span v-else-if="t.status === 'success' && t.saved" class="saved mono">PERSISTED</span>

      </li>

    </ul>

  </div>

</template>



<script setup lang="ts">

import type { AnalysisTask } from '@/types/gis';

import { gis, updateTask } from '@/stores/gisState';



function statusLabel(s: AnalysisTask['status']): string {

  if (s === 'running') return 'RUN';

  if (s === 'success') return 'OK';

  if (s === 'error') return 'ERR';

  if (s === 'idle') return '—';

  return s;

}

function save(id: string) {

  updateTask(id, { saved: true });

}

</script>



<style scoped>

.strip {

  margin: 0 8px 0;

  padding: 8px 12px 10px;

  font-size: 11px;

  max-height: 130px;

  overflow: auto;

  border: 1px solid rgba(129, 140, 248, 0.2);

  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);

}



.head {

  display: flex;

  align-items: center;

  gap: 10px;

  margin-bottom: 8px;

  padding-bottom: 6px;

  border-bottom: 1px solid rgba(56, 189, 248, 0.15);

}



.head-tag {

  font-size: 9px;

  letter-spacing: 0.2em;

  padding: 2px 6px;

  border-radius: 4px;

  border: 1px solid rgba(56, 189, 248, 0.35);

  color: var(--accent);

  background: rgba(56, 189, 248, 0.08);

}



.head-title {

  font-weight: 700;

  font-size: 12px;

  letter-spacing: 0.08em;

}



.head-sub {

  margin-left: auto;

  font-size: 9px;

  letter-spacing: 0.15em;

  color: var(--text-muted);

}



ul {

  list-style: none;

  margin: 0;

  padding: 0;

}



.row {

  display: flex;

  flex-wrap: wrap;

  align-items: center;

  gap: 8px;

  margin-bottom: 5px;

  padding: 6px 8px 6px 10px;

  border-radius: 6px;

  background: rgba(15, 23, 42, 0.45);

  border-left: 3px solid rgba(71, 96, 124, 0.5);

}



.row:last-child {

  margin-bottom: 0;

}



.st {

  min-width: 36px;

  text-align: center;

  font-size: 9px;

  letter-spacing: 0.06em;

  border-radius: 4px;

  padding: 3px 6px;

  border: 1px solid var(--border);

}



.st.running {

  color: var(--accent-hot);

  border-color: rgba(251, 191, 36, 0.45);

  box-shadow: 0 0 10px rgba(251, 191, 36, 0.12);

}



.st.success {

  color: var(--success);

  border-color: rgba(52, 211, 153, 0.45);

}



.st.error {

  color: var(--danger);

  border-color: rgba(248, 113, 113, 0.45);

}



.name {

  color: var(--text);

  font-size: 12px;

  font-weight: 500;

}



.msg {

  color: var(--text-muted);

  font-size: 10px;

  flex: 1 1 100%;

  opacity: 0.9;

}



.mini {

  padding: 3px 10px;

  font-size: 10px;

  border-radius: 4px;

}



.saved {

  font-size: 9px;

  letter-spacing: 0.12em;

  color: var(--success);

}



.mono {

  font-family: var(--font-mono, ui-monospace, monospace);

}

</style>


