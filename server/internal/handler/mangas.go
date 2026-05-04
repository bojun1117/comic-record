package handler

import (
	"encoding/json"
	"errors"
	"io"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"comic-record/server/internal/httpx"
	"comic-record/server/internal/manga"
	"comic-record/server/internal/middleware"
	"comic-record/server/internal/store"
)

// userID 從 RequireAuth middleware 注入,handler 都假設一定有(沒中 middleware 的路由不會走到這)。
func userIDFromContext(c *gin.Context) string {
	return c.GetString(middleware.ContextUserIDKey)
}

// GET /mangas — 對齊 list-mangas.ts。
func ListMangas(s store.MangaStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		mangas, err := s.List(c.Request.Context(), userIDFromContext(c))
		if err != nil {
			httpx.InternalError(c, err)
			return
		}
		httpx.OK(c, mangas)
	}
}

// POST /mangas — 對齊 create-manga.ts。
func CreateManga(s store.MangaStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromContext(c)

		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			httpx.InternalError(c, err)
			return
		}
		if len(body) > 0 && !json.Valid(body) {
			httpx.MalformedJSON(c)
			return
		}

		input, err := manga.ValidateCreate(body)
		if err != nil {
			respondValidationError(c, err)
			return
		}

		// 同名擋重複
		dup, err := s.FindByTitle(c.Request.Context(), userID, input.Title, "")
		if err != nil && !errors.Is(err, store.ErrNotFound) {
			httpx.InternalError(c, err)
			return
		}
		if dup != nil {
			httpx.Conflict(c, "已有相同名稱的漫畫:"+input.Title,
				map[string]any{"field": "title", "existingId": dup.ID})
			return
		}

		now := time.Now().UTC().Format(time.RFC3339)
		m := manga.Manga{
			ID:             uuid.NewString(),
			Title:          input.Title,
			CurrentVolume:  input.CurrentVolume,
			CurrentChapter: input.CurrentChapter,
			Status:         input.Status,
			Category:       input.Category,
			Rating:         input.Rating,
			CoverURL:       input.CoverURL,
			Notes:          input.Notes,
			LastReadAt:     now,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := s.Put(c.Request.Context(), userID, &m); err != nil {
			httpx.InternalError(c, err)
			return
		}
		httpx.Created(c, m)
	}
}

// PATCH /mangas/:id — 對齊 update-manga.ts。
func UpdateManga(s store.MangaStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromContext(c)
		id := c.Param("id")
		if id == "" {
			httpx.Validation(c, "id path parameter is required", nil)
			return
		}

		existing, err := s.Get(c.Request.Context(), userID, id)
		if errors.Is(err, store.ErrNotFound) {
			httpx.NotFoundManga(c, id)
			return
		}
		if err != nil {
			httpx.InternalError(c, err)
			return
		}

		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			httpx.InternalError(c, err)
			return
		}
		if len(body) > 0 && !json.Valid(body) {
			httpx.MalformedJSON(c)
			return
		}

		patch, err := manga.ValidatePatch(body, existing)
		if err != nil {
			respondValidationError(c, err)
			return
		}

		// 改名擋重複
		if patch.Title != nil && *patch.Title != existing.Title {
			dup, err := s.FindByTitle(c.Request.Context(), userID, *patch.Title, existing.ID)
			if err != nil && !errors.Is(err, store.ErrNotFound) {
				httpx.InternalError(c, err)
				return
			}
			if dup != nil {
				httpx.Conflict(c, "已有相同名稱的漫畫:"+*patch.Title,
					map[string]any{"field": "title", "existingId": dup.ID})
				return
			}
		}

		now := time.Now().UTC().Format(time.RFC3339)
		updated := *existing
		applyPatch(&updated, patch)
		updated.UpdatedAt = now
		if patch.TouchesProgress() {
			updated.LastReadAt = now
		}

		if err := s.Put(c.Request.Context(), userID, &updated); err != nil {
			httpx.InternalError(c, err)
			return
		}
		httpx.OK(c, updated)
	}
}

// DELETE /mangas/:id — 對齊 delete-manga.ts。
func DeleteManga(s store.MangaStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromContext(c)
		id := c.Param("id")
		if id == "" {
			httpx.Validation(c, "id path parameter is required", nil)
			return
		}

		// 對齊 TS:先 Get 確認存在,不存在就 404(不是悄悄成功)
		_, err := s.Get(c.Request.Context(), userID, id)
		if errors.Is(err, store.ErrNotFound) {
			httpx.NotFoundManga(c, id)
			return
		}
		if err != nil {
			httpx.InternalError(c, err)
			return
		}

		if err := s.Delete(c.Request.Context(), userID, id); err != nil {
			httpx.InternalError(c, err)
			return
		}
		httpx.NoContent(c)
	}
}

// applyPatch 把通過驗證的 patch 套到 existing 上。
// 等同舊 TS update-manga.ts 的 spread `{...existing, ...patch}`。
func applyPatch(m *manga.Manga, p *manga.ValidatedPatch) {
	if p.Title != nil {
		m.Title = *p.Title
	}
	if p.Status != nil {
		m.Status = *p.Status
	}
	if p.Category != nil {
		m.Category = *p.Category
	}
	if p.SetCurrentVolume {
		m.CurrentVolume = p.CurrentVolume
	}
	if p.SetCurrentChapter {
		m.CurrentChapter = p.CurrentChapter
	}
	if p.SetRating {
		m.Rating = p.Rating
	}
	if p.SetCoverURL {
		m.CoverURL = p.CoverURL
	}
	if p.SetNotes {
		m.Notes = p.Notes
	}
}

// respondValidationError 統一處理 manga.ValidationError。
func respondValidationError(c *gin.Context, err error) {
	var verr *manga.ValidationError
	if errors.As(err, &verr) {
		httpx.Validation(c, verr.Message, verr.Details)
		return
	}
	httpx.InternalError(c, err)
}
