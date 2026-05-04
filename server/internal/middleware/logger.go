package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// K8s probe 路徑高頻打進來(/readyz 每 10s、/healthz 每 30s),
// 不寫 access log 避免淹沒真實流量。
// probe 失敗時 kubelet 自己會在 pod events 記錄,用 `kubectl describe pod` 看。
var skipAccessLog = map[string]struct{}{
	"/healthz": {},
	"/readyz":  {},
}

// Logger 結構化記錄每個 request 的方法、路徑、狀態、耗時、IP。
// 輸出 JSON 給 K8s kubectl logs / log aggregator 解析。
func Logger(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		if _, skip := skipAccessLog[c.Request.URL.Path]; skip {
			return
		}

		logger.Info("http_request",
			slog.String("method", c.Request.Method),
			slog.String("path", c.Request.URL.Path),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("duration", time.Since(start)),
			slog.String("ip", c.ClientIP()),
		)
	}
}
