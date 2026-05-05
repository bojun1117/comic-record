# INFRA.md — 階段 3 / 4 基礎建設

階段 3:用 AWS CDK(TypeScript)在 us-east-1 建後端,實作 `API.md` 規格。
階段 4:加 `/auth/login` + JWT 驗證,所有 mangas endpoint 需要 `Authorization: Bearer <token>`。

## 架構

```
API Gateway (REST)
   │
   ├── POST   /auth/login          → LoginFn(無認證,接受密碼)
   │                                  ↓ 驗證密碼
   │                                  ↓ 簽發 JWT(30天 TTL)
   │
   ├── GET    /mangas              → ListMangasFn
   ├── POST   /mangas              → CreateMangaFn      ← 全部需要 JWT
   ├── PATCH  /mangas/{id}         → UpdateMangaFn
   └── DELETE /mangas/{id}         → DeleteMangaFn
                                       │
                                       ▼
                                   DynamoDB Table
                                   (PK userId, SK id)
```

JWT 簽 / 驗用 `jose`(輕量,純 JS)。secret 與密碼存 AWS SSM Parameter Store。

## 部署前必做:設密碼與 JWT secret

**這兩個值不能寫進程式碼或 CDK**。要在部署前手動建到 SSM Parameter Store。

### 1. 想一個密碼

例如 `my-very-secret-password-2026`。記下來,等下要用,登入也要用。

### 2. 想一個 JWT secret(長亂碼)

```bash
# Mac/Linux:產 32 byte 隨機字串
openssl rand -base64 32
```

複製輸出的字串(類似 `xK9p2L8...AB=`)。

### 3. 用 AWS CLI 建 SSM Parameters

```bash
# 密碼
aws ssm put-parameter \
  --name "/comic-vibe/dev/app-password" \
  --value "你想的密碼" \
  --type SecureString \
  --region us-east-1

# JWT secret
aws ssm put-parameter \
  --name "/comic-vibe/dev/jwt-secret" \
  --value "openssl 產的字串" \
  --type SecureString \
  --region us-east-1
```

兩個都成功後再進行下一步。

> ⚠️ **千萬不要 commit 密碼到 git**。SSM SecureString 是加密儲存,只有 Lambda 拿得到。

### 4.(僅當有改密碼/secret 時)更新 SSM 值

```bash
aws ssm put-parameter \
  --name "/comic-vibe/dev/app-password" \
  --value "新密碼" \
  --type SecureString \
  --overwrite \
  --region us-east-1
```

改完後**要重新部署 stack**(`npm run deploy`),Lambda 才會抓到新值。

## 資源清單

| 資源類型 | 名稱 | 用途 |
|---|---|---|
| DynamoDB Table | `comic-vibe-mangas-dev` | 儲存所有 manga |
| Lambda × 5 | `comic-vibe-{login/list-mangas/create-manga/update-manga/delete-manga}-dev` | API handler |
| API Gateway | `comic-vibe-api-dev` | HTTP 入口 |
| SSM Parameters × 2 | `/comic-vibe/dev/{app-password,jwt-secret}` | 機密資料 |
| IAM Roles | (自動) | Lambda 執行 + DynamoDB / SSM 存取權限 |
| CloudWatch Logs | `/aws/lambda/comic-vibe-*` | Lambda 日誌(7 天) |

### Lambda 設定

- Runtime: **Node.js 22 (ARM64)**(便宜 20%)
- Memory: 256MB,Timeout: 10 秒
- env vars:
  - 全部:`TABLE_NAME`, `JWT_SECRET`(從 SSM 解析)
  - LoginFn 額外:`APP_PASSWORD`
- esbuild minify + sourceMap;`@aws-sdk/*` external,`jose` 打進 bundle

## 部署步驟

### 0. 前置確認

`AWS_SETUP.md` Step 1–6 完成。**SSM Parameter Store 的兩個 parameter 已建**(見上面)。

### 1. 安裝相依套件

```bash
cd infra
npm install
```

### 2. 跑單元測試

