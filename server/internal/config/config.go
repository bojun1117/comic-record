package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port           string
	AllowedOrigins []string

	// JWT 簽章用的 secret(直接從 env 注入,不再走 SSM)
	JWTSecret []byte

	// 登入比對用的密碼
	AppPassword string

	// DynamoDB table 名稱(例:comic-vibe-mangas-dev)
	TableName string

	// AWS 與 Bedrock
	AWSRegion      string
	BedrockModelID string
}

// Load 讀環境變數,缺少必填的話 return error 讓 main.go fail fast。
func Load() (*Config, error) {
	cfg := &Config{
		Port:           env("PORT", "8080"),
		AllowedOrigins: splitAndTrim(env("ALLOWED_ORIGINS", "http://localhost:5173")),
		AWSRegion:      env("AWS_REGION", "us-east-1"),
		BedrockModelID: env("BEDROCK_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0"),
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, errors.New("JWT_SECRET env var is required")
	}
	cfg.JWTSecret = []byte(jwtSecret)

	appPassword := os.Getenv("APP_PASSWORD")
	if appPassword == "" {
		return nil, errors.New("APP_PASSWORD env var is required")
	}
	cfg.AppPassword = appPassword

	tableName := os.Getenv("TABLE_NAME")
	if tableName == "" {
		return nil, errors.New("TABLE_NAME env var is required")
	}
	cfg.TableName = tableName

	if len(cfg.AllowedOrigins) == 0 {
		return nil, fmt.Errorf("ALLOWED_ORIGINS must contain at least one origin")
	}

	return cfg, nil
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func splitAndTrim(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
