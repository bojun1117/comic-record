/**
 * 把 ISO 時間戳格式化成相對時間,中文 zh-TW。
 *
 * 規則(由近到遠):
 * - < 1 分鐘  : 「剛剛」
 * - < 1 小時  : 「N 分鐘前」
 * - < 24 小時 : 「N 小時前」
 * - < 2 天    : 「昨天」(此處特意挑出來,給 mockup 對照用)
 * - < 30 天   : 「N 天前」
 * - < 12 個月 : 「N 個月前」
 * - 其他      : 「YYYY 年」
 *
 * 不裝 date library;階段 1 自己算就好。
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()

  // 未來時間就直接顯示「剛剛」(理論上不該發生)
  if (diffMs < 0) return '剛剛'

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return '剛剛'
  if (hours < 1) return `${minutes} 分鐘前`
  if (days < 1) return `${hours} 小時前`
  if (days < 2) return '昨天'
  if (days < 30) return `${days} 天前`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} 個月前`

  return `${then.getFullYear()} 年`
}
