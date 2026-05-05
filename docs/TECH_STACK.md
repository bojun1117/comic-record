# Tech Stack

整個專案用到的所有技術。

---

## 前端(`comic-vibe/`)

### 核心
- **Vue 3**(Composition API + `<script setup>`)
- **Vite**(build tool)
- **TypeScript**(strict mode)
- **Pinia**(狀態管理)
- **Vue Router**

### 樣式
- **Tailwind CSS v3**(標準設定)
- 不裝 UI library(自己刻按鈕、卡片、modal)

### 工具
- **ESLint + Prettier**(用 Vue 官方 preset)
- **vue-tsc**(型別檢查)

### 套件偏好(階段 1 起的設計原則)
- **不裝 UUID library** → 用 `crypto.randomUUID()`(階段 1 前端產 id;階段 4 起後端產)
- **不裝 date library** → 用 `Intl.RelativeTimeFormat` 自己算「3 天前」
- **不裝 form library** → 欄位少,自己處理
- **不裝 icon library** → 用 unicode `★` `＋` `⋯` 或自刻 inline SVG

---

## 後端(`infra/`)— 階段 3 起

### IaC
- **AWS CDK(TypeScript)** — 跟前端同語言,寫起來最不會出錯
- 用 `aws-cdk-lib` 與 `constructs`

### 執行環境
- **AWS Lambda** — Node.js 22, ARM64(比 x86 便宜 20%)
- **esbuild** 打包(minify + sourceMap),`@aws-sdk/*` 是 Lambda runtime 內建,不打進 bundle
- **AWS SDK v3**(`@aws-sdk/client-dynamodb`、`@aws-sdk/lib-dynamodb`、`@aws-sdk/client-ssm`)

### 資料庫
- **DynamoDB**(PAY_PER_REQUEST,沒流量不收錢)
- Schema:PK `userId`、SK `id`(階段 4 寫死 `'me'`,階段 5+ 多人擴充用)

### API
- **API Gateway REST API**
- CORS:`*`(階段 3–4)→ 正式 domain(階段 5+)
- 限流:50 req/sec(階段 3 寬鬆設定,prod 應收緊)

### 認證(階段 4 起)
- **JWT(HS256)** 用 `jose` lib 簽 / 驗
- 密碼 + JWT secret 存 **AWS SSM Parameter Store(SecureString)**
- timing-safe 密碼比對(`crypto.timingSafeEqual`)

### 測試
- **vitest** 跑單元測試(目前 26 個 case 覆蓋驗證邏輯)

---

## 不裝、刻意排除

### 前端
- ❌ localStorage / IndexedDB(階段 1 故意不做,讓「資料消失」明顯;階段 4 只用 localStorage 存 JWT,不存資料)
- ❌ axios(階段 4 用原生 `fetch`)
- ❌ CSS-in-JS(用 Tailwind)
- ❌ Vue 2 syntax(Options API)
- ❌ jwt-decode(前端不解 JWT,只當不透明字串拿來用)

### 後端
- ❌ Express / Fastify(Lambda 不需要,API Gateway 直接路由)
- ❌ ORM(DynamoDB 用 SDK 直打,單表設計簡單)
- ❌ bcrypt / argon2(單一密碼用 timing-safe equal 即可,不存 hash)

---

## 階段對應

| 階段 | 加入的東西 |
|---|---|
| 階段 1 | Vue 3 + Vite + TS + Pinia + Tailwind + ESLint |
| 階段 1.5 | 沒加新套件,只擴充資料模型 |
| 階段 2 | 沒加新套件,只產出 `API.md` |
| 階段 3 | AWS CDK + Lambda + DynamoDB + API Gateway + esbuild + vitest |
| 階段 4 | jose(JWT)+ SSM Parameter Store |
| 階段 5(未開始) | 部署平台(GH Pages / Cloudflare Pages / Amplify) |

---

## 版本資訊(主要)

部署當下:
- Node.js 22(後端 Lambda runtime)
- Vue 3.5+
- Vite 8+
- TypeScript 5.6+
- AWS CDK 2.165+
- aws-cdk-lib 2.165+

完整版本以各個 `package.json` 為準。
