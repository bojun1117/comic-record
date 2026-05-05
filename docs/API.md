# API.md — Comic Vibe Backend Contract

階段 2 產物。從階段 1 的 `src/stores/manga.ts` 反推出來的 REST API 規格。
階段 1.5 加入 `category` 欄位後同步更新。
階段 4 加入 `/auth/login` + JWT 認證後同步更新。

---

## 0. 文件導讀

- §1–§2:基礎約定(base URL、認證、時間、錯誤格式)
- §3:資料模型(伺服器視角)與前端 interface 對照
- §4:endpoint 一覽 + store 方法對照表
- §5:`POST /auth/login`(階段 4)
- §6–§9:四個 mangas endpoint 的 request / response 詳述
- §10:伺服器端驗證規則(寫 Lambda 直接抄)
- §11:錯誤碼總表
- §12:未來擴充預留(階段 5+)
- §13:與前端的對接注意事項

---

## 1. 基礎約定

### 1.1 Base URL

| 環境 | URL |
|---|---|
| dev(階段 3 起) | `https://<api-id>.execute-api.us-east-1.amazonaws.com/dev` |
| prod(階段 5) | `https://api.comic-vibe.example.com`(視部署方式決定) |

前端用 `import.meta.env.VITE_API_BASE_URL` 讀。

### 1.2 認證

階段 4 起所有 mangas endpoint **需要** `Authorization: Bearer <jwt>`。
JWT 由 `POST /auth/login` 簽發。

未帶 / 過期 / 簽章錯誤 → 回 `401 UNAUTHORIZED`(見 §11)。

`/auth/login` 本身**不需要** token。

### 1.3 內容格式

- 所有 request / response body 一律 `application/json; charset=utf-8`
- 字串編碼 UTF-8
- 時間一律 **ISO 8601 UTC**(例:`2026-04-27T03:50:00.000Z`)
- 數字欄位以 JSON number 表示,**不接受字串數字**
- `null` 與「欄位不存在」**有別**:`null` 表示「明確清空」,key 不存在表示「不要動」(用於 PATCH)

