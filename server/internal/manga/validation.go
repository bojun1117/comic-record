package manga

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// ValidationError 對齊 TS 版,handler 接到後轉成 400 VALIDATION_ERROR。
type ValidationError struct {
	Message string
	Details map[string]any
}

func (e *ValidationError) Error() string { return e.Message }

func newErr(msg string, details map[string]any) *ValidationError {
	return &ValidationError{Message: msg, Details: details}
}

// ─── 單欄位驗證 ─────────────────────────────────────────────────────

// 註:每個 validator 接 json.RawMessage,自己決定怎麼解。null 比 absent 更
// 嚴格地表達「我要把它清掉」,所以 nullable 欄位都顯式接受 JSON null。

func validateTitle(raw json.RawMessage) (string, error) {
	var v string
	if err := json.Unmarshal(raw, &v); err != nil {
		return "", newErr("title must be a string", map[string]any{"field": "title"})
	}
	t := strings.TrimSpace(v)
	if len(t) < 1 || len([]rune(t)) > 200 {
		return "", newErr("title must be 1-200 characters after trim",
			map[string]any{"field": "title"})
	}
	return t, nil
}

// 接受 JSON null 或 0-9999 整數。
// 回傳 *int:nil 代表 null。
func validateNonNegativeIntOrNull(raw json.RawMessage, field string) (*int, error) {
	if isJSONNull(raw) {
		return nil, nil
	}
	num, err := decodeJSONNumber(raw)
	if err != nil {
		return nil, newErr(
			fmt.Sprintf("%s must be a non-negative integer (0-9999) or null", field),
			map[string]any{"field": field},
		)
	}
	i64, err := num.Int64()
	if err != nil || i64 < 0 || i64 > 9999 {
		return nil, newErr(
			fmt.Sprintf("%s must be a non-negative integer (0-9999) or null", field),
			map[string]any{"field": field},
		)
	}
	v := int(i64)
	return &v, nil
}

func validateStatus(raw json.RawMessage) (Status, error) {
	var v string
	if err := json.Unmarshal(raw, &v); err != nil {
		return "", newErr(
			fmt.Sprintf("status must be one of: %s", joinStatuses()),
			map[string]any{"field": "status", "allowed": AllStatuses()},
		)
	}
	s := Status(v)
	if !IsValidStatus(s) {
		return "", newErr(
			fmt.Sprintf("status must be one of: %s", joinStatuses()),
			map[string]any{"field": "status", "allowed": AllStatuses()},
		)
	}
	return s, nil
}

func validateCategory(raw json.RawMessage) (Category, error) {
	if isJSONNull(raw) {
		return "", newErr("category cannot be null (use a valid enum value)",
			map[string]any{"field": "category", "allowed": AllCategories()})
	}
	var v string
	if err := json.Unmarshal(raw, &v); err != nil {
		return "", newErr(
			fmt.Sprintf("category must be one of: %s", joinCategories()),
			map[string]any{"field": "category", "allowed": AllCategories()},
		)
	}
	c := Category(v)
	if !IsValidCategory(c) {
		return "", newErr(
			fmt.Sprintf("category must be one of: %s", joinCategories()),
			map[string]any{"field": "category", "allowed": AllCategories()},
		)
	}
	return c, nil
}

// 接受 null 或整數 1-5。
func validateRating(raw json.RawMessage) (*int, error) {
	if isJSONNull(raw) {
		return nil, nil
	}
	num, err := decodeJSONNumber(raw)
	if err != nil {
		return nil, newErr("rating must be an integer 1-5 or null",
			map[string]any{"field": "rating"})
	}
	i64, err := num.Int64()
	if err != nil || i64 < 1 || i64 > 5 {
		return nil, newErr("rating must be an integer 1-5 or null",
			map[string]any{"field": "rating"})
	}
	v := int(i64)
	return &v, nil
}

