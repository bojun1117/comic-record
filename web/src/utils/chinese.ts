// 搜尋用的繁簡正規化:把任意中文字串轉成簡體+小寫,讓搜尋繁簡共通。
// 用 opencc-js 的 t2cn subpath(只含 T→S 字典,~64KB)而不是 full(~1MB)。

import { Converter } from 'opencc-js/t2cn'

// 'tw' → 'cn' 同時處理字符差異(進→进)和台灣慣用詞(軟體→软件)。
// 已是簡體的字串通過此 converter 等於 no-op。
const t2cn = Converter({ from: 'tw', to: 'cn' })

const cache = new Map<string, string>()

export function normalizeChinese(s: string): string {
  if (s === '') return s
  const cached = cache.get(s)
  if (cached !== undefined) return cached
  const out = t2cn(s).toLowerCase()
  cache.set(s, out)
  return out
}
