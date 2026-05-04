// Package handler 把 HTTP request 轉成 store / 業務邏輯呼叫,並包裝回應。
package handler

import (
	"crypto/subtle"
	"encoding/json"
	"io"

	"github.com/gin-gonic/gin"

	"comic-record/server/internal/auth"
	"comic-record/server/internal/httpx"
	"comic-record/server/internal/manga"
)

// PostLogin:對齊舊 login.ts。timing-safe 比對密碼 + 簽 30 天 JWT。
func PostLogin(appPassword string, jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			httpx.InternalError(c, err)
			return
		}

		// 空 body 等同 {}(對齊 TS parseJsonBody)
		if len(body) == 0 {
			body = []byte("{}")
		}
		if !json.Valid(body) {
			httpx.MalformedJSON(c)
			return
		}

		var raw map[string]json.RawMessage
		if err := json.Unmarshal(body, &raw); err != nil {
			httpx.Validation(c, "request body must be a JSON object", nil)
			return
		}

		passRaw, ok := raw["password"]
		if !ok {
			httpx.Validation(c, "password is required and must be a string", map[string]any{"field": "password"})
			return
		}
		var password string
		if err := json.Unmarshal(passRaw, &password); err != nil {
			httpx.Validation(c, "password is required and must be a string", map[string]any{"field": "password"})
			return
		}

		if subtle.ConstantTimeCompare([]byte(password), []byte(appPassword)) != 1 {
			httpx.Unauthorized(c, "invalid password")
			return
		}

		token, err := auth.Sign(jwtSecret, manga.FixedUserID)
		if err != nil {
			httpx.InternalError(c, err)
			return
		}
		httpx.OK(c, gin.H{"token": token})
	}
}
