<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { MangaStatus } from '@/types/manga'

defineProps<{
  currentStatus: MangaStatus
}>()

const emit = defineEmits<{
  changeStatus: [status: MangaStatus]
  delete: []
}>()

const open = ref(false)
const submenuOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const STATUS_OPTIONS: ReadonlyArray<{ value: MangaStatus; label: string }> = [
  { value: 'plan-to-read', label: '想看' },
  { value: 'reading', label: '追讀中' },
  { value: 'dropped', label: '棄追' },
  { value: 'completed', label: '已追完' },
]

function toggle(e: MouseEvent) {
  e.stopPropagation()
  open.value = !open.value
  submenuOpen.value = false
}

function close() {
  open.value = false
  submenuOpen.value = false
}

function pickStatus(s: MangaStatus) {
  emit('changeStatus', s)
  close()
}

function clickDelete() {
  emit('delete')
  close()
}

function onClickOutside(e: MouseEvent) {
  if (!rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) {
    close()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
      title="更多動作"
      @click="toggle"
    >
      <span class="leading-none">⋯</span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-7 z-20 w-36 rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
    >
      <!-- 切換狀態(展開子選單) -->
      <button
        type="button"
        class="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] text-neutral-700 hover:bg-neutral-50"
        @click.stop="submenuOpen = !submenuOpen"
      >
        <span>切換狀態</span>
        <span class="text-neutral-400">›</span>
      </button>

      <div v-if="submenuOpen" class="border-t border-neutral-100 bg-neutral-50">
        <button
          v-for="opt in STATUS_OPTIONS"
          :key="opt.value"
          type="button"
          class="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] hover:bg-white"
          :class="opt.value === currentStatus ? 'text-neutral-400' : 'text-neutral-700'"
          :disabled="opt.value === currentStatus"
          @click.stop="pickStatus(opt.value)"
        >
          <span>{{ opt.label }}</span>
          <span v-if="opt.value === currentStatus" class="text-xs">目前</span>
        </button>
      </div>

      <div class="my-1 border-t border-neutral-100"></div>

      <!-- 刪除 -->
      <button
        type="button"
        class="block w-full px-3 py-1.5 text-left text-[13px] text-red-600 hover:bg-red-50"
        @click.stop="clickDelete"
      >
        刪除
      </button>
    </div>
  </div>
</template>
