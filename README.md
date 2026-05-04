# Comic Vibe

> 個人用的漫畫追蹤工具 — 記錄每部漫畫的進度（卷／話）與追完後的推薦指數。

![Status](https://img.shields.io/badge/status-deployed-brightgreen)
![Frontend](https://img.shields.io/badge/frontend-Vue%203%20%2B%20Vite-42b883)
![Backend](https://img.shields.io/badge/backend-Go%20%2B%20Gin%20%2B%20K8s-00ADD8)
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
   ┌────────────────────────────────────────────┐
   │  本機 kind cluster                          │
   │  ┌──────────────────┐                       │
   │  │ nginx-ingress    │ ──┐                   │
   │  └──────────────────┘   │                   │
   │            ▼            │ HPA 2~10 replicas │
   │  ┌──────────────────┐   │                   │
   │  │ comic-vibe-server│ ◄─┘                   │
   │  │  Go + Gin        │  liveness /healthz    │
   │  │  distroless      │  readiness /readyz    │
   │  └────────┬─────────┘                       │
   └───────────┼─────────────────────────────────┘
               │ aws-sdk-go-v2 (透過 K8s Secret 注入 access key)
               ▼
        ┌──────────────────────────────────────────┐
        │  AWS                                      │
        │  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
        │  │ DynamoDB │  │ Bedrock  │  │ SSM     │ │
        │  │ (mangas) │  │ (推薦)    │  │(secrets)│ │
        │  └──────────┘  └──────────┘  └─────────┘ │
        └──────────────────────────────────────────┘
```

> 2026-05 從 AWS Lambda + API Gateway 遷移到 K8s,執行檔語言從 TypeScript 改為 Go。
> 舊架構保留在 [`infra/`](infra/) 目錄供參考,不再使用。

---

## 技術棧

| 範疇 | 使用技術 |
|---|---|
| Frontend | Vue 3 (Composition API)、TypeScript、Vite、Pinia、Vue Router、Tailwind CSS |
| Backend | Go 1.26、Gin、`aws-sdk-go-v2`、`golang-jwt/jwt/v5` |
| Container | multi-stage Docker、distroless/static:nonroot(~29MB image) |
| Orchestration | Kubernetes(本機 kind)、nginx-ingress、HPA(metrics-server) |
| Database | AWS DynamoDB(PAY_PER_REQUEST) — 唯一仍跑在 AWS 的資源 |
| LLM | AWS Bedrock(Claude Haiku 4.5 cross-region inference profile) |
| Auth | JWT(HS256)、AWS SSM Parameter Store 存 secret |
| Hosting | GitHub Pages(前端)、本機 kind cluster(後端) |
| CI/CD | GitHub Actions(push main 自動部署前端) |
| Tooling | ESLint、Prettier、vue-tsc、vitest、`go test` |

完整選型理由與排除項目請見 [`docs/TECH_STACK.md`](docs/TECH_STACK.md)(註:文件還沒同步遷移後內容)。

---

## 專案結構

```
comic-record/
├── web/               # 前端 SPA (Vue 3 + Vite)
├── server/            # Go 後端
│   ├── cmd/server/    # main.go(進入點)
│   ├── internal/
│   │   ├── auth/      # JWT sign/verify
│   │   ├── config/    # env 讀取
│   │   ├── handler/   # HTTP handlers
│   │   ├── httpx/     # JSON response 統一格式
│   │   ├── manga/     # types + validation
│   │   ├── middleware/# CORS / logger / auth
│   │   └── store/     # MangaStore interface + DynamoDB 實作
│   └── Dockerfile     # distroless multi-stage build
├── k8s/               # Kubernetes manifests
│   ├── kind-config.yaml
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml.example
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── hpa.yaml
├── docker-compose.yml # 本機開發跑 docker(K8s 之外的選項)
└── docs/              # 規格與架構文件
```

---

## 快速開始

### 先決條件

- Go 1.26+
- Docker Desktop(macOS)
- `kind`、`kubectl`、`hey`(壓測,可選)
- AWS CLI 已設 `cdk-deploy` 帳號 credential(只需 DynamoDB + Bedrock 權限)
- SSM 已存好 `/comic-vibe/dev/jwt-secret`、`/comic-vibe/dev/app-password`(從舊架構繼承)

### 後端(K8s,本機 kind)

```bash
# 1. 建 kind cluster + nginx-ingress(只需做一次)
kind create cluster --config k8s/kind-config.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.1/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller --timeout=180s

# 2. metrics-server(HPA 用,kind 需要 --kubelet-insecure-tls)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch -n kube-system deployment metrics-server --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# 3. build server image + 載入 kind
docker build -t comic-vibe-server:dev ./server
kind load docker-image comic-vibe-server:dev --name comic-vibe

# 4. 建 namespace / configmap / secret
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
JWT=$(aws ssm get-parameter --name /comic-vibe/dev/jwt-secret --with-decryption --query Parameter.Value --output text)
PWD=$(aws ssm get-parameter --name /comic-vibe/dev/app-password --with-decryption --query Parameter.Value --output text)
AKID=$(aws configure get aws_access_key_id)
SAKEY=$(aws configure get aws_secret_access_key)
kubectl create secret generic comic-vibe-secrets -n comic-vibe \
  --from-literal=JWT_SECRET="$JWT" \
  --from-literal=APP_PASSWORD="$PWD" \
  --from-literal=AWS_ACCESS_KEY_ID="$AKID" \
  --from-literal=AWS_SECRET_ACCESS_KEY="$SAKEY"

# 5. 部署
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# 6. 驗證
curl http://comic-vibe.localtest.me/healthz
```

### 前端

```bash
cd web
npm install
npm run dev
```

開啟 `http://localhost:5173/`,使用 SSM 裡那組密碼登入。
(`.env.development` 已經指向 K8s ingress `http://comic-vibe.localtest.me`)

---

## 部署

> 目前僅本機開發。GitHub Pages 上的舊版前端(指向已退役的 Lambda API)不再可用。
> 想要 production 部署,需要先把 K8s 移到雲端(EKS / GKE / DigitalOcean K8s) + 把 ingress 換成有 TLS 的 host。

### 後端(改 code 後重 deploy)

```bash
docker build -t comic-vibe-server:dev ./server
kind load docker-image comic-vibe-server:dev --name comic-vibe
kubectl rollout restart deployment/comic-vibe-server -n comic-vibe
kubectl rollout status deployment/comic-vibe-server -n comic-vibe
```

零 downtime(`maxUnavailable: 0` + readiness probe + SIGTERM grace period)。

---

## 常用指令

```bash
# 前端開發
cd web && npm run dev

# 前端型別檢查與 lint
cd web && npm run type-check && npm run lint

# 後端本機跑(免 docker,用 export env 直連 AWS)
cd server && go run ./cmd/server

# 後端單元測試
cd server && go test ./...

# 後端 docker 跑(模擬 production 環境)
docker compose up --build

# 後端 K8s rolling deploy
docker build -t comic-vibe-server:dev ./server && \
  kind load docker-image comic-vibe-server:dev --name comic-vibe && \
  kubectl rollout restart deployment/comic-vibe-server -n comic-vibe

# 看 K8s pod log(JSON,所有 replicas)
kubectl logs -n comic-vibe -l app=comic-vibe-server --tail=50 -f

# 看 HPA 狀態
kubectl get hpa -n comic-vibe

# 旋轉登入密碼
aws ssm put-parameter --name /comic-vibe/dev/app-password \
  --value "<new>" --type SecureString --overwrite --region us-east-1
kubectl delete secret comic-vibe-secrets -n comic-vibe
# 重建 secret(同部署流程 step 4)後 rollout restart

# 砍掉本機 cluster(資料不受影響,DynamoDB 在雲端)
kind delete cluster --name comic-vibe
```

---

## 文件索引

| 文件 | 內容 |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | 產品範圍:做什麼、不做什麼 |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | `Manga` 型別定義與欄位規則 |
| [`docs/UI_SPEC.md`](docs/UI_SPEC.md) | 畫面與互動細節 |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | 命名與設計慣例 |
| [`docs/API.md`](docs/API.md) | REST API 完整 contract |
| [`docs/AUTH.md`](docs/AUTH.md) | 密碼／JWT 機制與 secret 旋轉 |

---

## 開發階段

| 階段 | 狀態 | 範圍 |
|---|---|---|
| 1 | ✅ | 純前端 Vue prototype |
| 1.5 | ✅ | 加入分類功能 |
| 2 | ✅ | 反推 API contract |
| 3 | ✅ | AWS CDK 部署:Lambda + DynamoDB + API Gateway |
| 4 | ✅ | 前後端串接、密碼登入(JWT 30 天) |
| 5 | ✅ | GitHub Pages 部署、CORS 收緊到 allowlist、CI/CD 自動化 |
| 6 | ✅ | 後端 TypeScript Lambda → Go + K8s,DynamoDB 保留;Lambda/API Gateway 退場 |

---

## 設計原則

- **不裝大套件做小功能** — 採用 `crypto.randomUUID`、`Intl.RelativeTimeFormat` 等內建 API
- **小步迭代** — 每個任務完成即停下驗證,不累積錯誤
- **成本可控** — AWS billing alert 為底線,超過 $5/月即告警(目前只剩 DynamoDB + Bedrock,通常 < $1/月)

---

## License

MIT — 個人專案，僅供參考使用。
