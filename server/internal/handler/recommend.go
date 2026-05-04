package handler

import (
	"context"
	"encoding/json"
	"io"
	"regexp"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/gin-gonic/gin"

	"comic-record/server/internal/httpx"
)

const (
	promptMaxLen   = 200
	excludeMaxItems = 50
	bedrockMaxTokens = 500
)

// 對齊 recommend.ts 的 system prompt(逐字搬,規則寫死)
const recommendSystemPrompt = `你是漫畫推薦助手。

規則:
- 只回應與漫畫推薦有關的請求。如果使用者問非漫畫相關內容(食譜、新聞、程式...),回 {"recommendations": []}
- 必須以有效 JSON 格式回應:{"recommendations": ["書名1", "書名2", "書名3", "書名4", "書名5"]}
- 不加任何解釋、前言、結尾文字、markdown code fence
- 書名優先用中文官方譯名,若無則用日文原文
- 不重複作品
- 若使用者列出「不要推薦」清單,絕對避開那些作品`

// BedrockInvoker 抽象出 Bedrock client 介面,測試時可以替換。
type BedrockInvoker interface {
	InvokeModel(ctx context.Context, in *bedrockruntime.InvokeModelInput, optFns ...func(*bedrockruntime.Options)) (*bedrockruntime.InvokeModelOutput, error)
}

// PostRecommend:對齊 recommend.ts。
func PostRecommend(client BedrockInvoker, modelID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			httpx.InternalError(c, err)
			return
		}
		if len(body) > 0 && !json.Valid(body) {
			httpx.Validation(c, "malformed JSON", nil)
			return
		}

		var req struct {
			Prompt  string   `json:"prompt"`
			Exclude []string `json:"exclude"`
		}
		if len(body) > 0 {
			if err := json.Unmarshal(body, &req); err != nil {
				httpx.Validation(c, "malformed JSON", nil)
				return
			}
		}

		prompt := strings.TrimSpace(req.Prompt)
		if prompt == "" {
			httpx.Validation(c, "prompt is required", map[string]any{"field": "prompt"})
			return
		}
		if len([]rune(prompt)) > promptMaxLen {
			httpx.Validation(c,
				"prompt must be at most 200 characters",
				map[string]any{"field": "prompt"})
			return
		}

		exclude := req.Exclude
		if len(exclude) > excludeMaxItems {
			exclude = exclude[:excludeMaxItems]
		}

		userPrompt := prompt
		if len(exclude) > 0 {
			var b strings.Builder
			b.WriteString(prompt)
			b.WriteString("\n\n請避開以下已經推薦過的作品:\n")
			for _, t := range exclude {
				b.WriteString("- ")
				b.WriteString(t)
				b.WriteString("\n")
			}
			userPrompt = strings.TrimRight(b.String(), "\n")
		}

		bedrockBody, err := json.Marshal(map[string]any{
			"anthropic_version": "bedrock-2023-05-31",
			"max_tokens":        bedrockMaxTokens,
			"system":            recommendSystemPrompt,
			"messages": []map[string]any{
				{"role": "user", "content": userPrompt},
			},
		})
		if err != nil {
			httpx.InternalError(c, err)
			return
		}

		resp, err := client.InvokeModel(c.Request.Context(), &bedrockruntime.InvokeModelInput{
			ModelId:     aws.String(modelID),
			ContentType: aws.String("application/json"),
			Accept:      aws.String("application/json"),
			Body:        bedrockBody,
		})
		if err != nil {
			httpx.InternalError(c, err)
			return
		}

		var parsed struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		}
		if err := json.Unmarshal(resp.Body, &parsed); err != nil {
			httpx.InternalError(c, err)
			return
		}

		text := ""
		if len(parsed.Content) > 0 {
			text = parsed.Content[0].Text
		}

		httpx.OK(c, gin.H{"recommendations": parseTitles(text)})
	}
}

// LLM 應該回 JSON,但偶爾會帶前綴 / code fence。容錯邏輯與 TS 版完全一致。
var jsonObjectRe = regexp.MustCompile(`\{[\s\S]*\}`)
var leadingBulletRe = regexp.MustCompile(`^[\s\-*\d.、]+`)

func parseTitles(text string) []string {
	if m := jsonObjectRe.FindString(text); m != "" {
		var obj struct {
			Recommendations []string `json:"recommendations"`
		}
		if err := json.Unmarshal([]byte(m), &obj); err == nil {
			out := make([]string, 0, len(obj.Recommendations))
			for _, s := range obj.Recommendations {
				t := strings.TrimSpace(s)
				if t != "" && len([]rune(t)) < 100 {
					out = append(out, t)
				}
				if len(out) >= 5 {
					break
				}
			}
			if len(out) > 0 {
				return out
			}
		}
	}
	// fallback:逐行清理
	lines := strings.Split(text, "\n")
	out := make([]string, 0, 5)
	for _, line := range lines {
		t := strings.TrimSpace(leadingBulletRe.ReplaceAllString(line, ""))
		if t != "" && len([]rune(t)) < 100 {
			out = append(out, t)
		}
		if len(out) >= 5 {
			break
		}
	}
	return out
}
