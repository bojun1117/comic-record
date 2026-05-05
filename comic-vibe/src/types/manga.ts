export type MangaStatus =
  | 'plan-to-read' // 想看
  | 'reading' // 追讀中
  | 'dropped' // 棄追
  | 'completed' // 已追完

export type MangaCategory =
  | 'hot-blooded' // 熱血
  | 'mystery' // 懸疑
  | 'adventure' // 冒險
  | 'romance' // 愛情
  | 'casual' // 輕鬆
  | 'competition' // 競技
  | 'other' // 其他

export interface Manga {
  id: string // UUID,前端建立時用 crypto.randomUUID()
  title: string // 書名,必填
  currentVolume: number | null // 目前卷數,可空
  currentChapter: number | null // 目前話數,可空
  status: MangaStatus
  category: MangaCategory // 分類,必填,預設 'other'
  rating: number | null // 1–5,只有 status === 'completed' 才有意義
  coverUrl: string | null // 階段 1 預留欄位,UI 不出現
  notes: string | null // 階段 1 預留欄位,UI 不出現
  lastReadAt: string // ISO timestamp,任何進度更新都動它
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp,任何欄位變動都動它
}
