# Comic Vibe

> 個人用的漫畫追蹤工具 — 記錄每部漫畫的進度（卷／話）與追完後的推薦指數。

![Status](https://img.shields.io/badge/status-deployed-brightgreen)
![Frontend](https://img.shields.io/badge/frontend-Vue%203%20%2B%20Vite-42b883)
![Backend](https://img.shields.io/badge/backend-AWS%20Lambda%20%2B%20DynamoDB-ff9900)
![Auth](https://img.shields.io/badge/auth-JWT%20(HS256)-4b5563)
![Deploy](https://img.shields.io/badge/deploy-GitHub%20Pages-222)

單人使用、多裝置同步（電腦／手機），單一密碼登入。資料存於 AWS DynamoDB，重新整理不會消失。

🔗 **線上版**：[https://bojun1117.github.io/comic-record/](https://bojun1117.github.io/comic-record/)

---

## 功能

- 漫畫卡片列表，支援新增 / 編輯 / 刪除
- **獨立進度欄位**：卷數與話數可分別記錄
- 狀態切換：想看 / 追讀中 / 棄追 / 已追完
- 完成後給 1–5 星評分（與狀態切換為獨立操作）
- 五大分類：熱血 / 懸疑 / 冒險 / 愛情 / 其他
- 首頁可同時依「狀態」與「分類」獨立 chip 篩選
- 單一密碼登入，JWT 30 天有效期

---

## 系統架構

```
   ┌──────────────┐         ┌──────────────────┐
   │ GitHub Pages │ ◄─────  │  GitHub Actions  │  ◄── git push main
   │  (Vue SPA)   │  build  │  (CI/CD)         │
   └──────┬───────┘         └──────────────────┘
          │ HTTPS + JWT
          ▼
   ┌──────────────────┐       ┌────────────┐
   │   API Gateway    │ ────► │   Lambda   │
   │ (REST, CORS      │ ◄──── │  Node 22   │
   │  allowlist)      │       │  ARM64     │
   └──────────────────┘       └─────┬──────┘
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                    ┌──────────┐      ┌──────────────┐
                    │ DynamoDB │      │ SSM Param    │
                    │ (mangas) │      │  (secrets)   │
                    └──────────┘      └──────────────┘
```

---

## 技術棧

| 範疇 | 使用技術 |
|---|---|
| Frontend | Vue 3 (Composition API)、TypeScript、Vite、Pinia、Vue Router、Tailwind CSS |
| Backend | AWS Lambda (Node.js 22, ARM64)、API Gateway REST、esbuild |
| Database | DynamoDB (PAY_PER_REQUEST) |
| Auth | JWT (HS256) via `jose`、AWS SSM Parameter Store (SecureString) |
| IaC | AWS CDK v2 (TypeScript) |
| Hosting | GitHub Pages（前端）、AWS（後端） |
| CI/CD | GitHub Actions（push main 自動部署前端） |
| Tooling | ESLint、Prettier、vue-tsc、vitest |

完整選型理由與排除項目請見 [`docs/TECH_STACK.md`](docs/TECH_STACK.md)。

---

## 專案結構

```
comic-record/
├── .github/workflows/ # GitHub Actions（前端自動部署）
├── comic-vibe/        # 前端 SPA (Vue 3 + Vite)
│   ├── public/
│   │   └── 404.html   # GitHub Pages SPA fallback
│   ├── src/
│   │   ├── api/       # HTTP client 與端點封裝
│   │   ├── components/
│   │   ├── stores/    # Pinia stores (auth, manga)
│   │   ├── views/     # 路由頁面
│   │   └── router/
│   └── ...
├── infra/             # AWS CDK 後端
│   ├── bin/           # CDK app entry
│   ├── lib/           # Stack 定義
│   ├── lambda/        # Lambda handlers + 共用工具
│   └── test/          # vitest 單元測試
└── docs/              # 規格與架構文件
```

---

## 快速開始

### 先決條件

- Node.js 22+
- AWS CLI 已設定憑證（部署後端用）
- AWS 帳號已設定 billing alert

### 後端（首次部署）

```bash
cd infra
npm install

# 設定登入密碼與 JWT secret（詳見 docs/INFRA.md）
aws ssm put-parameter --name "/comic-vibe/dev/app-password" \
  --value "<your-password>" --type SecureString --region us-east-1
aws ssm put-parameter --name "/comic-vibe/dev/jwt-secret" \
  --value "<random-32-bytes>" --type SecureString --region us-east-1

npm run deploy
```

部署完成後，CloudFormation 會輸出 `ApiUrl`，將其填入前端的 `comic-vibe/.env.development`。

### 前端

```bash
cd comic-vibe
npm install
npm run dev
```

開啟 `http://localhost:5173/`，使用先前設定的密碼登入。

---

## 部署

### 前端（自動）

push 到 `main` 分支即觸發 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)：

```
git push   # → GitHub Actions 自動 build + 部署到 GitHub Pages（約 2–3 分鐘）
```

workflow 步驟：`checkout → npm ci → type-check → vite build → upload artifact → deploy-pages`。
build 時注入 `VITE_BASE_PATH=/comic-record/`，API URL 來自 `comic-vibe/.env.production`。

### 後端（手動）

CDK 部署刻意不入 CI，避免 Lambda／DynamoDB 改錯影響大：

```bash
cd infra
npm run diff       # 先看異動
npm run deploy
```

完整流程與驗收步驟見 [`docs/DEPLOY.md`](docs/DEPLOY.md)。

---

## 常用指令

```bash
# 前端開發
cd comic-vibe && npm run dev

# 前端型別檢查與 lint
cd comic-vibe && npm run type-check && npm run lint

# 後端部署
cd infra && npm run deploy

# 後端單元測試
cd infra && npm test

# 旋轉登入密碼
aws ssm put-parameter \
  --name "/comic-vibe/dev/app-password" \
  --value "<new-password>" --type SecureString --overwrite \
  --region us-east-1
cd infra && npm run deploy

# 拆除 AWS 資源（停止計費）
cd infra && npm run destroy

# 追蹤 Lambda 日誌
aws logs tail /aws/lambda/comic-vibe-list-mangas-dev --follow
```

---

## 文件索引

| 文件 | 內容 |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | 產品範圍：做什麼、不做什麼 |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | `Manga` 型別定義與欄位規則 |
| [`docs/UI_SPEC.md`](docs/UI_SPEC.md) | 畫面與互動細節 |
| [`docs/TECH_STACK.md`](docs/TECH_STACK.md) | 技術選型與排除項目 |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | 目錄結構、命名、Pinia 設計慣例 |
| [`docs/API.md`](docs/API.md) | REST API 完整 contract |
| [`docs/AUTH.md`](docs/AUTH.md) | 密碼／JWT 機制與 secret 旋轉 |
| [`docs/INFRA.md`](docs/INFRA.md) | CDK 部署、驗收與運維 |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | 階段 5：GitHub Pages + CORS 收緊與多裝置驗收 |
| [`docs/AWS_SETUP.md`](docs/AWS_SETUP.md) | AWS 帳號／CLI／billing alert 初始設定 |
| [`docs/TASKS.md`](docs/TASKS.md) | 開發階段任務拆解 |

---

## 開發階段

| 階段 | 狀態 | 範圍 |
|---|---|---|
| 1 | ✅ | 純前端 Vue prototype |
| 1.5 | ✅ | 加入分類功能 |
| 2 | ✅ | 反推 API contract |
| 3 | ✅ | AWS CDK 部署：Lambda + DynamoDB + API Gateway |
| 4 | ✅ | 前後端串接、密碼登入（JWT 30 天） |
| 5 | ✅ | GitHub Pages 部署、CORS 收緊到 allowlist、CI/CD 自動化 |

---

## 設計原則

- **不裝大套件做小功能** — 採用 `crypto.randomUUID`、`Intl.RelativeTimeFormat` 等內建 API
- **BACKLOG 優先** — 新功能先寫進 `BACKLOG.md` 再實作，不自由發揮
- **小步迭代** — 每個任務完成即停下驗證，不累積錯誤
- **成本可控** — AWS billing alert 為底線，超過 $5/月即告警

---

## License

MIT — 個人專案，僅供參考使用。
