// Package auth 處理 JWT 簽發與驗證。
// HS256 + 30 天 TTL,完全相容舊 jose 簽出來的 token
//(同 secret + 同 alg + 標準 claims)。
package auth

import (
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const tokenTTL = 30 * 24 * time.Hour

// Sign 用 HMAC-SHA256 簽一個 token,sub claim 放使用者 id。
func Sign(secret []byte, sub string) (string, error) {
	now := time.Now()
	claims := jwt.RegisteredClaims{
		Subject:   sub,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// Verify 驗證 token 並回傳 sub claim。
// 過期、簽章錯、algorithm 不對都回 error。
func Verify(secret []byte, tokenStr string) (string, error) {
	parsed, err := jwt.ParseWithClaims(tokenStr, &jwt.RegisteredClaims{}, func(t *jwt.Token) (any, error) {
		// 強制檢查 alg,擋下 none / RS256 等不該出現的演算法
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	})
	if err != nil {
		return "", err
	}
	if !parsed.Valid {
		return "", errors.New("invalid token")
	}
	claims, ok := parsed.Claims.(*jwt.RegisteredClaims)
	if !ok || claims.Subject == "" {
		return "", errors.New("missing subject claim")
	}
	return claims.Subject, nil
}

// ExtractBearer 從 Authorization header 抽 "Bearer xxx" 的 xxx。
// 找不到回空字串,讓上層自己決定回 401。
func ExtractBearer(authHeader string) string {
	if authHeader == "" {
		return ""
	}
	const prefix = "Bearer "
	// 大小寫不敏感比對(API Gateway 行為)
	if len(authHeader) < len(prefix) || !strings.EqualFold(authHeader[:len(prefix)], prefix) {
		return ""
	}
	return strings.TrimSpace(authHeader[len(prefix):])
}
