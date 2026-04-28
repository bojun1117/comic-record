# Comic Vibe — Manga Tracker

個人用的漫畫追蹤工具。記錄每部漫畫看到第幾話 / 第幾卷,以及看完之後的推薦指數。

只有自己一個人用,多裝置(電腦、手機)會用,單一密碼登入。

---

## 目前狀態

**階段 4 完成 ✅** — 前端 + AWS 後端 + 密碼登入全部串起來,資料存 DynamoDB,reload 不消失。

| 階段 | 狀態 | 內容 |
|---|---|---|
| 階段 1 | ✅ | 純前端 Vue prototype,8 個任務 + 2 個可選任務 |
| 階段 1.5 | ✅ | 加入分類功能(熱血 / 懸疑 / 冒險 / 愛情 / 其他) |
| 階段 2 | ✅ | 反推 API contract,產出 `API.md` |
| 階段 3 | ✅ | AWS CDK 部署:Lambda × 4 + DynamoDB + API Gateway |
| 階段 4 | ✅ | 前端接上 AWS、加密碼登入(JWT 30 天) |
| 階段 5 | 未開始 | 部署到 GitHub Pages / Cloudflare Pages,有正式 domain |

---

## 怎麼跑

### 後端(只要部署過一次,之後改 code 才需要重跑)

```bash
cd infra
npm install
npm run deploy
```

第一次部署前要先做兩件事:
1. AWS 帳號 + CLI 設好(見 `AWS_SETUP.md`)
2. SSM 設密碼與 JWT secret(見 `INFRA.md` §「部署前必做」)

部署成功後 console 會印出 `ApiUrl`,把它填到前端的 `.env.development`。

### 前端

```bash
cd comic-vibe
npm install
npm run dev
```

打開 `http://localhost:5173/` → 跳登入頁 → 輸入密碼 → 進主頁。

---

## 文件導覽

照這個順序看,從「為什麼做」到「怎麼做」到「現在跑了什麼」:

### 規劃層(從 0 開始的 vibe coding 文件)

| 檔案 | 看完知道什麼 |
|---|---|
| `SPEC.md` | 這個工具做什麼、不做什麼 |
| `DATA_MODEL.md` | `Manga` 的 TypeScript interface 與重要規則 |
| `UI_SPEC.md` | 每個畫面長什麼樣、互動細節 |
| `TECH_STACK.md` | 為什麼選這些技術、不選那些 |
| `CONVENTIONS.md` | 寫 code 的規矩(目錄結構、命名、Pinia 設計) |

### 執行層(階段 1 落地過程)

| 檔案 | 看完知道什麼 |
|---|---|
| `TASKS.md` | 階段 1 的 10 個任務(已全部完成) |
| `mockup.html` | UI 視覺參考,直接瀏覽器打開預覽 |

### 後端層(階段 2–4 接後端)

| 檔案 | 看完知道什麼 |
|---|---|
| `API.md` | 後端 4 個 mangas endpoint + login endpoint 的完整 contract |
| `AWS_SETUP.md` | 怎麼開 AWS 帳號、設 CLI、設 billing alert(只看一次) |
| `infra/INFRA.md` | CDK 部署、cURL 驗收、修改密碼、destroy 怎麼做 |
| `AUTH.md` | 密碼 / JWT 機制,改密碼方式,旋轉 secret |

---

## 最常用的指令速查

```bash
# 前端開發
cd comic-vibe && npm run dev

# 部署後端
cd infra && npm run deploy

# 改密碼(SSM)
aws ssm put-parameter \
  --name "/comic-vibe/dev/app-password" \
  --value "新密碼" --type SecureString --overwrite \
  --region us-east-1
cd infra && npm run deploy   # 立刻生效

# 拆掉所有 AWS 資源(停止計費)
cd infra && npm run destroy

# 看 Lambda 日誌
aws logs tail /aws/lambda/comic-vibe-list-mangas-dev --follow
```

---

## 重要原則

- **不自由發揮文件之外的功能** — 想加新功能先寫進 `BACKLOG.md`
- **不為了一個小功能裝大套件** — 用內建工具(`crypto.randomUUID`、`Intl.RelativeTimeFormat`)
- **每個任務做完先停** — 跑、看、commit,有問題立刻修不要累積
- **AWS billing alert 是底線** — 任何超過 $5 / 月會 email,不要拿掉

---

## 接下來可以做什麼

可選,做不做都不影響目前已經能用的東西:

- **階段 5**:部署到正式 domain(Cloudflare Pages / GitHub Pages),手機就可以用
- **加 BACKLOG 裡的功能**:搜尋、匯入匯出、分類就地編輯,先用一陣子再決定哪個最痛
- **純粹用一段時間**:把現有功能用爽,讓真實使用情境告訴你下一步該做什麼

---

## 給 vibe coding 的提示

第一次進到這個 repo 的 AI / 你自己,可以這樣開始:

1. 讀 `README.md`(這份)知道整體狀態
2. 讀 `SPEC.md`、`DATA_MODEL.md` 知道做什麼
3. 看你想做什麼:
   - 改前端 → 看 `UI_SPEC.md`、`CONVENTIONS.md`,改 `comic-vibe/src/`
   - 改後端 → 看 `API.md`,改 `infra/lambda/`
   - 加新功能 → 先看 `BACKLOG.md`(如果有)+ 對應 `SPEC.md`
4. **每做完一段先停下來確認再繼續**,不要連續衝
