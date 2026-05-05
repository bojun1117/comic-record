# Tasks — 全階段任務記錄

這份文件原本是階段 1 的任務清單,現在拓展為全階段的進度紀錄。
每個任務都有「驗收標準」可以在重做或 onboarding 新成員時對照。

---

## 階段 1:純前端 prototype ✅

依序執行,每個任務做完先跑、先看、先 commit。

### 任務 1:建立專案骨架 ✅

- 用 Vite 建 Vue 3 + TypeScript 專案
- 裝 Pinia、Vue Router、Tailwind CSS
- 設定 ESLint + Prettier
- 跑得起來:`npm run dev` 看到預設首頁
- 建 `src/types/manga.ts`,放 `Manga` interface 與 `MangaStatus`
- 建空的 `src/views/HomeView.vue`,接到 router 的 `/`

**驗收**:本機跑得起來,首頁顯示「我的漫畫」標題就好。

### 任務 2:Mock 資料 ✅

- 建 `src/mock/mangas.ts`,export `Manga[]` 至少 10 筆
- 涵蓋:想看 ×2、追讀中 ×4(欄位組合多樣)、棄追 ×2、已追完 ×2
- 時間戳分散在過去幾個月

**驗收**:資料 import 進來型別正確,沒有 type error。

### 任務 3:Pinia store ✅

- 建 `src/stores/manga.ts`,介面:`getAll / add / update / remove`
- 內部用一個 `ref<Manga[]>([])` 當記憶體 DB
- `update` 自動更新 `updatedAt`,動到進度時額外更新 `lastReadAt`
- 所有方法回傳 Promise(為日後接 API 鋪路)

**驗收**:從 HomeView 呼叫 `getAll()`,console.log 印出 mock 資料。

### 任務 4:列表頁 + 卡片元件 ✅

- HomeView:標題 + 統計列 + 卡片網格(`auto-fit, minmax(200px, 1fr)`)
- 排序:按 `lastReadAt` desc
- `MangaCard.vue` 依 status 渲染不同內容
- `StatusBadge.vue` 依 status 顯示 badge
- `utils/time.ts` 相對時間(「3 天前」)

**驗收**:打開首頁看到 mock 資料的卡片,4 種 status 顯示正確,棄追卡片有 opacity。

### 任務 5:就地編輯卷 / 話 ✅

- `MangaCardEditableNumber.vue`:點數字 → input → Enter / blur 存,Esc 取消
- 樂觀更新 pattern 已就位

**驗收**:在追讀中卡片上點數字可改,改完數字記下來,`lastReadAt` 跟著更新。

### 任務 6:評分(僅 completed)✅

- `MangaCardRating.vue`:沒評分顯示「點此評分」,點開展開星星
- 點同一顆星可清除

**驗收**:已追完卡片可填 / 改 / 清除評分。

### 任務 7:卡片動作選單 ✅

- `MangaCardActions.vue`:右上角「⋯」按鈕,可切 status / 刪除
- `ConfirmDialog.vue` 通用確認對話框
- 切換 status 不影響其他欄位

**驗收**:可切換 status、可刪除(列表少一張)。

### 任務 8:新增漫畫 modal ✅

- `AddMangaModal.vue`:書名(必填)、status、卷 / 話、評分(依 status 顯示)
- 「取消」/「新增」按鈕

**驗收**:能新增、能取消、新卡片立刻出現在列表。

### 任務 9(可選):篩選 chips ✅

- HomeView 頂部加篩選 chip:全部 / 想看 / 追讀中 / 棄追 / 已追完

### 任務 10(可選):統計列 computed ✅

- 統計列用 computed 從 store 算,即時更新

---

## 階段 1.5:加入分類功能 ✅

新增 `MangaCategory` enum:`hot-blooded / mystery / adventure / romance / other`,單選必填,預設 `'other'`。

