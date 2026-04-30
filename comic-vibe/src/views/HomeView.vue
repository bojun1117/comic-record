<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import type { MangaCategory, MangaStatus } from '@/types/manga'
import { useAuthStore } from '@/stores/auth'
import { useMangaStore } from '@/stores/manga'
import MangaCard from '@/components/MangaCard.vue'
import AddMangaModal from '@/components/AddMangaModal.vue'
import AppToast from '@/components/AppToast.vue'
import RecommendBlock from '@/components/RecommendBlock.vue'

const router = useRouter()
const auth = useAuthStore()
const store = useMangaStore()
const { mangas, loading, loaded, lastError } = storeToRefs(store)

const addModalOpen = ref(false)
const wishlistModalOpen = ref(false)

// 排除 plan-to-read:想看獨立到「他人推薦」block,主 grid 不顯示
type StatusFilter = 'all' | Exclude<MangaStatus, 'plan-to-read'>
type CategoryFilter = 'all' | MangaCategory

const activeStatus = ref<StatusFilter>('all')
const activeCategory = ref<CategoryFilter>('all')
const searchQuery = ref('')

const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'reading', label: '追讀中' },
  { value: 'dropped', label: '棄追' },
  { value: 'completed', label: '已追完' },
]

const CATEGORY_FILTERS: ReadonlyArray<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'hot-blooded', label: '熱血' },
  { value: 'mystery', label: '懸疑' },
  { value: 'adventure', label: '冒險' },
  { value: 'romance', label: '愛情' },
  { value: 'casual', label: '輕鬆' },
  { value: 'competition', label: '競技' },
  { value: 'other', label: '其他' },
]

