# AUTH.md — 認證機制

「單一密碼登入」。本文件說明後端與前端怎麼實作,以及如何修改密碼 / 旋轉 secret。

## 概念

- 只有一個使用者(你)→ 不需要註冊、不需要 email、不需要密碼重設流程
- 一個密碼 + JWT。輸入密碼 → 後端發 JWT → 前端帶 JWT 打 API
- 密碼存 AWS SSM Parameter Store(SecureString)為 source of truth
- JWT secret 也存 SSM,HS256 簽名,30 天過期
- K8s 部署時把 SSM 值複製進 K8s Secret 注入 Pod env(每次部署同步一次)
- 前端存 `localStorage`(下次開瀏覽器還是登入狀態)

## 流程

```
使用者 → 前端 LoginView → POST /auth/login {password}
                          ↓
                  Go server(Pod 內讀 env APP_PASSWORD)
                          ↓
                       timing-safe 比對(crypto/subtle)
                          ↓
                       對 → 簽 JWT(sub: 'me', 30 天)→ 200 {token}
                       錯 → 401 UNAUTHORIZED
                          ↓
前端把 token 存 localStorage('comic-vibe.token')
之後每次打 /mangas/* 都帶 Authorization: Bearer <token>
```

每個 mangas route 由 `RequireAuth` middleware 把關,沒 token / 過期 / 簽章錯 → 401。

## 修改密碼

```bash
# 1. 改 SSM(source of truth)
aws ssm put-parameter \
  --name "/comic-vibe/dev/app-password" \
  --value "新密碼" \
  --type SecureString \
  --overwrite \
  --region us-east-1

# 2. 同步到 K8s Secret 並重啟 pod
PWD=$(aws ssm get-parameter --name /comic-vibe/dev/app-password --with-decryption --query Parameter.Value --output text)
kubectl create secret generic comic-vibe-secrets -n comic-vibe \
  --from-literal=APP_PASSWORD="$PWD" \
  --from-literal=JWT_SECRET="$(aws ssm get-parameter --name /comic-vibe/dev/jwt-secret --with-decryption --query Parameter.Value --output text)" \
  --from-literal=AWS_ACCESS_KEY_ID="$(aws configure get aws_access_key_id)" \
  --from-literal=AWS_SECRET_ACCESS_KEY="$(aws configure get aws_secret_access_key)" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment/comic-vibe-server -n comic-vibe
```

新密碼立即生效(rolling restart 後新 pod 讀新 env)。

## 旋轉 JWT secret(讓所有現有 token 失效)

```bash
aws ssm put-parameter \
  --name "/comic-vibe/dev/jwt-secret" \
  --value "$(openssl rand -base64 32)" \
  --type SecureString \
  --overwrite \
  --region us-east-1

# 同上,把 K8s Secret 重建 + rollout restart
```

換完後所有舊 token 都會 401(因為簽章對不上),所有人(=你)都要重新登入。
適合的時機:懷疑密碼外洩、把專案丟到公開 repo 之前(順便確認沒留東西)、年度安全 hygiene。

## 前端存儲位置

- `localStorage['comic-vibe.token']`:JWT 字串
- 不存其他 user info(只有你一個人,沒必要)

存 localStorage 的安全考量:
- 弱點:任何在這個 origin 跑的 JS 都讀得到(包括第三方腳本、瀏覽器擴充)
- 對策:本專案不引入第三方 JS、只用自己控制的 origin
- UX 收益:關瀏覽器再開不用重新登入,30 天內持續有效

> 替代方案 sessionStorage 比較安全,但每次重開瀏覽器都要登入,單人用太煩。日後若部署到正式 domain,可考慮改用 httpOnly cookie + CSRF token。

## token 失效自動處理

前端 store 偵測到 401:
1. 清掉 localStorage 的 token
2. 路由守衛偵測到沒 token,把使用者踢回 `/login`(`?redirect=` 帶原本想去的路徑)

這發生在:
- token 過期(30 天)
- JWT secret 旋轉
- token 被人為清除

## 未來強化(現在不做,先記)

- 改 httpOnly cookie + CSRF token(防 XSS 偷 token)
- Login 端點加 rate limiting(連續失敗 5 次鎖 15 分鐘)
- 推到雲端 K8s 後加 ingress 層的 IP allowlist 防爆破密碼
