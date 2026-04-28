import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { internalError, ok, validationError } from './shared/http'
import { PRESETS, isPresetId } from './shared/presets'
import { requireAuth } from './shared/require-auth'

// Bedrock 上的 Claude Haiku 4.5。
// Anthropic 模型不支援 on-demand 直接叫,必須透過 cross-region inference profile,
// 所以這裡用 us. 前綴的 profile id(在 us-* 區域之間 routing)。
const MODEL_ID = process.env.MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
const REGION = process.env.AWS_REGION ?? 'us-east-1'

const client = new BedrockRuntimeClient({ region: REGION })

const SYSTEM_PROMPT = `你是漫畫推薦助手。

規則:
- 只回應與漫畫推薦有關的請求,其他話題回空陣列
- 必須以有效 JSON 格式回應:{"recommendations": ["書名1", "書名2", "書名3", "書名4", "書名5"]}
- 不加任何解釋、前言、結尾文字、markdown code fence
- 書名優先用中文官方譯名,若無則用日文原文
- 不重複作品
- 若使用者列出「不要推薦」清單,絕對避開那些作品`

interface RequestBody {
  presetId?: unknown
  exclude?: unknown
}

export const handler = requireAuth(async (event) => {
  // ── 解析 body ──
  let body: RequestBody
  try {
    body = JSON.parse(event.body ?? '{}') as RequestBody
  } catch {
    return validationError('malformed JSON', undefined, event)
  }

  if (!isPresetId(body.presetId)) {
    return validationError(
      `presetId must be one of: ${Object.keys(PRESETS).join(', ')}`,
      { field: 'presetId' },
      event,
    )
  }

  // exclude 限制長度,避免 prompt 變太大或被濫用
  const exclude = Array.isArray(body.exclude)
    ? (body.exclude.filter((x) => typeof x === 'string') as string[]).slice(0, 50)
    : []

  // ── 組 user prompt ──
  const basePrompt = PRESETS[body.presetId]
  const userPrompt =
    exclude.length > 0
      ? `${basePrompt}\n\n請避開以下已經推薦過的作品:\n${exclude.map((t) => `- ${t}`).join('\n')}`
      : basePrompt

  // ── 呼 Bedrock ──
  try {
    const response = await client.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 500,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      }),
    )

    const responseText = new TextDecoder().decode(response.body)
    const parsed = JSON.parse(responseText) as { content?: { text?: string }[] }
    const text = parsed.content?.[0]?.text ?? ''

    const recommendations = parseTitles(text)
    return ok({ recommendations }, event)
  } catch (err) {
    console.error('bedrock invoke failed', err)
    return internalError(err, event)
  }
})

// LLM 應該回 JSON,但偶爾會有前綴 / code fence,容錯處理
function parseTitles(text: string): string[] {
  // 先試:抓第一段 {...} 嘗試 JSON.parse
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]) as { recommendations?: unknown }
      if (Array.isArray(obj.recommendations)) {
        return obj.recommendations
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length < 100)
          .slice(0, 5)
      }
    } catch {
      // fallthrough
    }
  }
  // fallback:逐行清理
  return text
    .split('\n')
    .map((l) => l.replace(/^[\s\-*\d.、]+/, '').trim())
    .filter((l) => l.length > 0 && l.length < 100)
    .slice(0, 5)
}
