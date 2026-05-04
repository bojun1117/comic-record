# syntax=docker/dockerfile:1.7

# ─── Build stage ─────────────────────────────────────────────────────
FROM golang:1.26-alpine AS build

WORKDIR /src

# 先複製 go.mod / go.sum,讓 layer cache 在原始碼變動時不會重抓 deps
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .

# CGO_ENABLED=0:純靜態二進位,distroless/static 才跑得動
# -ldflags="-s -w":去除 debug 與 symbol table,省幾 MB
# -trimpath:build path 不要寫進 binary
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    CGO_ENABLED=0 GOOS=linux GOARCH=$(go env GOARCH) \
    go build -trimpath -ldflags="-s -w" -o /server ./cmd/server

# ─── Runtime stage ───────────────────────────────────────────────────
# distroless/static:無 shell、無 package manager、僅 ca-certs + tzdata
# nonroot 變體會以 UID 65532 執行,符合 K8s securityContext 最小權限原則
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /server /server

# AWS SDK 會看 $HOME/.aws/{credentials,config}。
# 本機 docker compose 把 ~/.aws 掛進來時,要設對 HOME。
# K8s 階段改成 IRSA / env 注入 access key,不會用到這條。
ENV HOME=/home/nonroot

EXPOSE 8080

ENTRYPOINT ["/server"]
