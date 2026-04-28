// API.md §9 所有驗證規則的集中實作
// 寫 Lambda handler 直接呼叫這裡,不要散落在各 handler 裡

import {
  MANGA_CATEGORIES,
  MANGA_STATUSES,
  type Manga,
  type MangaCategory,
  type MangaStatus,
} from './types'

// 自訂驗證錯誤,handler 接到後轉成 400
export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

// ─── 單欄位驗證 ─────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// §9.1 title
function validateTitle(v: unknown): string {
  if (typeof v !== 'string') {
    throw new ValidationError('title must be a string', { field: 'title', received: v })
  }
  const trimmed = v.trim()
  if (trimmed.length < 1 || trimmed.length > 200) {
    throw new ValidationError('title must be 1-200 characters after trim', {
      field: 'title',
      received: v,
    })
  }
  return trimmed
}

// §9.2 currentVolume / currentChapter
function validateNonNegativeIntOrNull(v: unknown, field: string): number | null {
  if (v === null) return null
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 9999) {
    throw new ValidationError(`${field} must be a non-negative integer (0-9999) or null`, {
      field,
      received: v,
    })
  }
  return v
}

// §9.3 status
function validateStatus(v: unknown): MangaStatus {
  if (typeof v !== 'string' || !MANGA_STATUSES.includes(v as MangaStatus)) {
    throw new ValidationError(`status must be one of: ${MANGA_STATUSES.join(', ')}`, {
      field: 'status',
      received: v,
      allowed: MANGA_STATUSES,
    })
  }
  return v as MangaStatus
}

// §9.4 category
function validateCategory(v: unknown): MangaCategory {
  if (v === null) {
    throw new ValidationError('category cannot be null (use a valid enum value)', {
      field: 'category',
      allowed: MANGA_CATEGORIES,
    })
  }
  if (typeof v !== 'string' || !MANGA_CATEGORIES.includes(v as MangaCategory)) {
    throw new ValidationError(`category must be one of: ${MANGA_CATEGORIES.join(', ')}`, {
      field: 'category',
      received: v,
      allowed: MANGA_CATEGORIES,
    })
  }
  return v as MangaCategory
}

// §9.5 rating(只驗範圍,跨欄位規則在後面 finalize 階段)
function validateRating(v: unknown): number | null {
  if (v === null) return null
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) {
    throw new ValidationError('rating must be an integer 1-5 or null', {
      field: 'rating',
      received: v,
    })
  }
  return v
}

// §9.6 coverUrl
function validateCoverUrl(v: unknown): string | null {
  if (v === null) return null
  if (typeof v !== 'string') {
    throw new ValidationError('coverUrl must be a string or null', {
      field: 'coverUrl',
      received: v,
    })
  }
  try {
    const u = new URL(v)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('protocol must be http or https')
    }
  } catch {
    throw new ValidationError('coverUrl must be a valid http(s) URL or null', {
      field: 'coverUrl',
      received: v,
    })
  }
  return v
}

// §9.7 notes
function validateNotes(v: unknown): string | null {
  if (v === null) return null
  if (typeof v !== 'string') {
    throw new ValidationError('notes must be a string or null', { field: 'notes', received: v })
  }
  if (v.length > 2000) {
    throw new ValidationError('notes must be at most 2000 characters', {
      field: 'notes',
      length: v.length,
    })
  }
  return v
}

// §9.5 跨欄位:rating !== null → status === 'completed'
function checkRatingStatusCrossField(status: MangaStatus, rating: number | null): void {
  if (rating !== null && status !== 'completed') {
    throw new ValidationError('rating is only allowed when status is "completed"', {
      rule: 'rating_only_when_completed',
      status,
      rating,
    })
  }
}

// ─── 公開 API:POST /mangas 用 ────────────────────────────

// 驗證 + 補預設值,輸出可寫入 DB 的乾淨欄位(不含 server-managed 欄位)
export interface ValidatedCreateInput {
  title: string
  currentVolume: number | null
  currentChapter: number | null
  status: MangaStatus
  category: MangaCategory
  rating: number | null
  coverUrl: string | null
  notes: string | null
}

export function validateCreateInput(rawBody: unknown): ValidatedCreateInput {
  if (!isPlainObject(rawBody)) {
    throw new ValidationError('request body must be a JSON object')
  }

  // title 必填
  if (!('title' in rawBody)) {
    throw new ValidationError('title is required', { field: 'title' })
  }

  const title = validateTitle(rawBody.title)

  // 預設值(未提供 → 預設)
  const status: MangaStatus =
    'status' in rawBody && rawBody.status !== undefined
      ? validateStatus(rawBody.status)
      : 'plan-to-read'

  const category: MangaCategory =
    'category' in rawBody && rawBody.category !== undefined
      ? validateCategory(rawBody.category)
      : 'other'

  // 其他可空欄位
  const currentVolume =
    'currentVolume' in rawBody
      ? validateNonNegativeIntOrNull(rawBody.currentVolume, 'currentVolume')
      : null
  const currentChapter =
    'currentChapter' in rawBody
      ? validateNonNegativeIntOrNull(rawBody.currentChapter, 'currentChapter')
      : null
  const rating = 'rating' in rawBody ? validateRating(rawBody.rating) : null
  const coverUrl = 'coverUrl' in rawBody ? validateCoverUrl(rawBody.coverUrl) : null
  const notes = 'notes' in rawBody ? validateNotes(rawBody.notes) : null

  // 跨欄位
  checkRatingStatusCrossField(status, rating)

  return { title, currentVolume, currentChapter, status, category, rating, coverUrl, notes }
}

// ─── 公開 API:PATCH /mangas/{id} 用 ──────────────────────

export interface ValidatedPatch {
  title?: string
  currentVolume?: number | null
  currentChapter?: number | null
  status?: MangaStatus
  category?: MangaCategory
  rating?: number | null
  coverUrl?: string | null
  notes?: string | null
}

// 忽略的 server-managed 欄位(client 帶了不報錯,silently drop)
const IGNORED_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'lastReadAt'])

export function validatePatchInput(rawBody: unknown, existing: Manga): ValidatedPatch {
  if (!isPlainObject(rawBody)) {
    throw new ValidationError('request body must be a JSON object')
  }

  const patch: ValidatedPatch = {}

  for (const [key, value] of Object.entries(rawBody)) {
    if (IGNORED_FIELDS.has(key)) continue

    switch (key) {
      case 'title':
        patch.title = validateTitle(value)
        break
      case 'currentVolume':
        patch.currentVolume = validateNonNegativeIntOrNull(value, 'currentVolume')
        break
      case 'currentChapter':
        patch.currentChapter = validateNonNegativeIntOrNull(value, 'currentChapter')
        break
      case 'status':
        patch.status = validateStatus(value)
        break
      case 'category':
        patch.category = validateCategory(value)
        break
      case 'rating':
        patch.rating = validateRating(value)
        break
      case 'coverUrl':
        patch.coverUrl = validateCoverUrl(value)
        break
      case 'notes':
        patch.notes = validateNotes(value)
        break
      default:
        // §9.8 未知欄位忽略不報錯
        break
    }
  }

  // 跨欄位:用「合併後」的最終 status / rating 來檢查
  const finalStatus = patch.status ?? existing.status
  const finalRating = patch.rating !== undefined ? patch.rating : existing.rating
  checkRatingStatusCrossField(finalStatus, finalRating)

  return patch
}

// 提供給 update handler:判斷是否要更新 lastReadAt(API.md §7.2.1)
export function patchTouchesProgress(patch: ValidatedPatch): boolean {
  return 'currentVolume' in patch || 'currentChapter' in patch
}
