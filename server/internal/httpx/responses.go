// Package httpx 統一 JSON response 格式。
// 對齊舊 Lambda http.ts:成功就 body、失敗就 {"error":{"code","message","details"}}。
// CORS header 由 middleware 統一處理,不在這裡碰。
package httpx

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

type errorBody struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

type errorWrapper struct {
	Error errorBody `json:"error"`
}

func OK(c *gin.Context, body any)      { c.JSON(http.StatusOK, body) }
func Created(c *gin.Context, body any) { c.JSON(http.StatusCreated, body) }
func NoContent(c *gin.Context)         { c.Status(http.StatusNoContent) }

// Error 是底層通用錯誤回應,details 可為 nil。
func Error(c *gin.Context, status int, code, message string, details map[string]any) {
	c.AbortWithStatusJSON(status, errorWrapper{
		Error: errorBody{Code: code, Message: message, Details: details},
	})
}

// 對齊 http.ts 各個常用 helper:

func Validation(c *gin.Context, message string, details map[string]any) {
	Error(c, http.StatusBadRequest, "VALIDATION_ERROR", message, details)
}

func MalformedJSON(c *gin.Context) {
	Error(c, http.StatusBadRequest, "MALFORMED_JSON", "request body is not valid JSON", nil)
}

func Unauthorized(c *gin.Context, message string) {
	if message == "" {
		message = "missing or invalid token"
	}
	Error(c, http.StatusUnauthorized, "UNAUTHORIZED", message, nil)
}

func NotFoundManga(c *gin.Context, id string) {
	Error(c, http.StatusNotFound, "NOT_FOUND", "manga not found: "+id, map[string]any{"id": id})
}

func Conflict(c *gin.Context, message string, details map[string]any) {
	Error(c, http.StatusConflict, "CONFLICT", message, details)
}

func InternalError(c *gin.Context, err error) {
	slog.ErrorContext(c.Request.Context(), "internal_error", slog.Any("err", err))
	Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
}