func validateCoverURL(raw json.RawMessage) (*string, error) {
	if isJSONNull(raw) {
		return nil, nil
	}
	var v string
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, newErr("coverUrl must be a string or null",
			map[string]any{"field": "coverUrl"})
	}
	u, err := url.Parse(v)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, newErr("coverUrl must be a valid http(s) URL or null",
			map[string]any{"field": "coverUrl"})
	}
	return &v, nil
}

func validateNotes(raw json.RawMessage) (*string, error) {
	if isJSONNull(raw) {
		return nil, nil
	}
	var v string
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, newErr("notes must be a string or null",
			map[string]any{"field": "notes"})
	}
	if len([]rune(v)) > 2000 {
		return nil, newErr("notes must be at most 2000 characters",
			map[string]any{"field": "notes", "length": len([]rune(v))})
	}
	return &v, nil
}

// §9.5 跨欄位:rating 不為 null 時 status 必須是 completed。
func checkRatingStatus(status Status, rating *int) error {
	if rating != nil && status != StatusCompleted {
		return newErr(`rating is only allowed when status is "completed"`,
			map[string]any{"rule": "rating_only_when_completed", "status": status, "rating": *rating})
	}
	return nil
}

// ─── 公開 API:POST /mangas 用 ─────────────────────────────────────

type ValidatedCreateInput struct {
	Title          string
	CurrentVolume  *int
	CurrentChapter *int
	Status         Status
	Category       Category
	Rating         *int
	CoverURL       *string
	Notes          *string
}

func ValidateCreate(body []byte) (*ValidatedCreateInput, error) {
	raw, err := decodeObject(body)
	if err != nil {
		return nil, err
	}

	titleRaw, ok := raw["title"]
	if !ok {
		return nil, newErr("title is required", map[string]any{"field": "title"})
	}
	title, err := validateTitle(titleRaw)
	if err != nil {
		return nil, err
	}

	status := StatusPlanToRead
	if r, ok := raw["status"]; ok {
		s, err := validateStatus(r)
		if err != nil {
			return nil, err
		}
		status = s
	}

	category := CategoryOther
	if r, ok := raw["category"]; ok {
		c, err := validateCategory(r)
		if err != nil {
			return nil, err
		}
		category = c
	}

	var currentVolume, currentChapter, rating *int
	var coverURL, notes *string

	if r, ok := raw["currentVolume"]; ok {
		v, err := validateNonNegativeIntOrNull(r, "currentVolume")
		if err != nil {
			return nil, err
		}
		currentVolume = v
	}
	if r, ok := raw["currentChapter"]; ok {
		v, err := validateNonNegativeIntOrNull(r, "currentChapter")
		if err != nil {
			return nil, err
		}
		currentChapter = v
	}
	if r, ok := raw["rating"]; ok {
		v, err := validateRating(r)
		if err != nil {
			return nil, err
		}
		rating = v
	}
	if r, ok := raw["coverUrl"]; ok {
		v, err := validateCoverURL(r)
		if err != nil {
			return nil, err
		}
		coverURL = v
	}
	if r, ok := raw["notes"]; ok {
		v, err := validateNotes(r)
		if err != nil {
			return nil, err
		}
		notes = v
	}

	if err := checkRatingStatus(status, rating); err != nil {
		return nil, err
	}

	return &ValidatedCreateInput{
		Title:          title,
		CurrentVolume:  currentVolume,
		CurrentChapter: currentChapter,
		Status:         status,
		Category:       category,
		Rating:         rating,
		CoverURL:       coverURL,
		Notes:          notes,
	}, nil
}

// ─── 公開 API:PATCH /mangas/{id} 用 ───────────────────────────────

// PATCH 必須區分「沒帶」「帶 null」「帶值」三態。
// 非 nullable 欄位用 *T(nil = 沒帶);nullable 欄位用 setXxx flag + *T(flag=true 且 *T=nil 表示 null)。
type ValidatedPatch struct {
	Title    *string
	Status   *Status
	Category *Category

	SetCurrentVolume  bool
	CurrentVolume     *int
	SetCurrentChapter bool
	CurrentChapter    *int
	SetRating         bool
	Rating            *int
	SetCoverURL       bool
	CoverURL          *string
	SetNotes          bool
	Notes             *string
}

