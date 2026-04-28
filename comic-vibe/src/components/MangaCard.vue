<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Manga, MangaStatus } from '@/types/manga'
import StatusBadge from '@/components/StatusBadge.vue'
import CategoryBadge from '@/components/CategoryBadge.vue'
import MangaCardEditableNumber from '@/components/MangaCardEditableNumber.vue'
import MangaCardRating from '@/components/MangaCardRating.vue'
import MangaCardActions from '@/components/MangaCardActions.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useMangaStore } from '@/stores/manga'
import { formatRelativeTime } from '@/utils/time'

const props = defineProps<{
  manga: Manga
}>()

const store = useMangaStore()

const isCompleted = computed(() => props.manga.status === 'completed')
const isDropped = computed(() => props.manga.status === 'dropped')
const isPlanToRead = computed(() => props.manga.status === 'plan-to-read')

const relativeTime = computed(() => formatRelativeTime(props.manga.lastReadAt))

const confirmDeleteOpen = ref(false)

async function updateVolume(next: number | null) {
  await store.update(props.manga.id, { currentVolume: next })
}

async function updateChapter(next: number | null) {
  await store.update(props.manga.id, { currentChapter: next })
}

async function updateRating(next: number | null) {
  await store.update(props.manga.id, { rating: next })
}

async function changeStatus(next: MangaStatus) {
  // 切 status 不影響其他欄位(進度、評分原封不動)
  await store.update(props.manga.id, { status: next })
}

function askDelete() {
  confirmDeleteOpen.value = true
}

async function confirmDelete() {
  confirmDeleteOpen.value = false
  await store.remove(props.manga.id)
}
</script>

<template>
  <div
    class="group relative rounded-lg border border-neutral-200 bg-white px-5 py-4 transition-opacity"
    :class="{ 'opacity-75 hover:opacity-100': isDropped }"
  >
    <!-- 標題列 + badge + actions -->
    <div class="mb-3 flex items-start justify-between gap-2">
      <p class="m-0 text-[15px] font-medium leading-tight text-neutral-900">
        {{ manga.title }}
      </p>
      <div class="flex items-center gap-1">
        <CategoryBadge :category="manga.category" />
        <StatusBadge :status="manga.status" />
        <MangaCardActions
          :current-status="manga.status"
          @change-status="changeStatus"
          @delete="askDelete"
        />
      </div>
    </div>

    <!-- 中段:completed 顯示評分;plan-to-read 不顯示中段;其他顯示卷/話 -->
    <template v-if="isCompleted">
      <div class="mb-2.5 flex min-h-[56px] flex-col items-start justify-center gap-1">
        <span class="text-xs text-neutral-500">推薦指數</span>
        <MangaCardRating :rating="manga.rating" @update="updateRating" />
      </div>
    </template>

    <template v-else-if="!isPlanToRead">
      <div class="mb-2.5 flex min-h-[56px] flex-col gap-1.5">
        <div class="flex items-center gap-2 text-[13px]">
          <span class="w-7 text-neutral-500">卷</span>
          <MangaCardEditableNumber
            :value="manga.currentVolume"
            label="卷"
            @update="updateVolume"
          />
        </div>
        <div class="flex items-center gap-2 text-[13px]">
          <span class="w-7 text-neutral-500">話</span>
          <MangaCardEditableNumber
            :value="manga.currentChapter"
            label="話"
            @update="updateChapter"
          />
        </div>
      </div>
    </template>

    <!-- 底部 -->
    <div class="border-t border-neutral-200 pt-2.5">
      <span class="text-xs text-neutral-500">{{ relativeTime }}</span>
    </div>

    <ConfirmDialog
      :open="confirmDeleteOpen"
      title="刪除確認"
      :message="`確定刪除《${manga.title}》?`"
      confirm-label="刪除"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="confirmDeleteOpen = false"
    />
  </div>
</template>
