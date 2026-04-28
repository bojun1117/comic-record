<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMangaStore } from '@/stores/manga'
import { getRecommendationsApi, type PresetId } from '@/api/recommendations'

const auth = useAuthStore()
const store = useMangaStore()

const PRESETS: ReadonlyArray<{ id: PresetId; label: string }> = [
  { id: 'recently-completed', label: '推薦最近完結漫畫' },
  { id: 'hot-blooded', label: '推薦熱血漫畫' },
]

const activePreset = ref<PresetId | null>(null)
const recommendations = ref<string[]>([])
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const adding = ref<string | null>(null)

// 每個 preset 各自記下「已出現過」的書名,點同一 chip 再來 5 個時送給 LLM 排除
const seenByPreset = ref<Record<PresetId, string[]>>({
  'recently-completed': [],
  'hot-blooded': [],
})

async function generate(presetId: PresetId) {
  if (loading.value) return
  loading.value = true
  errorMsg.value = null
  activePreset.value = presetId
  recommendations.value = []

  const token = auth.getToken()
  if (!token) {
    errorMsg.value = '尚未登入'
    loading.value = false
    return
  }

  try {
    const titles = await getRecommendationsApi(presetId, seenByPreset.value[presetId], token)
    recommendations.value = titles
    seenByPreset.value[presetId] = [
      ...seenByPreset.value[presetId],
      ...titles,
    ].slice(-50) // 上限 50 個避免 prompt 撐爆
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '推薦失敗'
  } finally {
    loading.value = false
  }
}

async function addToWishlist(title: string) {
  if (adding.value) return
  adding.value = title
  try {
    await store.add({
      title,
      currentVolume: null,
      currentChapter: null,
      status: 'plan-to-read',
      category: 'other',
      rating: null,
      coverUrl: null,
      notes: null,
    })
    // 加入後從目前列表拿掉,但保留在 seen,下次 LLM 不會再推
    recommendations.value = recommendations.value.filter((t) => t !== title)
  } catch {
    // store 已經 record error 進 lastError(toast 會顯示)
  } finally {
    adding.value = null
  }
}
</script>

<template>
  <section class="mt-10">
    <div class="mb-4 flex items-center gap-3 border-t border-neutral-200 pt-6">
      <h2 class="m-0 text-lg font-semibold text-neutral-900">AI 推薦</h2>
      <span class="text-[12px] text-neutral-400">點下方 chip 取得 5 部推薦,加入後存進「他人推薦」</span>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="p in PRESETS"
        :key="p.id"
        type="button"
        :disabled="loading"
        class="rounded-full border px-3 py-1.5 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-60"
        :class="
          activePreset === p.id
            ? 'border-neutral-900 bg-neutral-900 text-white'
            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
        "
        @click="generate(p.id)"
      >
        {{ activePreset === p.id && !loading ? `${p.label}(再來 5 個)` : p.label }}
      </button>
    </div>

    <div
      v-if="loading"
      class="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500"
    >
      <span class="inline-block animate-pulse">產生中...</span>
    </div>

    <div
      v-else-if="errorMsg"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      推薦失敗:{{ errorMsg }}
    </div>

    <ul
      v-else-if="recommendations.length > 0"
      class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white"
    >
      <li
        v-for="title in recommendations"
        :key="title"
        class="flex items-center justify-between gap-3 px-4 py-3"
      >
        <span class="text-[14px] text-neutral-900">{{ title }}</span>
        <button
          type="button"
          :disabled="adding === title"
          class="shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[12px] font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          @click="addToWishlist(title)"
        >
          {{ adding === title ? '加入中...' : '＋ 加入想看' }}
        </button>
      </li>
    </ul>

    <div
      v-else
      class="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center"
    >
      <p class="text-sm text-neutral-500">點上方 chip 取得 AI 推薦</p>
    </div>
  </section>
</template>
