// Package store 定義 Manga 持久層 interface 與各個實作。
// 對齊舊 Lambda shared/db.ts 的 5 個操作。
package store

import (
	"context"
	"errors"

	"comic-record/server/internal/manga"
)

// ErrNotFound:Get / FindByTitle 找不到時回傳。
// 對齊 db.ts 回 null 的語意。
var ErrNotFound = errors.New("manga not found")

// MangaStore 是 stage 4 handler 依賴的介面。
// 之後想換 PostgreSQL / SQLite / 記憶體 fake,只要實作這個介面即可。
type MangaStore interface {
	// List 撈該使用者的所有漫畫。沒有資料回空 slice,不是 nil。
	List(ctx context.Context, userID string) ([]manga.Manga, error)

	// FindByTitle:在 userID 下找 title 完全相同(trim 後 case-sensitive)的漫畫。
	// excludeID 不為空時,排除該 id(更新時擋名稱重複用)。
	// 找不到回 (nil, ErrNotFound)。
	FindByTitle(ctx context.Context, userID, title, excludeID string) (*manga.Manga, error)

	// Get 用 (userID, id) 取單筆。找不到回 (nil, ErrNotFound)。
	Get(ctx context.Context, userID, id string) (*manga.Manga, error)

	// Put 寫入或覆寫一筆。userID 會被當成 partition key,不會 leak 到 m。
	Put(ctx context.Context, userID string, m *manga.Manga) error

	// Delete 刪除一筆。對「本來就不存在」的 id 不報錯(對齊 DynamoDB DeleteItem 行為)。
	Delete(ctx context.Context, userID, id string) error

	// Ready 是 readiness probe 用的。連得到 DB + 有權限 + 表存在 → nil,否則 error。
	// 失敗時 K8s 會把 pod 從 service endpoint 拿掉,流量不會打進來。
	Ready(ctx context.Context) error
}
