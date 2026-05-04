import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  type AddMangaPayload,
  createMangaApi,
  deleteMangaApi,
  listMangasApi,
  updateMangaApi,
} from '@/api/mangas'
import { ApiException } from '@/api/client'
import type { Manga } from '@/types/manga'
import { useAuthStore } from './auth'

// 對外保留階段 1 的型別名稱,呼叫端不用改
export type AddMangaInput = AddMangaPayload

export const useMangaStore = defineStore('manga', () => {
  const mangas = ref<Manga[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  // 最近一次 API 呼叫的錯誤(給 toast 用)
  const lastError = ref<string | null>(null)

  function getToken(): string {
    const auth = useAuthStore()
    const t = auth.getToken()
    if (!t) throw new ApiException(401, null, 'not authenticated')
    return t
  }

  function recordError(err: unknown): void {
    if (err instanceof ApiException) {
      lastError.value = err.message
      // 401 → token 失效 / 過期,自動登出讓使用者重來
      if (err.isUnauthorized) {
        const auth = useAuthStore()
        auth.logout()
      }
    } else if (err instanceof Error) {
      lastError.value = err.message
    } else {
      lastError.value = String(err)
    }
  }

  function clearError(): void {
    lastError.value = null
  }

  async function getAll(): Promise<Manga[]> {
    loading.value = true
    try {
      const list = await listMangasApi(getToken())
      mangas.value = list
      loaded.value = true
      return list.map((m) => ({ ...m }))
    } catch (err) {
      recordError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function add(input: AddMangaInput): Promise<Manga> {
    try {
      const created = await createMangaApi(input, getToken())
      mangas.value.push(created)
      return { ...created }
    } catch (err) {
      recordError(err)
      throw err
    }
  }

  async function update(id: string, patch: Partial<Manga>): Promise<Manga> {
    const idx = mangas.value.findIndex((m) => m.id === id)
    if (idx === -1) {
      const e = new Error(`Manga not found locally: ${id}`)
      recordError(e)
      throw e
    }

    // 樂觀更新:先在本地套用 patch,UI 立刻反應
    const original = mangas.value[idx]!
    const optimistic: Manga = {
      ...original,
      ...patch,
      // 不亂動 server-managed 欄位
      id: original.id,
      createdAt: original.createdAt,
    }
    mangas.value[idx] = optimistic

    try {
      const updated = await updateMangaApi(id, patch, getToken())
      // 用後端回的權威值取代(包括 lastReadAt / updatedAt)
      mangas.value[idx] = updated
      return { ...updated }
    } catch (err) {
      // rollback:還原原本的值
      mangas.value[idx] = original
      recordError(err)
      throw err
    }
  }

  async function remove(id: string): Promise<void> {
    const idx = mangas.value.findIndex((m) => m.id === id)
    if (idx === -1) {
      const e = new Error(`Manga not found locally: ${id}`)
      recordError(e)
      throw e
    }

    // 樂觀刪除
    const removed = mangas.value[idx]!
    mangas.value.splice(idx, 1)

    try {
      await deleteMangaApi(id, getToken())
    } catch (err) {
      // rollback:把刪掉的塞回原位
      mangas.value.splice(idx, 0, removed)
      recordError(err)
      throw err
    }
  }

  function reset(): void {
    mangas.value = []
    loading.value = false
    loaded.value = false
    lastError.value = null
  }

  return {
    mangas,
    loading,
    loaded,
    lastError,
    getAll,
    add,
    update,
    remove,
    clearError,
    reset,
  }
})
