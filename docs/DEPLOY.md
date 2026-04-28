# DEPLOY.md — 階段 5 部署到 GitHub Pages

把前端部署到 `https://bojun1117.github.io/comic-record/`,讓手機也能用。
後端 CDK CORS 收緊到只允許 localhost + 這個 URL。

---

## 0. 前置假設

- GitHub repo:`https://github.com/bojun1117/comic-record`
- 階段 4 後端已部署成功,你有 ApiUrl
- 已經設定好 SSM `app-password` 與 `jwt-secret`

## 專案結構假設

GitHub Actions workflow 假設 monorepo 結構:

```
你的 repo 根/
├── comic-vibe/          # 前端
├── infra/               # 後端 CDK
├── docs/                # 規格文件
└── .github/workflows/
    └── deploy.yml
```

如果你的 repo 結構不一樣(例如 `comic-vibe/` 直接當 repo 根),要改 `deploy.yml` 裡的 `working-directory` 與 `cache-dependency-path`。

---

## 1. 部署後端(收緊 CORS)

階段 4 的後端 CORS 是 `*`,階段 5 改成 `['http://localhost:5173', 'https://bojun1117.github.io']`。

```bash
cd infra
npm install
npm run diff       # 應該看到 ALLOWED_ORIGINS env 變化
npm run deploy
```

部署完成後驗證 CORS 已收緊:

```bash
BASE="https://lfesyvfmz9.execute-api.us-east-1.amazonaws.com/dev"

# 從 evil.com 發 preflight,應該被拒
curl -i -X OPTIONS "$BASE/mangas" \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: GET"

# 從 localhost 發,應該允許
curl -i -X OPTIONS "$BASE/mangas" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
```

evil.com 的 response 不會帶 `Access-Control-Allow-Origin: https://evil.com`(瀏覽器會擋下),localhost 的會。

---

## 2. 把專案 push 到 GitHub repo

如果還沒推:

```bash
cd 你的專案根目錄
git init                                    # 若還沒 init
git add -A
git commit -m "feat: 階段 1–5 完整版"
git branch -M main
git remote add origin https://github.com/bojun1117/comic-record.git
git push -u origin main
```

push 之後 GitHub Actions 會自動觸發 `.github/workflows/deploy.yml`。

---

## 3. 在 GitHub repo 啟用 Pages

只要做一次:

1. 打開 `https://github.com/bojun1117/comic-record`
2. **Settings** → 左側 **Pages**
3. **Source**:選 **GitHub Actions**(不是 Deploy from branch)
4. 儲存

第一次 push 後,workflow 會跑 build + deploy。約 2–3 分鐘。

---

## 4. 看 Actions 結果

打開 `https://github.com/bojun1117/comic-record/actions`

- 綠色勾 = 成功 → 開 `https://bojun1117.github.io/comic-record/`
- 紅色叉 = 失敗 → 點進去看 log

最常見失敗原因:
- `npm ci` 失敗 → `package-lock.json` 沒 commit
- Pages source 沒設成 GitHub Actions
- `working-directory` 不對(repo 結構與假設不符)

---

## 5. 從手機驗收

打開手機瀏覽器 → `https://bojun1117.github.io/comic-record/`

預期流程:
1. 跳到 `/comic-record/login`
2. 輸入 SSM 設的密碼
3. 跳回 `/comic-record/`,看到你 DynamoDB 裡的所有漫畫
4. 新增一筆 → 重新整理還在
5. 在電腦版打開,**看到剛剛從手機新增的那筆**(這是「多裝置同步」)

---

## 6. 常見問題

### 「白畫面、F12 看到 404 載不到 assets」

`base` 路徑不對。檢查:
- `vite.config.ts` 的 `VITE_BASE_PATH ?? '/comic-record/'`
- GitHub Actions workflow 的 `VITE_BASE_PATH: /comic-record/`
- repo 名字真的是 `comic-record`(不是 `Comic-Record` 之類)

### 「點擊內部連結 / 重新整理會 404」

GitHub Pages 不支援 SPA 路由 fallback。`public/404.html` 是繞道方案。
確認:
- `dist/404.html` 有產生
- `index.html` 開頭有那段還原 script

### 「登入按下去沒反應 / Network 看到 CORS error」

後端 CORS allowlist 沒包含你的 GitHub Pages URL。檢查:
- `infra/lib/infra-stack.ts` 的 `corsAllowedOrigins` 包含 `https://bojun1117.github.io`
- 後端有重新部署(`npm run deploy`)

### 「我改了 CORS 但前端還是 CORS error」

API Gateway 的 CORS preflight 設定有 cache,有時候要等幾分鐘 / 強制重整(Cmd+Shift+R)。
或者瀏覽器 cache 了 preflight,試:DevTools → Network → 勾「Disable cache」。

### 「GitHub Pages 的 origin 為什麼不含 /comic-record/?」

CORS 規範 `Origin` 只看 `protocol://host:port`,不含路徑。所以 `https://bojun1117.github.io/comic-record/foo` 與 `https://bojun1117.github.io/anything` 對 CORS 都是同一個 origin `https://bojun1117.github.io`。

> 副作用:你 GitHub Pages 上的**任何其他 repo**(只要也部署成 Pages)都能打你這個 API。但同樣需要 JWT,所以實際上還是只有你能用。

---

## 7. 之後修改 / 重新部署

### 改前端 → push 就好

```bash
git add comic-vibe/
git commit -m "feat: ..."
git push
```

Actions 自動跑,~2 分鐘後 `https://bojun1117.github.io/comic-record/` 就更新了。

### 改後端 → 手動 deploy

```bash
cd infra
npm run deploy
```

> 後端不放進 GitHub Actions 自動部署,因為 Lambda / DynamoDB 改錯影響大,寧可手動跑 + 看 diff 再決定。

### 改密碼

```bash
aws ssm put-parameter \
  --name "/comic-vibe/dev/app-password" \
  --value "新密碼" --type SecureString --overwrite \
  --region us-east-1
cd infra && npm run deploy   # 立刻生效
```

---

## 階段 5 完成定義

- ✅ 後端 CORS 收緊到 localhost + GitHub Pages
- ✅ 前端 push 後 GitHub Actions 自動 build + deploy
- ✅ `https://bojun1117.github.io/comic-record/` 可以打開
- ✅ 手機可以登入、新增、編輯、刪除
- ✅ 多裝置同步(電腦改、手機立刻看到)

---

## 下一步可選

- 自訂 domain(在 Settings → Pages → Custom domain 填,例如 `manga.example.com`)
- 加 CDN cache headers(Cloudflare 在 GH Pages 前面套一層)
- JWT 改 httpOnly cookie + CSRF token(現在用 localStorage 易被 XSS 偷)
- WAF / Login rate limit(防爆破密碼)
