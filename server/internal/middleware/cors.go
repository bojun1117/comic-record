package middleware

import (
	"net/http"
	"slices"

	"github.com/gin-gonic/gin"
)

// CORS 對齊舊 Lambda http.ts 的行為:
//   - origin 在 allowlist 裡 → echo 回去
//   - 不在 → 回 allowlist 第一個(瀏覽器會擋,但 response 結構正確)
//   - 一律加 Vary: Origin,讓 CDN/快取依 Origin 區分
func CORS(allowedOrigins []string) gin.HandlerFunc {
	fallback := ""
	if len(allowedOrigins) > 0 {
		fallback = allowedOrigins[0]
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		echo := fallback
		if origin != "" && slices.Contains(allowedOrigins, origin) {
			echo = origin
		}

		h := c.Writer.Header()
		if echo != "" {
			h.Set("Access-Control-Allow-Origin", echo)
		}
		h.Set("Vary", "Origin")
		h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
