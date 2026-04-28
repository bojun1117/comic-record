import { apiRequest } from './client'

// 與後端 infra/lambda/shared/presets.ts 對齊
export type PresetId = 'recently-completed' | 'hot-blooded'

export interface RecommendResponse {
  recommendations: string[]
}

export async function getRecommendationsApi(
  presetId: PresetId,
  exclude: string[],
  token: string,
): Promise<string[]> {
  const data = await apiRequest<RecommendResponse>('/recommendations', {
    method: 'POST',
    body: { presetId, exclude },
    token,
  })
  return data.recommendations
}