完成項目:
- `Manga` interface 加 `category` 欄位
- mock 資料 12 筆都補分類
- store `add()` 在沒帶 category 時 fallback `'other'`
- 卡片標題列顯示分類 badge(在狀態 badge 旁邊)
- 5 種分類各自顏色(熱血橘、懸疑紫、冒險綠、愛情粉、其他灰)
- 新增 modal 加分類下拉
- HomeView 加第二列分類篩選 chips,跟狀態列獨立 AND 篩選
- 文件同步更新:`SPEC.md` / `DATA_MODEL.md` / `UI_SPEC.md` / `API.md`

---

## 階段 2:反推 API contract ✅

從階段 1.5 的 store 介面反推出 REST API contract,產出 `API.md` 完整版:
- 4 個 mangas endpoint:`GET / POST / PATCH / DELETE`
- store 方法 ↔ HTTP endpoint 對照表
- 完整 request / response schema
- 伺服器端驗證規則(寫 Lambda 直接抄)
- 9 種錯誤碼
- 未來擴充預留(認證、軟刪除、分頁、樂觀鎖)

---

## 階段 3:AWS 基礎建設 ✅

### Part A:AWS 帳號與 CLI

- 開 AWS 帳號,啟用 root MFA
- 建 IAM User `cdk-deploy`,access key 存好
- 設 billing alert($5/月 + $1/日)
- 裝 AWS CLI,`aws configure` 完成
- `cdk bootstrap` 跑過

詳見 `AWS_SETUP.md`。

### Part B:CDK 部署

- CDK TypeScript 專案 `infra/`(跟 `comic-vibe/` 平行)
- DynamoDB 表 `comic-vibe-mangas-dev`(PK userId, SK id)
- 4 個 Lambda(NodeJS 22 ARM64,esbuild minify):
  - `comic-vibe-list-mangas-dev`
  - `comic-vibe-create-manga-dev`
  - `comic-vibe-update-manga-dev`
  - `comic-vibe-delete-manga-dev`
- API Gateway REST,4 個 method(GET/POST/PATCH/DELETE)
- 26 個單元測試覆蓋驗證邏輯
- cURL 驗收 6 個 case 全通

詳見 `INFRA.md`。

---

## 階段 4:接 API + 密碼登入 ✅

### 後端

- 加 `POST /auth/login` Lambda
- SSM Parameter Store 存密碼 + JWT secret(SecureString)
- Lambda 啟動時用 SDK 動態取 SSM(env var 不能直接 inject SecureString)
- `requireAuth` wrapper 包住 4 個 mangas Lambda,沒 token / 過期 → 401
- `jose` lib 簽 / 驗 JWT(HS256, 30 天 TTL)
- timing-safe 密碼比對

### 前端

- 通用 API client(`src/api/client.ts`),處理 base URL / JWT / 錯誤
- auth store(`src/stores/auth.ts`),token 存 localStorage
- manga store 改成打 API,真的樂觀更新 + rollback
- Login 頁(`src/views/LoginView.vue`)
- 路由守衛:沒 token → 跳 login,401 自動登出
- App 啟動時 `getAll()` 載入,加 loading skeleton
- `AppToast.vue` 顯示 API 錯誤
- 環境變數 `.env.development` 放 `VITE_API_BASE_URL`

詳見 `AUTH.md`、`API.md`(§5 login spec)。

---

## 階段 4 完成定義 ✅

- ✅ 任務 1–10 全部跑通
- ✅ 階段 1.5 分類功能完成
- ✅ `API.md` 涵蓋所有 endpoint(含 `/auth/login`)
- ✅ AWS 基礎建設部署成功,cURL 驗收通過
- ✅ 前端接上 AWS,能登入、CRUD 全部運作
- ✅ Reload 頁面**資料還在**(這跟階段 1 最大差別)
- ✅ 沒有 console error / type error
- ✅ commit history 乾淨

---

## 階段 5(未開始,可選)

- 部署到 GitHub Pages / Cloudflare Pages / Amplify Hosting
- CORS 收緊到正式 domain
- JWT 改 httpOnly cookie + CSRF token
- WAF / IP allowlist
- 自訂 domain
- HTTPS 證書(部署平台通常自動)

詳見 `AUTH.md` §「階段 5 規劃」。

---

## 後續若有想加的功能

寫進 `BACKLOG.md`(目前未建)。**不要直接動 code**,先記下來,用一陣子再回頭排優先順序。