// server-managed,client 帶了不報錯 silently drop。
var ignoredPatchFields = map[string]struct{}{
	"id": {}, "createdAt": {}, "updatedAt": {}, "lastReadAt": {},
}

func ValidatePatch(body []byte, existing *Manga) (*ValidatedPatch, error) {
	raw, err := decodeObject(body)
	if err != nil {
		return nil, err
	}

	patch := &ValidatedPatch{}

	for key, val := range raw {
		if _, drop := ignoredPatchFields[key]; drop {
			continue
		}
		switch key {
		case "title":
			t, err := validateTitle(val)
			if err != nil {
				return nil, err
			}
			patch.Title = &t
		case "status":
			s, err := validateStatus(val)
			if err != nil {
				return nil, err
			}
			patch.Status = &s
		case "category":
			c, err := validateCategory(val)
			if err != nil {
				return nil, err
			}
			patch.Category = &c
		case "currentVolume":
			v, err := validateNonNegativeIntOrNull(val, "currentVolume")
			if err != nil {
				return nil, err
			}
			patch.SetCurrentVolume = true
			patch.CurrentVolume = v
		case "currentChapter":
			v, err := validateNonNegativeIntOrNull(val, "currentChapter")
			if err != nil {
				return nil, err
			}
			patch.SetCurrentChapter = true
			patch.CurrentChapter = v
		case "rating":
			v, err := validateRating(val)
			if err != nil {
				return nil, err
			}
			patch.SetRating = true
			patch.Rating = v
		case "coverUrl":
			v, err := validateCoverURL(val)
			if err != nil {
				return nil, err
			}
			patch.SetCoverURL = true
			patch.CoverURL = v
		case "notes":
			v, err := validateNotes(val)
			if err != nil {
				return nil, err
			}
			patch.SetNotes = true
			patch.Notes = v
		default:
			// §9.8 未知欄位忽略
		}
	}

	// 跨欄位:用合併後的 status / rating 檢查
	finalStatus := existing.Status
	if patch.Status != nil {
		finalStatus = *patch.Status
	}
	finalRating := existing.Rating
	if patch.SetRating {
		finalRating = patch.Rating
	}
	if err := checkRatingStatus(finalStatus, finalRating); err != nil {
		return nil, err
	}

	return patch, nil
}

// 是否動到進度欄位(stage 4 update handler 用來判斷要不要更新 lastReadAt)
func (p *ValidatedPatch) TouchesProgress() bool {
	return p.SetCurrentVolume || p.SetCurrentChapter
}

// ─── helpers ──────────────────────────────────────────────────────

func decodeObject(body []byte) (map[string]json.RawMessage, error) {
	if len(body) == 0 {
		return nil, newErr("request body must be a JSON object", nil)
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, newErr("request body must be a JSON object", nil)
	}
	return raw, nil
}

func isJSONNull(raw json.RawMessage) bool {
	return string(raw) == "null"
}

// 嚴格只接受 JSON number(字串/布林/物件等都拒絕)。
func decodeJSONNumber(raw json.RawMessage) (json.Number, error) {
	var v any
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	if err := dec.Decode(&v); err != nil {
		return "", err
	}
	n, ok := v.(json.Number)
	if !ok {
		return "", fmt.Errorf("not a JSON number")
	}
	return n, nil
}

func joinStatuses() string {
	parts := make([]string, 0, len(AllStatuses()))
	for _, s := range AllStatuses() {
		parts = append(parts, string(s))
	}
	return strings.Join(parts, ", ")
}

func joinCategories() string {
	parts := make([]string, 0, len(AllCategories()))
	for _, c := range AllCategories() {
		parts = append(parts, string(c))
	}
	return strings.Join(parts, ", ")
}