```bash
npm test
```

26 個測試應該全綠。

### 3. 看 diff

```bash
npm run diff
```

從階段 3 升級到階段 4 應該看到:新增 LoginFn、4 個 Lambda 加 JWT_SECRET env、API Gateway 加 /auth/login route。

### 4. 部署

```bash
npm run deploy
```

完成後 console 印出 ApiUrl 與 TableName(同階段 3,URL 不變,因為是同個 stack)。

## 用 cURL 驗收(階段 4 版)

```bash
BASE="https://lfesyvfmz9.execute-api.us-east-1.amazonaws.com/dev"
PASSWORD="你設的密碼"

# 1. 沒帶 token 應該 401
echo "=== 1. 未認證,應該 401 ==="
curl -s "$BASE/mangas"
echo ""

# 2. 錯誤密碼登入應該 401
echo "=== 2. 錯誤密碼,應該 401 ==="
curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong"}'
echo ""

# 3. 正確密碼 → 拿 token
echo "=== 3. 正確密碼,應該回 token ==="
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASSWORD\"}" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:30}..."

# 4. 帶 token 列出 mangas
echo "=== 4. 帶 token 列出 ==="
curl -s "$BASE/mangas" -H "Authorization: Bearer $TOKEN"
echo ""

# 5. 帶亂編 token 應該 401
echo "=== 5. 假 token,應該 401 ==="
curl -s "$BASE/mangas" -H "Authorization: Bearer fake.token.here"
echo ""

# 6. 新增一筆
echo "=== 6. 帶 token 新增 ==="
curl -s -X POST "$BASE/mangas" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "鏈鋸人",
    "status": "reading",
    "category": "hot-blooded",
    "currentVolume": null,
    "currentChapter": 50,
    "rating": null,
    "coverUrl": null,
    "notes": null
  }'
echo ""
```

預期結果:
1. `{"error":{"code":"UNAUTHORIZED","message":"missing token"}}`
2. `{"error":{"code":"UNAUTHORIZED","message":"invalid password"}}`
3. `Token: eyJhbGciOiJIUzI1NiIs...`(很長)
4. 你之前資料 + 鏈鋸人(若步驟 6 已跑過)
5. `{"error":{"code":"UNAUTHORIZED","message":"invalid or expired token"}}`
6. 完整 manga 物件

## 修改與重新部署

任何改動 `lambda/` 或 `lib/infra-stack.ts` 後:

```bash
npm run diff
npm run deploy
```

## 拆掉(避免持續花錢)

```bash
npm run destroy
```

> ⚠️ destroy 會刪 DynamoDB 表(dev 環境)+ 所有 Lambda。**SSM Parameter Store 不會被刪**(它是手動建的,需要 `aws ssm delete-parameter` 手動刪)。

## 預估成本

階段 3–5 全部正常使用,**月花費 $0–$1 USD**。SSM Parameter Store 只要不超過 10000 個 parameter(我們只有 2 個)完全免費。

## 故障排除

### 部署時 `Parameter /comic-vibe/dev/app-password not found`

代表 SSM Parameter 還沒建(看「部署前必做」)。

### 401 但密碼明明對

兩個可能:
1. SSM 密碼跟你輸入的不一致 → 用 `aws ssm get-parameter --name "/comic-vibe/dev/app-password" --with-decryption` 驗證
2. 改了 SSM 密碼但沒重新部署 stack → `npm run deploy`

### Lambda 執行時 `JWT_SECRET env var is required`

通常是 SSM 還沒建就部署。確認 SSM 兩個 parameter 都在,再 `npm run deploy`。

### 看 Lambda 日誌

```bash
aws logs tail /aws/lambda/comic-vibe-login-dev --follow
```

## 階段 4 後端完成定義

- ✅ `npm test` 全綠(26 tests)
- ✅ SSM Parameter Store 兩個 parameter 建好
- ✅ `npm run deploy` 成功
- ✅ cURL 6 個測試全部如預期
- ✅ 沒帶 / 帶錯 token 一律 401
