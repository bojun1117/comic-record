# Conventions

寫 code 的規矩,前後端通用。

---

## 整體目錄結構

```
專案根目錄/
├── web/        # 前端 (Vue 3 + Vite)
├── server/     # 後端 (Go + Gin)
├── k8s/        # K8s manifests (kind 本機 cluster)
└── docs/       # 規劃 / 規格文件(本資料夾)
```

---

## 前端(`web/`)

### 元件規矩
- 一律 Composition API + `<script setup lang="ts">`
- 元件檔名 PascalCase(`MangaCard.vue`),其他檔案 kebab-case(`mock-data.ts`)
- 元件單檔不超過 ~200 行,過長就拆
- Vue lint 規定元件名至少兩個字(`AppToast` 不是 `Toast`)

### 目錄結構

```
web/src/
├── App.vue
├── main.ts
├── router/
│   └── index.ts
├── stores/
│   ├── manga.ts          # mangas store(階段 4 起打 API)
│   └── auth.ts           # JWT 與 login/logout
├── api/                  # 階段 4 加,API client + endpoints
│   ├── client.ts
│   ├── mangas.ts
│   └── auth.ts
├── mock/
│   └── mangas.ts         # 階段 1 用,階段 4 後不再載入(留檔給測試 / 離線參考)
├── types/
│   └── manga.ts
├── components/
│   ├── MangaCard.vue
│   ├── MangaCardEditableNumber.vue
│   ├── MangaCardRating.vue
│   ├── MangaCardActions.vue
│   ├── AddMangaModal.vue
│   ├── ConfirmDialog.vue
│   ├── StatusBadge.vue
│   ├── CategoryBadge.vue
│   └── AppToast.vue
├── views/
│   ├── HomeView.vue
│   └── LoginView.vue
└── utils/
    └── time.ts           # 「3 天前」格式化
```

### 顏色
- 不寫死顏色(`color: #333` 之類)
- 用 Tailwind tokens(`text-neutral-600` 等)
- 階段 1–4 不做 dark mode

### 狀態管理
- 用 **Pinia store**,所有資料讀寫都經過 store
- store 介面 **Promise-based**,所有方法回傳 `Promise`
  - 階段 1:用 `Promise.resolve(...)` 包同步操作
  - 階段 4:換成真的 `await fetch(...)`,**呼叫端 0 改動**
- 樂觀更新:UI 先變、失敗 rollback、`AppToast` 顯示錯誤

### 假資料
- 放 `src/mock/mangas.ts`,export `Manga[]`
- 階段 1 在 store 初始化時載入
- 階段 4 起 store 改打 API,**不再載入 mock**(但檔案保留供日後測試)

### 不要做的事
- ❌ localStorage / IndexedDB 存「資料」(階段 1 刻意不做;階段 4 只存 JWT)
- ❌ 在 store 裡 import mock 當常駐 source(階段 4 起)
- ❌ 硬編顏色 hex
- ❌ 用 `any`(TypeScript strict mode)
- ❌ SPEC.md 之外的功能

---

## 後端(`server/`)— Go

### 目錄結構

```
server/
├── cmd/server/main.go      # 進入點:wire config / store / handlers
├── internal/
│   ├── auth/jwt.go         # JWT sign / verify(HS256, 30 天)
│   ├── config/config.go    # env 讀取 + fail-fast 驗證
│   ├── handler/            # HTTP handlers,一個 endpoint 一支
│   ├── httpx/responses.go  # JSON response helpers + 錯誤格式
│   ├── manga/              # types + validation(API.md §9)
│   ├── middleware/         # CORS / logger / RequireAuth
│   └── store/              # MangaStore interface + DynamoDB 實作
├── go.mod
└── Dockerfile              # multi-stage,distroless 最終 image
```

### 共用程式碼
- 業務邏輯放 `internal/`,跨 process 不會被引用
- `middleware.RequireAuth` 包住需要登入的 routes
- `store.MangaStore` 是介面,handler 依賴介面不依賴 DynamoDB

### 驗證
- 所有 input 都過 `internal/manga/validation.go`
- 規則對應 `API.md` §9
- handler 不散寫驗證邏輯,直接呼 `manga.ValidateCreate / ValidatePatch`

### Secret
- ❌ 不要把密碼 / JWT secret 寫死在程式碼
- ✅ 存 AWS SSM Parameter Store(SecureString)為 source of truth
- ✅ K8s 部署時用 `kubectl create secret` 從 SSM 撈進來注入 Pod env
- ✅ 本機開發跑 `go run` 時用 export env(README 有完整 snippet)

---

## TypeScript

- `strict: true`,**不用 `any`**
- 不用 `as` 強制 cast,除非真的有正當理由
- 偏好 `type` 而不是 `interface`(除非要 augment),但專案內已有的 `interface` 不重構

---

## Git

- 每個任務做完一個 commit,conventional commits 風格:
  - `feat:` 新功能
  - `fix:` 修 bug
  - `chore:` 設定 / build / 雜項
  - `refactor:` 不改行為的整理
  - `docs:` 文件變更
- commit message 用中文 OK

---

## 給 vibe coding 的工作方式

- **每個任務做完先停**,讓使用者跑、看、確認再繼續下一個
- 不要一次衝完很多任務
- 遇到 SPEC 沒寫的決定 → **先問**,不要自由發揮
- 程式碼有 type 錯誤要修掉再交付,不要丟 `any`
- 想加新功能 → 先寫進 `BACKLOG.md`(若不存在則建立),不要直接動 code
