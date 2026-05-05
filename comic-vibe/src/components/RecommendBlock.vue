<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMangaStore } from '@/stores/manga'
import { getRecommendationsApi } from '@/api/recommendations'

const auth = useAuthStore()
const store = useMangaStore()

const PROMPT_MAX_LEN = 200

const QUICK_PROMPTS: ReadonlyArray<{ label: string; prompt: string }> = [
  { label: '推薦最近完結漫畫', prompt: '推薦 5 部最近 5 年內完結、評價良好的漫畫' },
  { label: '推薦熱血漫畫', prompt: '推薦 5 部熱血類型的經典或近期漫畫' },
  { label: '推薦2025年度排行榜漫畫', prompt: '推薦 5 部 2025 年度排行榜上的人氣漫畫' },
]

const inputText = ref('')
const lastSubmittedPrompt = ref<string | null>(null)
const recommendations = ref<string[]>([])
const seenForCurrent = ref<string[]>([])
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const adding = ref<string | null>(null)

async function generate(prompt: string) {
  const trimmed = prompt.trim()
  if (!trimmed || loading.value) return
  if (trimmed.length > PROMPT_MAX_LEN) {
    errorMsg.value = `輸入不能超過 ${PROMPT_MAX_LEN} 字`
    return
  }

  loading.value = true
  errorMsg.value = null

  // 換 prompt 就重置 seen 清單;同 prompt 連點 = 「再來 5 個」會把上輪結果排除
  if (lastSubmittedPrompt.value !== trimmed) {
    seenForCurrent.value = []
    recommendations.value = []
  }
  lastSubmittedPrompt.value = trimmed

  const token = auth.getToken()
  if (!token) {
    errorMsg.value = '尚未登入'
    loading.value = false
    return
  }

  try {
    const titles = await getRecommendationsApi(trimmed, seenForCurrent.value, token)
    if (titles.length === 0) {
      errorMsg.value = '找不到符合的漫畫,試試換個說法'
      recommendations.value = []
    } else {
      recommendations.value = titles
      seenForCurrent.value = [...seenForCurrent.value, ...titles].slice(-50)
    }
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '推薦失敗'
  } finally {
    loading.value = false
  }
}

function pickQuickPrompt(prompt: string) {
  inputText.value = prompt
  generate(prompt)
}

function submitInput() {
  generate(inputText.value)
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
    // store 已 record error 進 lastError(toast 會顯示)
  } finally {
    adding.value = null
  }
}
</script>

<template>
  <section class="mt-10">
    <div class="mb-4 flex items-center gap-3 border-t border-neutral-200 pt-6">
      <h2 class="m-0 text-lg font-semibold text-neutral-900">AI 推薦</h2>
      <span class="text-[12px] text-neutral-400">
        點 chip 或自由輸入,加入後存進「他人推薦」
      </span>
    </div>

    <!-- 自由輸入 -->
    <form class="mb-3 flex gap-2" @submit.prevent="submitInput">
      <input
        v-model="inputText"
        type="text"
        :maxlength="PROMPT_MAX_LEN"
        :disabled="loading"
        placeholder="例如:治癒系日常、輕小說改編、1990 年代經典..."
        class="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-neutral-900 placeholder-neutral-400 transition focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:bg-neutral-50"
      />
      <button
        type="submit"
        :disabled="loading || inputText.trim().length === 0"
        class="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        生成
      </button>
    </form>

    <!-- 快速 chip -->
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="q in QUICK_PROMPTS"
        :key="q.label"
        type="button"
        :disabled="loading"
        class="rounded-full border px-3 py-1.5 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-60"
        :class="
          lastSubmittedPrompt === q.prompt && !loading
            ? 'border-neutral-900 bg-neutral-900 text-white'
            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
        "
        @click="pickQuickPrompt(q.prompt)"
      >
        {{ lastSubmittedPrompt === q.prompt && !loading ? `${q.label}(再來 5 個)` : q.label }}
      </button>
    </div>

    <!-- 結果 -->
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
      {{ errorMsg }}
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
      <p class="text-sm text-neutral-500">點上方 chip 或自己打字取得 AI 推薦</p>
    </div>
  </section>
</template>
