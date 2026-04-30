<script setup lang="ts">
import { computed } from 'vue'
import type { MangaCategory } from '@/types/manga'

const props = defineProps<{
  category: MangaCategory
}>()

const CATEGORY_LABEL: Record<MangaCategory, string> = {
  'hot-blooded': '熱血',
  mystery: '懸疑',
  adventure: '冒險',
  romance: '愛情',
  casual: '輕鬆',
  competition: '競技',
  other: '其他',
}

// 用比 StatusBadge 更柔和的色階,避免兩個 badge 互搶
const CATEGORY_CLASS: Record<MangaCategory, string> = {
  'hot-blooded': 'bg-orange-50 text-orange-700',
  mystery: 'bg-violet-50 text-violet-700',
  adventure: 'bg-emerald-50 text-emerald-700',
  romance: 'bg-pink-50 text-pink-700',
  casual: 'bg-sky-50 text-sky-700',
  competition: 'bg-amber-50 text-amber-700',
  other: 'bg-neutral-100 text-neutral-600',
}

const label = computed(() => CATEGORY_LABEL[props.category])
const klass = computed(() => CATEGORY_CLASS[props.category])
</script>

<template>
  <span
    :class="klass"
    class="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
  >
    {{ label }}
  </span>
</template>
