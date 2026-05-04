package manga

import (
	"errors"
	"strings"
	"testing"
)

// ─── Create ─────────────────────────────────────────────────────────

func TestValidateCreate_HappyPath(t *testing.T) {
	in, err := ValidateCreate([]byte(`{"title":"進擊的巨人"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if in.Title != "進擊的巨人" {
		t.Errorf("title = %q", in.Title)
	}
	if in.Status != StatusPlanToRead {
		t.Errorf("status default = %q, want plan-to-read", in.Status)
	}
	if in.Category != CategoryOther {
		t.Errorf("category default = %q, want other", in.Category)
	}
	if in.CurrentVolume != nil || in.CurrentChapter != nil ||
		in.Rating != nil || in.CoverURL != nil || in.Notes != nil {
		t.Error("nullable fields should default to nil")
	}
}

func TestValidateCreate_FullBody(t *testing.T) {
	body := `{
		"title":"  鋼之鍊金術師  ",
		"status":"completed",
		"category":"adventure",
		"currentVolume":27,
		"currentChapter":108,
		"rating":5,
		"coverUrl":"https://example.com/cover.jpg",
		"notes":"經典神作"
	}`
	in, err := ValidateCreate([]byte(body))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if in.Title != "鋼之鍊金術師" {
		t.Errorf("title not trimmed: %q", in.Title)
	}
	if in.Status != StatusCompleted || in.Category != CategoryAdventure {
		t.Errorf("status/category mismatch")
	}
	if in.CurrentVolume == nil || *in.CurrentVolume != 27 {
		t.Errorf("currentVolume = %v", in.CurrentVolume)
	}
	if in.Rating == nil || *in.Rating != 5 {
		t.Errorf("rating = %v", in.Rating)
	}
}

func TestValidateCreate_Errors(t *testing.T) {
	cases := []struct {
		name     string
		body     string
		errField string
	}{
		{"missing title", `{}`, "title"},
		{"non-string title", `{"title":123}`, "title"},
		{"empty title after trim", `{"title":"   "}`, "title"},
		{"title too long", `{"title":"` + strings.Repeat("a", 201) + `"}`, "title"},
		{"invalid status", `{"title":"x","status":"reading-now"}`, "status"},
		{"non-string status", `{"title":"x","status":42}`, "status"},
		{"category null", `{"title":"x","category":null}`, "category"},
		{"invalid category", `{"title":"x","category":"foo"}`, "category"},
		{"currentVolume float", `{"title":"x","currentVolume":1.5}`, "currentVolume"},
		{"currentVolume negative", `{"title":"x","currentVolume":-1}`, "currentVolume"},
		{"currentVolume > 9999", `{"title":"x","currentVolume":10000}`, "currentVolume"},
		{"currentChapter string", `{"title":"x","currentChapter":"5"}`, "currentChapter"},
		{"rating 0", `{"title":"x","rating":0,"status":"completed"}`, "rating"},
		{"rating 6", `{"title":"x","rating":6,"status":"completed"}`, "rating"},
		{"rating float", `{"title":"x","rating":3.5,"status":"completed"}`, "rating"},
		{"coverUrl ftp", `{"title":"x","coverUrl":"ftp://example.com/x"}`, "coverUrl"},
		{"coverUrl garbage", `{"title":"x","coverUrl":"not-a-url"}`, "coverUrl"},
		{"coverUrl no host", `{"title":"x","coverUrl":"http://"}`, "coverUrl"},
		{"notes too long", `{"title":"x","notes":"` + strings.Repeat("a", 2001) + `"}`, "notes"},
		{"non-object body", `[]`, ""},
		{"malformed", `{`, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ValidateCreate([]byte(tc.body))
			if err == nil {
				t.Fatalf("expected error, got nil")
			}
			var verr *ValidationError
			if !errors.As(err, &verr) {
				t.Fatalf("expected *ValidationError, got %T", err)
			}
			if tc.errField != "" {
				if got, _ := verr.Details["field"].(string); got != tc.errField {
					t.Errorf("error field = %q, want %q (msg: %s)", got, tc.errField, verr.Message)
				}
			}
		})
	}
}

func TestValidateCreate_CrossField_RatingRequiresCompleted(t *testing.T) {
	// rating 給了但 status 不是 completed → 失敗
	_, err := ValidateCreate([]byte(`{"title":"x","rating":4,"status":"reading"}`))
	if err == nil {
		t.Fatal("expected cross-field error")
	}
	if !strings.Contains(err.Error(), "completed") {
		t.Errorf("error message: %s", err.Error())
	}

	// rating 沒給,status reading → ok
	_, err = ValidateCreate([]byte(`{"title":"x","status":"reading"}`))
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// rating null + status reading → ok
	_, err = ValidateCreate([]byte(`{"title":"x","rating":null,"status":"reading"}`))
	if err != nil {
		t.Errorf("unexpected error with null rating: %v", err)
	}
}

func TestValidateCreate_NullableFieldsAcceptNull(t *testing.T) {
	body := `{"title":"x","currentVolume":null,"currentChapter":null,"rating":null,"coverUrl":null,"notes":null}`
	in, err := ValidateCreate([]byte(body))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if in.CurrentVolume != nil || in.CurrentChapter != nil ||
		in.Rating != nil || in.CoverURL != nil || in.Notes != nil {
		t.Errorf("expected all nullable fields to remain nil")
	}
}

// ─── Patch ──────────────────────────────────────────────────────────

func makeExisting() *Manga {
	v := 5
	r := 4
	return &Manga{
		ID:            "abc",
		Title:         "原本書名",
		CurrentVolume: &v,
		Status:        StatusCompleted,
		Category:      CategoryHotBlooded,
		Rating:        &r,
	}
}

func TestValidatePatch_EmptyBody(t *testing.T) {
	patch, err := ValidatePatch([]byte(`{}`), makeExisting())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if patch.Title != nil || patch.Status != nil || patch.SetRating {
		t.Error("empty patch should leave all flags off")
	}
}

func TestValidatePatch_PartialFields(t *testing.T) {
	patch, err := ValidatePatch([]byte(`{"title":"新書名","currentChapter":120}`), makeExisting())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if patch.Title == nil || *patch.Title != "新書名" {
		t.Errorf("title = %v", patch.Title)
	}
	if !patch.SetCurrentChapter || patch.CurrentChapter == nil || *patch.CurrentChapter != 120 {
		t.Errorf("currentChapter not set correctly")
	}
	if patch.SetCurrentVolume {
		t.Error("currentVolume should not be flagged set")
	}
}

func TestValidatePatch_ExplicitNull(t *testing.T) {
	// PATCH {"rating": null} 應該被識別為「設成 null」,不是「沒帶」
	// existing.Status 是 completed,新 rating=null,跨欄位通過
	patch, err := ValidatePatch([]byte(`{"rating":null}`), makeExisting())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !patch.SetRating {
		t.Error("SetRating should be true even when value is null")
	}
	if patch.Rating != nil {
		t.Errorf("Rating should be nil, got %v", patch.Rating)
	}
}

func TestValidatePatch_IgnoredFields(t *testing.T) {
	body := `{"id":"new-id","createdAt":"2026-01-01","updatedAt":"x","lastReadAt":"y","title":"新名"}`
	patch, err := ValidatePatch([]byte(body), makeExisting())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if patch.Title == nil || *patch.Title != "新名" {
		t.Errorf("title not applied")
	}
}

func TestValidatePatch_UnknownFieldsIgnored(t *testing.T) {
	_, err := ValidatePatch([]byte(`{"foo":"bar","random":42}`), makeExisting())
	if err != nil {
		t.Errorf("unknown fields should be silently ignored, got: %v", err)
	}
}

func TestValidatePatch_CrossField_RatingPresentStatusChanged(t *testing.T) {
	// existing 有 rating=4 + status=completed
	// patch 把 status 改成 reading,但沒清掉 rating → 失敗
	_, err := ValidatePatch([]byte(`{"status":"reading"}`), makeExisting())
	if err == nil {
		t.Fatal("expected cross-field error: rating still set with non-completed status")
	}
}

func TestValidatePatch_CrossField_ClearRatingWhenStatusChanges(t *testing.T) {
	// 同上情境,但同時把 rating 清成 null → ok
	_, err := ValidatePatch([]byte(`{"status":"reading","rating":null}`), makeExisting())
	if err != nil {
		t.Errorf("clearing rating when changing status should be ok: %v", err)
	}
}

func TestValidatePatch_TouchesProgress(t *testing.T) {
	cases := []struct {
		body  string
		want  bool
	}{
		{`{"title":"x"}`, false},
		{`{"currentVolume":10}`, true},
		{`{"currentChapter":50}`, true},
		{`{"currentVolume":null}`, true},
	}
	for _, tc := range cases {
		patch, err := ValidatePatch([]byte(tc.body), makeExisting())
		if err != nil {
			t.Errorf("body %s: unexpected error %v", tc.body, err)
			continue
		}
		if patch.TouchesProgress() != tc.want {
			t.Errorf("body %s: TouchesProgress = %v, want %v", tc.body, patch.TouchesProgress(), tc.want)
		}
	}
}

// ─── Enum helpers ───────────────────────────────────────────────────

func TestEnumHelpers(t *testing.T) {
	if !IsValidStatus(StatusReading) {
		t.Error("StatusReading should be valid")
	}
	if IsValidStatus(Status("nope")) {
		t.Error("nope should be invalid")
	}
	if !IsValidCategory(CategoryCompetition) {
		t.Error("CategoryCompetition should be valid")
	}
	if IsValidCategory(Category("")) {
		t.Error("empty should be invalid")
	}
	if len(AllStatuses()) != 4 {
		t.Errorf("expected 4 statuses, got %d", len(AllStatuses()))
	}
	if len(AllCategories()) != 7 {
		t.Errorf("expected 7 categories, got %d", len(AllCategories()))
	}
}