const sortedMangas = computed(() =>
  [...mangas.value].sort(
    (a, b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime(),
  ),
)

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

// 共用條件:分類 chips + 搜尋,套用到「我的漫畫」與「他人推薦」兩 block
function matchesSharedFilters(m: { title: string; category: MangaCategory }): boolean {
  const categoryOk = activeCategory.value === 'all' || m.category === activeCategory.value
  const queryOk =
    normalizedQuery.value === '' || m.title.toLowerCase().includes(normalizedQuery.value)
  return categoryOk && queryOk
}

// 主 grid:排除 plan-to-read,加 status chips
const visibleMangas = computed(() =>
  sortedMangas.value.filter((m) => {
    if (m.status === 'plan-to-read') return false
    const statusOk = activeStatus.value === 'all' || m.status === activeStatus.value
    return statusOk && matchesSharedFilters(m)
  }),
)

// 他人推薦 block:只 plan-to-read,不受 status chips 影響
const wishlistMangas = computed(() =>
  sortedMangas.value.filter((m) => m.status === 'plan-to-read' && matchesSharedFilters(m)),
)

const stats = computed(() => {
  const total = mangas.value.length
  const reading = mangas.value.filter((m) => m.status === 'reading').length
  const completed = mangas.value.filter((m) => m.status === 'completed').length
  const dropped = mangas.value.filter((m) => m.status === 'dropped').length
  const planToRead = mangas.value.filter((m) => m.status === 'plan-to-read').length
  return { total, reading, completed, dropped, planToRead }
})

onMounted(async () => {
  // 已登入但還沒拿過資料 → 載入
  if (auth.isAuthenticated && !loaded.value) {
    try {
      await store.getAll()
    } catch {
      // ApiException 已被 store 接住記錄,401 會自動 logout → 路由守衛踢回 login
      if (!auth.isAuthenticated) {
        router.replace({ name: 'login' })
      }
    }
  }
})

function logout() {
  auth.logout()
  store.reset()
  router.replace({ name: 'login' })
}
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-8">
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 class="m-0 text-2xl font-semibold text-neutral-900">我的漫畫</h1>
        <p class="mt-1 text-[13px] text-neutral-500">
          共 {{ stats.total }} 部 · 追讀中 {{ stats.reading }} · 已追完
          {{ stats.completed }} · 棄追 {{ stats.dropped }} · 想看 {{ stats.planToRead }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="addModalOpen = true"
        >
          ＋ 新增漫畫
        </button>
        <button
          type="button"
          class="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="wishlistModalOpen = true"
        >
          ＋ 別人推薦
        </button>
        <button
          type="button"
          class="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-500 transition hover:bg-neutral-50"
          @click="logout"
        >
          登出
        </button>
      </div>
    </div>

    <!-- 搜尋 -->
    <div class="mb-3">
      <label class="relative block">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          🔍
        </span>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="搜尋漫畫名稱..."
          aria-label="搜尋漫畫名稱"
          class="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-9 text-[14px] text-neutral-800 placeholder-neutral-400 transition focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        />
        <button
          v-if="searchQuery"
          type="button"
          aria-label="清除搜尋"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
          @click="searchQuery = ''"
        >
          ✕
        </button>
      </label>
    </div>

    <!-- 狀態篩選 -->
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <span class="text-[12px] text-neutral-400">狀態</span>
      <button
        v-for="f in STATUS_FILTERS"
        :key="f.value"
        type="button"
        class="rounded-full border px-3 py-1 text-[13px] transition"
        :class="
          activeStatus === f.value
            ? 'border-neutral-900 bg-neutral-900 text-white'
            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
        "
        @click="activeStatus = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- 分類篩選 -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="text-[12px] text-neutral-400">分類</span>
      <button
        v-for="f in CATEGORY_FILTERS"
        :key="f.value"
        type="button"
        class="rounded-full border px-3 py-1 text-[13px] transition"
        :class="
          activeCategory === f.value
            ? 'border-neutral-900 bg-neutral-900 text-white'
            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
        "
        @click="activeCategory = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- loading skeleton -->
    <div
      v-if="loading && !loaded"
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="h-[160px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100"
      ></div>
    </div>

    <template v-else>
      <!-- 主 grid:我的漫畫(不含想看) -->
      <div
        v-if="visibleMangas.length > 0"
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))"
      >
        <MangaCard v-for="manga in visibleMangas" :key="manga.id" :manga="manga" />
      </div>
      <div
        v-else
        class="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center"
      >
        <p v-if="mangas.length === 0" class="text-sm text-neutral-500">
          還沒有任何漫畫,點右上「＋ 新增漫畫」開始記錄。
        </p>
        <p v-else-if="normalizedQuery !== ''" class="text-sm text-neutral-500">
          沒有符合「{{ searchQuery.trim() }}」的漫畫。
        </p>
        <p v-else class="text-sm text-neutral-500">這個篩選條件下沒有漫畫。</p>
      </div>

      <!-- 他人推薦 block -->
      <section class="mt-10">
        <div class="mb-4 flex items-center gap-3 border-t border-neutral-200 pt-6">
          <h2 class="m-0 text-lg font-semibold text-neutral-900">他人推薦</h2>
          <span class="text-[13px] text-neutral-500">{{ wishlistMangas.length }} 部</span>
        </div>

        <div
          v-if="wishlistMangas.length > 0"
          class="grid gap-3"
          style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))"
        >
          <MangaCard v-for="manga in wishlistMangas" :key="manga.id" :manga="manga" />
        </div>
        <div
          v-else
          class="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center"
        >
          <p v-if="normalizedQuery !== ''" class="text-sm text-neutral-500">
            沒有符合「{{ searchQuery.trim() }}」的推薦。
          </p>
          <p v-else class="text-sm text-neutral-500">
            還沒有別人推薦的漫畫,點右上「＋ 別人推薦」記錄。
          </p>
        </div>
      </section>

      <!-- AI 推薦 block -->
      <RecommendBlock />
    </template>

    <AddMangaModal
      :open="addModalOpen"
      @close="addModalOpen = false"
      @added="addModalOpen = false"
    />
    <AddMangaModal
      :open="wishlistModalOpen"
      lock-status="plan-to-read"
      @close="wishlistModalOpen = false"
      @added="wishlistModalOpen = false"
    />

    <AppToast :message="lastError" variant="error" @dismiss="store.clearError()" />
  </main>
</template>
