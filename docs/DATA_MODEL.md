# Data Model

## TypeScript interface(階段 1.5 起的真實型別)

```typescript
export type MangaStatus =
  | 'plan-to-read'  // 想看
  | 'reading'       // 追讀中
  | 'dropped'       // 棄追
  | 'completed'     // 已追完

export type MangaCategory =
  | 'hot-blooded'   // 熱血
  | 'mystery'       // 懸疑
  | 'adventure'     // 冒險
  | 'romance'       // 愛情
  | 'other'         // 其他

export interface Manga {
  id: string                       // UUID,前端建立時用 crypto.randomUUID()
  title: string                    // 書名,必填
  currentVolume: number | null     // 目前卷數,可空
  currentChapter: number | null    // 目前話數,可空
  status: MangaStatus
  category: MangaCategory          // 分類,必填,預設 'other'
  rating: number | null            // 1–5,只有 status === 'completed' 才有意義
  coverUrl: string | null          // 階段 1 預留欄位,UI 不出現
  notes: string | null             // 階段 1 預留欄位,UI 不出現
  lastReadAt: string               // ISO timestamp,任何進度更新都動它
  createdAt: string                // ISO timestamp
  updatedAt: string                // ISO timestamp,任何欄位變動都動它
}
```

## 中英對照

### MangaStatus

| 程式碼 | UI 顯示(zh-TW) |
|---|---|
| `plan-to-read` | 想看 |
| `reading` | 追讀中 |
| `dropped` | 棄追 |
| `completed` | 已追完 |

### MangaCategory

| 程式碼 | UI 顯示(zh-TW) |
|---|---|
| `hot-blooded` | 熱血 |
| `mystery` | 懸疑 |
| `adventure` | 冒險 |
| `romance` | 愛情 |
| `other` | 其他 |

## 重要規則

- **DB 永遠保留所有欄位的值**,即使切換 status 也不清空。例如 reading → completed 時,`currentChapter` 不變;completed → reading 時,值原封不動回來。
- `currentVolume` 與 `currentChapter` **獨立**,可以只填一個,可以兩個都填,可以兩個都空。
- `rating` 在 `completed` 以外的 status 雖然技術上可以有值,但 **UI 不會顯示也不會編輯**。
- `category` **必填**,新增漫畫時若使用者沒選,前端 / store / 後端都應 fallback 為 `'other'`。
- `category` 一部漫畫只能有一個(單選,非多標籤)。如未來要做多標籤需另立資料模型。
- `lastReadAt` 在任何進度更新(卷或話)時自動更新,排序「最近在追的」用這個欄位。
- `id` 在前端用 `crypto.randomUUID()` 產生(階段 1)。階段 4 接後端時改由後端產生(見 `API.md` §11.1)。

## 欄位顯示與否(UI 對照)

| 欄位 | UI 顯示 | 可編輯 |
|---|---|---|
| title | ✅ | ✅ |
| currentVolume | ✅(看 status) | ✅(看 status) |
| currentChapter | ✅(看 status) | ✅(看 status) |
| status | ✅ | ✅ |
| category | ✅(卡片 badge) | ✅(階段 1.5 透過新增 modal,卡片上目前不可就地編輯) |
| rating | ✅(僅 completed) | ✅(僅 completed) |
| coverUrl | ❌(預留) | ❌ |
| notes | ❌(預留) | ❌ |
| lastReadAt | ✅(顯示為相對時間) | 自動更新 |
| createdAt | ❌ | 自動 |
| updatedAt | ❌ | 自動 |
