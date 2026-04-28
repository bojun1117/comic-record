import type { Manga } from '@/types/manga'

/**
 * Mock 資料,僅供階段 1 prototype 使用。
 *
 * 涵蓋情境:
 * - plan-to-read(想看)× 2
 * - reading(追讀中)× 4:欄位組合多樣
 * - dropped(棄追)× 2
 * - completed(已追完)× 2:一筆有 rating、一筆沒有
 *
 * 加分類後(階段 1.5):每筆都有 category,涵蓋所有 5 個 enum 至少一筆。
 *
 * 時間戳分散在過去幾個月內,方便測 lastReadAt 排序。
 */
export const mockMangas: Manga[] = [
  // ─── 追讀中 ─────────────────────────────────────────

  {
    id: 'mock-001',
    title: '進擊的巨人',
    currentVolume: 12,
    currentChapter: 98,
    status: 'reading',
    category: 'adventure',
    rating: null,
    coverUrl: null,
    notes: null,
    lastReadAt: '2026-04-24T14:30:00.000Z',
    createdAt: '2025-09-10T08:00:00.000Z',
    updatedAt: '2026-04-24T14:30:00.000Z',
  },

  {
    id: 'mock-002',
    title: '海賊王',
    currentVolume: null,
    currentChapter: 1124,
    status: 'reading',
    category: 'adventure',
    rating: null,
    coverUrl: null,
    notes: null,
    lastReadAt: '2026-04-26T22:15:00.000Z',
    createdAt: '2025-06-01T10:00:00.000Z',
    updatedAt: '2026-04-26T22:15:00.000Z',
  },

  {
    id: 'mock-003',
    title: '葬送的芙莉蓮',
    currentVolume: 8,
    currentChapter: null,
    status: 'reading',
    category: 'adventure',
    rating: null,
    coverUrl: null,
    notes: null,
    lastReadAt: '2026-04-13T19:00:00.000Z',
    createdAt: '2025-12-20T09:00:00.000Z',
    updatedAt: '2026-04-13T19:00:00.000Z',
  },

  {
    id: 'mock-004',
    title: '排球少年',
    currentVolume: null,
    currentChapter: null,
    status: 'reading',
    category: 'hot-blooded',
    rating: null,
    coverUrl: null,
    notes: null,
    lastReadAt: '2026-03-25T11:00:00.000Z',
    createdAt: '2026-03-25T11:00:00.000Z',
    updatedAt: '2026-03-25T11:00:00.000Z',
  },

  // ─── 想看 ───────────────────────────────────────────

  {
    id: 'mock-005',
    title: '咒術迴戰',
    currentVolume: null,
    currentChapter: null,
    status: 'plan-to-read',
    category: 'hot-blooded',
    rating: null,
    coverUrl: null,
    notes: null,
    lastReadAt: '2026-04-20T13:00:00.000Z',
    createdAt: '2026-04-20T13:00:00.000Z',
    updatedAt: '2026-04-20T13:00:00.000Z',
  },

  {
    id: 'mock-006',
    title: '黃金神威',
    currentVolume: null,
    currentChapter: null,
    status: 'plan-to-read',
    category: 'adventure',
    rating: null,
    coverUrl: null,
    notes: null,
    lastReadAt: '2026-02-18T10:30:00.000Z',
    createdAt: '2026-02-18T10:30:00.000Z',
    updatedAt: '2026-02-18T10:30:00.000Z',
  },

  // ─── 已追完 ─────────────────────────────────────────

  {
    id: 'mock-007',
    title: '鋼之鍊金術師',
    currentVolume: 27,
    currentChapter: 108,
    status: 'completed',
    category: 'adventure',
    rating: 5,
    coverUrl: null,
    notes: null,
    lastReadAt: '2026-01-15T20:00:00.000Z',
    createdAt: '2025-08-01T09:00:00.000Z',
    updatedAt: '2026-01-15T20:00:00.000Z',
  },

  {
    id: 'mock-008',
    title: '魔法少女小圓',
    currentVolume: 3,
    currentChapter: null,
    status: 'completed',
    category: 'mystery',
    rating: null,
    coverUrl: null,
    notes: null,
    lastReadAt: '2026-04-27T03:50:00.000Z',
    createdAt: '2026-04-15T18:00:00.000Z',
    updatedAt: '2026-04-27T03:50:00.000Z',
  },

  // ─── 棄追 ───────────────────────────────────────────

  {
    id: 'mock-009',
    title: '某部沒追下去的少年漫',
    currentVolume: null,
    currentChapter: 15,
    status: 'dropped',
    category: 'other',
    rating: null,
    coverUrl: null,
    notes: null,
    lastReadAt: '2026-01-27T15:00:00.000Z',
    createdAt: '2025-11-01T12:00:00.000Z',
    updatedAt: '2026-01-27T15:00:00.000Z',
  },

  {
    id: 'mock-010',
    title: '看到一半就忘了的後宮作',
    currentVolume: 4,
    currentChapter: null,
    status: 'dropped',
    category: 'romance',
    rating: null,
    coverUrl: null,
    notes: null,
    lastReadAt: '2025-10-12T16:30:00.000Z',
    createdAt: '2025-08-20T11:00:00.000Z',
    updatedAt: '2025-10-12T16:30:00.000Z',
  },

  // ─── 額外湊到 12 筆 ────────────────────────────────

  {
    id: 'mock-011',
    title: '蒼藍渾沌',
    currentVolume: 15,
    currentChapter: null,
    status: 'reading',
    category: 'adventure',
    rating: null,
    coverUrl: null,
    notes: null,
    lastReadAt: '2026-04-05T09:00:00.000Z',
    createdAt: '2025-07-10T14:00:00.000Z',
    updatedAt: '2026-04-05T09:00:00.000Z',
  },

  {
    id: 'mock-012',
    title: '死亡筆記本',
    currentVolume: 12,
    currentChapter: null,
    status: 'completed',
    category: 'mystery',
    rating: 4,
    coverUrl: null,
    notes: null,
    lastReadAt: '2025-12-03T21:00:00.000Z',
    createdAt: '2025-09-15T19:00:00.000Z',
    updatedAt: '2025-12-03T21:00:00.000Z',
  },
]
