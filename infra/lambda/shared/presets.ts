// 推薦 agent 的固定 prompt 集合。
// 前端只能送 presetId,後端對應到實際 prompt,所以使用者無法塞入自由文字
// (= 無 prompt injection 風險,自然形成 topic guard)。

export const PRESETS = {
  'recently-completed': '推薦 5 部最近 5 年內完結、評價良好的漫畫',
  'hot-blooded': '推薦 5 部熱血類型的經典或近期漫畫',
} as const

export type PresetId = keyof typeof PRESETS

export function isPresetId(v: unknown): v is PresetId {
  return typeof v === 'string' && v in PRESETS
}