### 1.4 錯誤回應通用格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "currentVolume must be a non-negative integer or null",
    "details": {
      "field": "currentVolume",
      "received": -1
    }
  }
}
```

| 欄位 | 必填 | 說明 |
|---|---|---|
| `error.code` | ✅ | 機器可讀錯誤碼,見 §11 |
| `error.message` | ✅ | 給開發者看的英文訊息 |
| `error.details` | ⛔ | 視錯誤類型可選 |

### 1.5 CORS

階段 3–4 暫定 `*`(任何 origin 都允許)。階段 5 部署到正式 domain 時收緊。

- `Access-Control-Allow-Origin`: `*`
- `Access-Control-Allow-Methods`: `GET, POST, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers`: `Content-Type, Authorization`
- 所有 endpoint 都支援 `OPTIONS` preflight

---

## 2. 約定的請求行為

- **冪等性**:`GET`、`PATCH`、`DELETE`、`POST /auth/login`(同密碼多次發 = 多張可用 token)為冪等;`POST /mangas` **不冪等**。
- **PATCH 語意**:partial update。**只更新 body 裡有出現的 key**;沒出現的欄位完全不動。
- **回傳完整資源**:`POST /mangas` 與 `PATCH /mangas/{id}` 成功時回傳更新後的完整 `Manga` 物件。

---

## 3. 資料模型

### 3.1 Manga(伺服器視角)

```ts
{
  id: string                      // UUID v4,後端產生
  title: string                   // 1–200 字元,trim 過
  currentVolume: number | null    // 整數 ≥ 0,可空
  currentChapter: number | null   // 整數 ≥ 0,可空
  status: "plan-to-read" | "reading" | "dropped" | "completed"
  category: "hot-blooded" | "mystery" | "adventure" | "romance" | "other"
                                  // 必填,單選,預設 "other"
  rating: number | null           // 整數 1–5,可空(僅 status === "completed" 時才允許非 null)
  coverUrl: string | null         // URL 字串或 null
  notes: string | null            // 任意字串或 null
  lastReadAt: string              // ISO 8601 UTC
  createdAt: string               // ISO 8601 UTC
  updatedAt: string               // ISO 8601 UTC
}
```

### 3.2 與前端 `Manga` interface 對照

100% 一致。前端 `src/types/manga.ts` 與後端回傳結構欄位、型別、可空性都相同。

### 3.3 欄位寫入權限

| 欄位 | client 可在 POST 帶? | client 可在 PATCH 帶? | server 自動產生 / 更新? |
|---|---|---|---|
| `id` | ❌ | ❌ | ✅ POST 時產生 |
| `title` | ✅ 必填 | ✅ | — |
| `currentVolume` | ✅ | ✅ | — |
| `currentChapter` | ✅ | ✅ | — |
| `status` | ✅ | ✅ | — |
| `category` | ✅(可省略 → 預設 `"other"`) | ✅ | — |
| `rating` | ✅(僅 status=completed) | ✅(僅 status=completed) | — |
| `coverUrl` | ✅ | ✅ | — |
| `notes` | ✅ | ✅ | — |
| `lastReadAt` | ❌ | ❌ | ✅ POST 時 = createdAt;PATCH 動到進度時自動更新 |
| `createdAt` | ❌ | ❌ | ✅ POST 時產生 |
| `updatedAt` | ❌ | ❌ | ✅ 每次 POST/PATCH 都更新 |

> client 帶了 server 自動欄位 → 後端**忽略且不報錯**,保持向前相容。

### 3.4 `userId` 內部欄位(不出現在 API)

DynamoDB 表的 PK 是 `userId`,階段 4 寫死 `'me'`(從 JWT `sub` 取得)。
這個欄位**不在 API response 出現**,純粹後端內部使用。

---

## 4. Endpoint 一覽

### 4.1 Endpoint 列表

| Method | Path | 用途 | 認證 | 成功回應 |
|---|---|---|---|---|
| `POST` | `/auth/login` | 用密碼換 JWT | ❌ | `200 OK` + `{token}` |
| `GET` | `/mangas` | 列出所有漫畫 | ✅ | `200 OK` + `Manga[]` |
| `POST` | `/mangas` | 新增一筆 | ✅ | `201 Created` + `Manga` |
| `PATCH` | `/mangas/{id}` | 更新單筆部分欄位 | ✅ | `200 OK` + `Manga` |
| `DELETE` | `/mangas/{id}` | 刪除單筆 | ✅ | `204 No Content` |

### 4.2 前端 store 方法 ↔ HTTP endpoint 對照

| 前端方法 | HTTP | Path | request | response → store 處理 |
|---|---|---|---|---|
| `useAuthStore().login(password)` | `POST` | `/auth/login` | `{password}` | `{token}` → 存 localStorage |
| `useMangaStore().getAll()` | `GET` | `/mangas` | — | `Manga[]` → 覆蓋 `mangas.value` |
| `useMangaStore().add(input)` | `POST` | `/mangas` | `AddMangaInput` | `Manga` → push 到 `mangas.value` |
| `useMangaStore().update(id, patch)` | `PATCH` | `/mangas/{id}` | `Partial<Manga>` | `Manga` → 取代 `mangas.value[idx]` |
| `useMangaStore().remove(id)` | `DELETE` | `/mangas/{id}` | — | `void` → `splice` 掉該筆 |

> 階段 1 / 1.5 的 store 已經是 Promise-based,階段 4 替換時呼叫端零改動。

---

## 5. `POST /auth/login`

### 5.1 Request

```http
POST /auth/login HTTP/1.1
Content-Type: application/json

