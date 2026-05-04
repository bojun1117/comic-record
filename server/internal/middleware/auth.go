package middleware

import (
	"github.com/gin-gonic/gin"

	"comic-record/server/internal/auth"
	"comic-record/server/internal/httpx"
)

const ContextUserIDKey = "userID"

// RequireAuth 驗證 Bearer token,合法就把 sub 注入 context 給後續 handler 用。
// 對齊舊 Lambda require-auth.ts。
func RequireAuth(secret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := auth.ExtractBearer(c.GetHeader("Authorization"))
		if token == "" {
			httpx.Unauthorized(c, "missing token")
			return
		}
		sub, err := auth.Verify(secret, token)
		if err != nil {
			httpx.Unauthorized(c, "invalid or expired token")
			return
		}
		c.Set(ContextUserIDKey, sub)
		c.Next()
	}
}
