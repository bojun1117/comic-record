package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbtypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"comic-record/server/internal/manga"
)

// DynamoDBStore 是 MangaStore 的 DynamoDB 實作。
// 對齊舊 db.ts 的所有操作,attribute 名稱完全相同。
type DynamoDBStore struct {
	client    *dynamodb.Client
	tableName string
}

// NewDynamoDBStore 建構 store。client 由呼叫端注入,方便測試替換。
func NewDynamoDBStore(client *dynamodb.Client, tableName string) *DynamoDBStore {
	return &DynamoDBStore{client: client, tableName: tableName}
}

// 確保編譯期就能驗證有實作 interface
var _ MangaStore = (*DynamoDBStore)(nil)

func (s *DynamoDBStore) List(ctx context.Context, userID string) ([]manga.Manga, error) {
	out, err := s.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(s.tableName),
		KeyConditionExpression: aws.String("userId = :uid"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":uid": &ddbtypes.AttributeValueMemberS{Value: userID},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("list mangas: %w", err)
	}

	mangas := make([]manga.Manga, 0, len(out.Items))
	for _, item := range out.Items {
		var m manga.Manga
		if err := attributevalue.UnmarshalMap(item, &m); err != nil {
			return nil, fmt.Errorf("unmarshal manga: %w", err)
		}
		mangas = append(mangas, m)
	}
	return mangas, nil
}

func (s *DynamoDBStore) FindByTitle(
	ctx context.Context,
	userID, title, excludeID string,
) (*manga.Manga, error) {
	target := strings.TrimSpace(title)

	out, err := s.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(s.tableName),
		KeyConditionExpression: aws.String("userId = :uid"),
		FilterExpression:       aws.String("title = :title"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":uid":   &ddbtypes.AttributeValueMemberS{Value: userID},
			":title": &ddbtypes.AttributeValueMemberS{Value: target},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("find manga by title: %w", err)
	}

	for _, item := range out.Items {
		var m manga.Manga
		if err := attributevalue.UnmarshalMap(item, &m); err != nil {
			return nil, fmt.Errorf("unmarshal manga: %w", err)
		}
		if m.ID == excludeID {
			continue
		}
		return &m, nil
	}
	return nil, ErrNotFound
}

func (s *DynamoDBStore) Get(ctx context.Context, userID, id string) (*manga.Manga, error) {
	out, err := s.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.tableName),
		Key: map[string]ddbtypes.AttributeValue{
			"userId": &ddbtypes.AttributeValueMemberS{Value: userID},
			"id":     &ddbtypes.AttributeValueMemberS{Value: id},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("get manga: %w", err)
	}
	if out.Item == nil || len(out.Item) == 0 {
		return nil, ErrNotFound
	}

	var m manga.Manga
	if err := attributevalue.UnmarshalMap(out.Item, &m); err != nil {
		return nil, fmt.Errorf("unmarshal manga: %w", err)
	}
	return &m, nil
}

func (s *DynamoDBStore) Put(ctx context.Context, userID string, m *manga.Manga) error {
	item, err := attributevalue.MarshalMap(m)
	if err != nil {
		return fmt.Errorf("marshal manga: %w", err)
	}
	// userId 不在 Manga struct 上(API response 不暴露),手動補上當 partition key。
	item["userId"] = &ddbtypes.AttributeValueMemberS{Value: userID}

	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.tableName),
		Item:      item,
	})
	if err != nil {
		return fmt.Errorf("put manga: %w", err)
	}
	return nil
}

// Ready:DescribeTable 是廉價且能驗證「連線 + 認證 + 表存在 + 有權限」的呼叫。
// rate limit 10/sec,我們最多 2 個 pod * 6/min = 12/min,沒風險。
func (s *DynamoDBStore) Ready(ctx context.Context) error {
	_, err := s.client.DescribeTable(ctx, &dynamodb.DescribeTableInput{
		TableName: aws.String(s.tableName),
	})
	return err
}

func (s *DynamoDBStore) Delete(ctx context.Context, userID, id string) error {
	_, err := s.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(s.tableName),
		Key: map[string]ddbtypes.AttributeValue{
			"userId": &ddbtypes.AttributeValueMemberS{Value: userID},
			"id":     &ddbtypes.AttributeValueMemberS{Value: id},
		},
	})
	if err != nil {
		return fmt.Errorf("delete manga: %w", err)
	}
	return nil
}
