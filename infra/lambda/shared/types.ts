// 與前端 src/types/manga.ts 100% 一致(API.md §3.2)
// 階段 4 接前端時兩邊 schema 完全相同,沒有欄位轉換

export const MANGA_STATUSES = ['plan-to-read', 'reading', 'dropped', 'completed'] as const
export type MangaStatus = (typeof MANGA_STATUSES)[number]

export const MANGA_CATEGORIES = [
  'hot-blooded',
  'mystery',
  'adventure',
  'romance',
  'casual',
  'other',
] as const
export type MangaCategory = (typeof MANGA_CATEGORIES)[number]

export interface Manga {
  id: string
  title: string
  currentVolume: number | null
  currentChapter: number | null
  status: MangaStatus
  category: MangaCategory
  rating: number | null
  coverUrl: string | null
  notes: string | null
  lastReadAt: string
  createdAt: string
  updatedAt: string
}

// DynamoDB item 加上分區用的 userId(API response 不會出現,後端內部使用)
export interface MangaDbItem extends Manga {
  userId: string
}

// 階段 3 暫時固定;階段 4 從 JWT 解出來
export const FIXED_USER_ID = 'me'