{
  "password": "your-password"
}
```

無 `Authorization` header(這是登入,還沒有 token)。

### 5.2 Response 200

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

JWT 規格:
- 演算法:HS256
- payload:`{sub: 'me', iat, exp}`
- TTL:30 天(60 × 60 × 24 × 30 秒)
- secret:存在 SSM `/comic-vibe/dev/jwt-secret`

### 5.3 可能錯誤

| Status | code | 情境 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | body 缺 password 或型別錯 |
| 400 | `MALFORMED_JSON` | body 不是合法 JSON |
| 401 | `UNAUTHORIZED` | 密碼錯誤 |
| 500 | `INTERNAL_ERROR` | SSM 讀取失敗、未設密碼等 |

### 5.4 Timing-safe 比對

後端用 `crypto.timingSafeEqual` 比對密碼,即使字串長度不同也用同樣時間,防止透過時間差猜密碼長度。

---

## 6. `GET /mangas`

### 6.1 Request

```http
GET /mangas HTTP/1.1
Authorization: Bearer <jwt>
```

無 query string。

### 6.2 Response 200

```json
[
  {
    "id": "5f9b...",
    "title": "進擊的巨人",
    "currentVolume": 12,
    "currentChapter": 98,
    "status": "reading",
    "category": "adventure",
    "rating": null,
    "coverUrl": null,
    "notes": null,
    "lastReadAt": "2026-04-24T14:30:00.000Z",
    "createdAt": "2025-09-10T08:00:00.000Z",
    "updatedAt": "2026-04-24T14:30:00.000Z"
  }
]
```

- 後端**不保證排序**;前端按 `lastReadAt` desc 自行排。
- 沒任何資料時回 `[]`。
- **篩選邏輯**:無論依 status 還是 category 篩選,目前都在前端用 in-memory filter 完成,後端不接 query。

### 6.3 可能錯誤

| Status | code | 情境 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 未帶 / 無效 / 過期 token |
| 500 | `INTERNAL_ERROR` | DynamoDB 讀取失敗 |

---

## 7. `POST /mangas`

### 7.1 Request

```http
POST /mangas HTTP/1.1
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "title": "咒術迴戰",
  "currentVolume": null,
  "currentChapter": null,
  "status": "plan-to-read",
  "category": "hot-blooded",
  "rating": null,
  "coverUrl": null,
  "notes": null
}
```

#### 必填欄位

- `title`(string, trim 後 1–200 字元)

#### 選填欄位(預設值)

- `currentVolume`、`currentChapter`、`rating`、`coverUrl`、`notes`(未提供視同 `null`)
- `status`:未提供 → 預設 `"plan-to-read"`
- `category`:未提供 → 預設 `"other"`

### 7.2 Response 201

回傳完整 Manga(含後端產生的 `id` / `createdAt` / `updatedAt` / `lastReadAt`)。

### 7.3 可能錯誤

| Status | code | 情境 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 欄位驗證失敗(見 §10) |
| 400 | `MALFORMED_JSON` | body 不是合法 JSON |
| 401 | `UNAUTHORIZED` | 未帶 / 無效 token |
| 500 | `INTERNAL_ERROR` | DynamoDB 寫入失敗 |

---

## 8. `PATCH /mangas/{id}`

### 8.1 Request

```http
PATCH /mangas/5f9b... HTTP/1.1
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "currentChapter": 99
}
```

#### Body 規則

- partial update:只更新 body 裡出現的 key
- 想清空欄位 → 傳 `null`(注意:`category` 為必填,**不接受 `null`**,只接受 5 個合法 enum)
- 不想動欄位 → 不要在 body 出現
- body 帶了 `id` / `createdAt` / `updatedAt` / `lastReadAt` → 後端忽略

### 8.2 後端自動行為

#### 8.2.1 `lastReadAt` 自動更新

只有當 PATCH body 出現 `currentVolume` 或 `currentChapter` 時,才更新 `lastReadAt = now()`。
其他欄位的更新(包括 `category`)不動 `lastReadAt`。

#### 8.2.2 `updatedAt` 一律更新

任何成功的 PATCH 都更新 `updatedAt = now()`。

#### 8.2.3 status / category 切換不影響其他欄位

- PATCH `{"status": "completed"}` 只動 status,其他欄位保留。
- PATCH `{"category": "mystery"}` 只動 category,其他欄位保留。

### 8.3 Response 200

回傳更新後的完整 Manga。

### 8.4 可能錯誤

| Status | code | 情境 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 欄位驗證失敗 |
| 401 | `UNAUTHORIZED` | 未帶 / 無效 token |
| 404 | `NOT_FOUND` | `id` 不存在 |
| 500 | `INTERNAL_ERROR` | DynamoDB 寫入失敗 |

---

## 9. `DELETE /mangas/{id}`

### 9.1 Request

```http
DELETE /mangas/5f9b... HTTP/1.1
Authorization: Bearer <jwt>
```

### 9.2 Response 204

無 body。

### 9.3 可能錯誤

| Status | code | 情境 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 未帶 / 無效 token |
| 404 | `NOT_FOUND` | `id` 不存在 |
| 500 | `INTERNAL_ERROR` | DynamoDB 刪除失敗 |

---

## 10. 伺服器端驗證規則

### 10.1 `title`

- 型別必須是 string
- trim 後長度 1–200
- POST 必填;PATCH 出現則必須通過驗證(不能傳 `null` 或 `""`)

### 10.2 `currentVolume` / `currentChapter`

- 型別必須是 number 或 null
- 若是 number:必須是**非負整數**(`Number.isInteger(n) && n >= 0`)
- 上限:暫定 9999
- 不接受 `"12"`(字串數字)

### 10.3 `status`

- 必須是 `"plan-to-read"`、`"reading"`、`"dropped"`、`"completed"` 其中之一

### 10.4 `category`

- 必須是 `"hot-blooded"`、`"mystery"`、`"adventure"`、`"romance"`、`"other"` 其中之一
- **不允許 `null`**(必填)
- POST 時若未提供 → 後端預設為 `"other"`
- PATCH 時若提供 → 必須是合法 enum,否則 400

### 10.5 `rating`

- 型別必須是 number 或 null
- 若是 number:必須是 1–5 的整數
- **跨欄位規則**:`rating` 為非 null 時,該筆的 `status` 必須是 `"completed"`
  - PATCH:看更新後的最終狀態
- 違反 → 400 `VALIDATION_ERROR`,details: `{"rule": "rating_only_when_completed"}`

### 10.6 `coverUrl`

- 型別必須是 string 或 null
- 若是 string:必須能通過 URL 解析(`new URL()`),且 protocol 為 `http` / `https`
- 階段 1–4 一律 null

### 10.7 `notes`

- 型別必須是 string 或 null
- 長度上限 2000
- 階段 1–4 一律 null

### 10.8 未知欄位

- POST / PATCH body 出現上面以外的欄位 → **忽略,不報錯**(向前相容)
- 例外:`id` / `createdAt` / `updatedAt` / `lastReadAt` 也忽略

### 10.9 認證(階段 4 起)

每個 mangas endpoint 進入 handler 前先檢查:
- `Authorization: Bearer <token>` header 必須存在
- token 可被 SSM 拿到的 JWT secret 用 HS256 驗證
- payload `sub` 必須是字串
- 不過期(exp 由 jose lib 自動檢查)

任一失敗 → 401 `UNAUTHORIZED`。

---

## 11. 錯誤碼總表

| HTTP | `error.code` | 訊息範例 | 觸發情境 |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | `title is required` | §10 任何驗證失敗 |
| 400 | `MALFORMED_JSON` | `request body is not valid JSON` | body 解析失敗 |
| 401 | `UNAUTHORIZED` | `missing token` / `invalid password` / `invalid or expired token` | 無認證 / 認證失敗 |
| 404 | `NOT_FOUND` | `manga not found: 5f9b...` | PATCH / DELETE 對不存在的 id |
| 405 | `METHOD_NOT_ALLOWED` | `PUT not allowed on /mangas/:id` | 用了未支援的 method |
| 413 | `PAYLOAD_TOO_LARGE` | `request body exceeds 64kb` | API Gateway 預設限制以內就好 |
| 429 | `RATE_LIMITED` | `too many requests` | 階段 5+ 加 rate limit 才會出現 |
| 500 | `INTERNAL_ERROR` | `internal server error` | DynamoDB / Lambda / SSM 例外 |
| 503 | `SERVICE_UNAVAILABLE` | `service temporarily unavailable` | 後端正在部署 / 維護(階段 5+) |

---

## 12. 未來擴充預留

### 12.1 多使用者

階段 4 寫死 `userId = 'me'`。日後若要多人:
- 加註冊 endpoint(或還是用 SSM,key 改 `users:<id>`)
- JWT `sub` 從固定 `'me'` 變成真的 user id
- DynamoDB 不用改 schema(`userId` PK 已經就位)

### 12.2 軟刪除

階段 3 暫定**硬刪除**。若要垃圾桶:
- 加欄位 `deletedAt: string | null`
- `GET /mangas` 預設過濾 `deletedAt === null`
- 加 `GET /mangas?includeDeleted=true`、`POST /mangas/:id/restore`

### 12.3 分頁與後端篩選

預留 query string:
- `?limit=50`(預設 100,上限 500)
- `?cursor=<opaque>`
- `?status=reading`、`?category=hot-blooded`(目前篩選都在前端)

### 12.4 多分類 / 自訂分類

目前 `category` 是單選 + 固定 5 個 enum。如未來要做:
- **多選**:把欄位改成 `categories: MangaCategory[]`,後端 / 前端 / DB 三邊一起改。breaking change,需要明確訂版本。
- **自訂分類**:加一張 `Categories` 表,`Manga.categoryId: string`。屆時 enum 換成動態。

### 12.5 樂觀鎖

階段 5 多裝置可加 `If-Match: <updatedAt>` header,後端用 DynamoDB conditional update。

### 12.6 預留欄位(`coverUrl`、`notes`)

`Manga` interface 已經有,API 也接受,只是階段 1–4 前端 UI 都不暴露。

---

## 13. 與前端的對接注意事項

### 13.1 store 介面不變

`useMangaStore()` 的 4 個方法簽名 100% 一樣。元件層 0 改動。

### 13.2 替換點

`src/stores/manga.ts` 內部:in-memory 陣列 → `fetch()` 包在 API client。

### 13.3 載入時機

- `App.vue` / `HomeView.vue` 的 `onMounted` 呼叫 `store.getAll()`(僅在 `isAuthenticated` 時)
- 載入完之前 UI 顯示 skeleton

### 13.4 樂觀更新 + rollback

- `update`:先在本地套用 patch,失敗時還原原值並 throw
- `remove`:先 splice 本地,失敗時 splice 回原位

### 13.5 token 失效自動處理

store 偵測到 401 → 呼叫 `auth.logout()`(清 token + localStorage)→ 路由守衛踢回 `/login`。

### 13.6 環境變數

`comic-vibe/.env.development` 的 `VITE_API_BASE_URL` 指向 ApiUrl。

---

## 附錄 A:範例 cURL

### 登入

```bash
curl -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'
# → {"token":"eyJ..."}
```

### 取得全部
```bash
curl "$BASE/mangas" -H "Authorization: Bearer $TOKEN"
```

### 新增

```bash
curl -X POST "$BASE/mangas" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "咒術迴戰",
    "status": "plan-to-read",
    "category": "hot-blooded",
    "currentVolume": null,
    "currentChapter": null,
    "rating": null,
    "coverUrl": null,
    "notes": null
  }'
```

### 改分類

```bash
curl -X PATCH "$BASE/mangas/5f9b..." \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "mystery"}'
```

### 更新進度

```bash
curl -X PATCH "$BASE/mangas/5f9b..." \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentChapter": 99}'
```

### 刪除

```bash
curl -X DELETE "$BASE/mangas/5f9b..." \
  -H "Authorization: Bearer $TOKEN"
```

---

## 階段 2 + 4 完成定義

- ✅ 列出所有 endpoint 與其 request / response 結構
- ✅ 對應前端 store 方法
- ✅ 列出所有驗證規則
- ✅ 列出所有錯誤碼
- ✅ 階段 1.5 加分類後同步更新
- ✅ 階段 4 加 `/auth/login` + JWT 認證後同步更新

進入**階段 5**(可選):部署到正式 domain、收緊 CORS、JWT 改 httpOnly cookie。
