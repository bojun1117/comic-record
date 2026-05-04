// Package manga 定義漫畫資料的 type 與驗證。
// 對齊舊 Lambda shared/types.ts 與 shared/validation.ts;前端 src/types/manga.ts 完全一致。
package manga

import "slices"

// FixedUserID:階段 4 接 JWT 後就是 token.sub,目前固定 "me"。
const FixedUserID = "me"

type Status string

const (
	StatusPlanToRead Status = "plan-to-read"
	StatusReading    Status = "reading"
	StatusDropped    Status = "dropped"
	StatusCompleted  Status = "completed"
)

func AllStatuses() []Status {
	return []Status{StatusPlanToRead, StatusReading, StatusDropped, StatusCompleted}
}

func IsValidStatus(s Status) bool {
	return slices.Contains(AllStatuses(), s)
}

type Category string

const (
	CategoryHotBlooded  Category = "hot-blooded"
	CategoryMystery     Category = "mystery"
	CategoryAdventure   Category = "adventure"
	CategoryRomance     Category = "romance"
	CategoryCasual      Category = "casual"
	CategoryCompetition Category = "competition"
	CategoryOther       Category = "other"
)

func AllCategories() []Category {
	return []Category{
		CategoryHotBlooded,
		CategoryMystery,
		CategoryAdventure,
		CategoryRomance,
		CategoryCasual,
		CategoryCompetition,
		CategoryOther,
	}
}

func IsValidCategory(c Category) bool {
	return slices.Contains(AllCategories(), c)
}

// Manga API response 欄位。指標表示「可為 null」。
// JSON encoding 不要 omitempty,因為 null 跟 missing 在 API 上意義不同
// (前端期望永遠拿到全部欄位,值可能為 null)。
//
// dynamodbav 標籤對齊舊 Lambda 寫進去的屬性名稱(camelCase),
// 確保 Go 版讀寫的 attribute 跟 TS 版完全一致。
type Manga struct {
	ID             string   `json:"id" dynamodbav:"id"`
	Title          string   `json:"title" dynamodbav:"title"`
	CurrentVolume  *int     `json:"currentVolume" dynamodbav:"currentVolume"`
	CurrentChapter *int     `json:"currentChapter" dynamodbav:"currentChapter"`
	Status         Status   `json:"status" dynamodbav:"status"`
	Category       Category `json:"category" dynamodbav:"category"`
	Rating         *int     `json:"rating" dynamodbav:"rating"`
	CoverURL       *string  `json:"coverUrl" dynamodbav:"coverUrl"`
	Notes          *string  `json:"notes" dynamodbav:"notes"`
	LastReadAt     string   `json:"lastReadAt" dynamodbav:"lastReadAt"`
	CreatedAt      string   `json:"createdAt" dynamodbav:"createdAt"`
	UpdatedAt      string   `json:"updatedAt" dynamodbav:"updatedAt"`
}
