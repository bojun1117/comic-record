<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { MangaCategory, MangaStatus } from '@/types/manga'
import { useMangaStore, type AddMangaInput } from '@/stores/manga'

const props = defineProps<{
  open: boolean
  // 鎖定 status:不顯示下拉、強制使用此值新增。給「他人推薦」入口用。
  lockStatus?: MangaStatus
}>()

const emit = defineEmits<{
  close: []
  added: []
}>()

const store = useMangaStore()

const title = ref('')
const status = ref<MangaStatus>('plan-to-read')
const category = ref<MangaCategory>('other')
const volumeStr = ref('')
const chapterStr = ref('')
const rating = ref<number | null>(null)
const submitting = ref(false)

const STATUS_OPTIONS: ReadonlyArray<{ value: MangaStatus; label: string }> = [
  { value: 'plan-to-read', label: '想看' },
  { value: 'reading', label: '追讀中' },
  { value: 'dropped', label: '棄追' },
  { value: 'completed', label: '已追完' },
]

const CATEGORY_OPTIONS: ReadonlyArray<{ value: MangaCategory; label: string }> = [
  { value: 'hot-blooded', label: '熱血' },
  { value: 'mystery', label: '懸疑' },
  { value: 'adventure', label: '冒險' },
  { value: 'romance', label: '愛情' },
  { value: 'casual', label: '輕鬆' },
  { value: 'competition', label: '競技' },
  { value: 'other', label: '其他' },
]

const isCompleted = computed(() => status.value === 'completed')
const isPlanToRead = computed(() => status.value === 'plan-to-read')
const titleTrimmed = computed(() => title.value.trim())
const canSubmit = computed(() => titleTrimmed.value.length > 0 && !submitting.value)
const dialogTitle = computed(() => (props.lockStatus === 'plan-to-read' ? '加入想看' : '新增漫畫'))

function reset() {
  title.value = ''
  status.value = props.lockStatus ?? 'plan-to-read'
  category.value = 'other'
  volumeStr.value = ''
  chapterStr.value = ''
  rating.value = null
  submitting.value = false
}

function close() {
  emit('close')
}

function parseNumberOrNull(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null
  return n
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true

  const isComp = status.value === 'completed'

  const input: AddMangaInput = {
    title: titleTrimmed.value,
    currentVolume: isComp ? null : parseNumberOrNull(volumeStr.value),
    currentChapter: isComp ? null : parseNumberOrNull(chapterStr.value),
    status: status.value,
    category: category.value,
    rating: isComp ? rating.value : null,
    coverUrl: null,
    notes: null,
  }

  try {
    await store.add(input)
    emit('added')
    reset()
    close()
  } catch (err) {
    console.error('add manga failed', err)
    submitting.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

// 開啟時重置欄位
watch(
  () => props.open,
  (v) => {
    if (v) reset()
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      @click.self="close"
    >
      <div
        role="dialog"
        aria-modal="true"
        class="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl"
      >
        <h2 class="m-0 text-lg font-semibold text-neutral-900">{{ dialogTitle }}</h2>

        <div class="mt-5 space-y-4">
          <!-- 書名 -->
          <div>
            <label for="add-title" class="block text-[13px] font-medium text-neutral-700">
              書名 <span class="text-red-500">*</span>
            </label>
            <input
              id="add-title"
              v-model="title"
              type="text"
              autofocus
              class="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="例如:進擊的巨人"
              @keydown.enter="submit"
            />
          </div>

          <!-- status:鎖定時(他人推薦入口)隱藏,強制 lockStatus -->
          <div v-if="!lockStatus">
            <label for="add-status" class="block text-[13px] font-medium text-neutral-700">
              狀態
            </label>
            <select
              id="add-status"
              v-model="status"
              class="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- category -->
          <div>
            <label for="add-category" class="block text-[13px] font-medium text-neutral-700">
              分類
            </label>
            <select
              id="add-category"
              v-model="category"
              class="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option v-for="opt in CATEGORY_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- 非 completed 且非 plan-to-read:卷 / 話 -->
          <div v-if="!isCompleted && !isPlanToRead" class="grid grid-cols-2 gap-3">
            <div>
              <label for="add-vol" class="block text-[13px] font-medium text-neutral-700">
                卷(可空)
              </label>
              <input
                id="add-vol"
                v-model="volumeStr"
                type="number"
                min="0"
                inputmode="numeric"
                class="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="—"
              />
            </div>
            <div>
              <label for="add-ch" class="block text-[13px] font-medium text-neutral-700">
                話(可空)
              </label>
              <input
                id="add-ch"
                v-model="chapterStr"
                type="number"
                min="0"
                inputmode="numeric"
                class="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="—"
              />
            </div>
          </div>

          <!-- completed:評分 -->
          <div v-else-if="isCompleted">
            <label class="block text-[13px] font-medium text-neutral-700">
              推薦指數(可空)
            </label>
            <div class="mt-1 flex items-center gap-1 text-2xl tracking-[2px]">
              <button
                v-for="n in 5"
                :key="n"
                type="button"
                class="cursor-pointer leading-none transition-transform hover:scale-110"
                :class="rating !== null && n <= rating ? 'text-amber-500' : 'text-neutral-300'"
                :title="rating === n ? '再次點擊清除' : `評為 ${n} 顆星`"
                @click="rating = rating === n ? null : n"
              >
                {{ rating !== null && n <= rating ? '★' : '☆' }}
              </button>
              <span class="ml-2 text-xs text-neutral-400">
                {{ rating === null ? '未評分' : `${rating} 顆星` }}
              </span>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition hover:bg-neutral-50"
            @click="close"
          >
            取消
          </button>
          <button
            type="button"
            class="rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canSubmit"
            @click="submit"
          >
            新增
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
