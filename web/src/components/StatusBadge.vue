<script setup lang="ts">
import { computed } from 'vue'
import type { MangaStatus } from '@/types/manga'

const props = defineProps<{
  status: MangaStatus
}>()

const STATUS_LABEL: Record<MangaStatus, string> = {
  'plan-to-read': '想看',
  reading: '追讀中',
  dropped: '棄追',
  completed: '已追完',
}

// UI_SPEC.md 的色階對應
const STATUS_CLASS: Record<MangaStatus, string> = {
  'plan-to-read': 'bg-neutral-100 text-neutral-600',
  reading: 'bg-blue-50 text-blue-700',
  dropped: 'bg-red-50 text-red-700',
  completed: 'bg-green-50 text-green-700',
}

const label = computed(() => STATUS_LABEL[props.status])
const klass = computed(() => STATUS_CLASS[props.status])
</script>

<template>
  <span
    :class="klass"
    class="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
  >
    {{ label }}
  </span>
</template>
