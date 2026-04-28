import { apiRequest } from './client'

export interface RecommendResponse {
  recommendations: string[]
}

export async function getRecommendationsApi(
  prompt: string,
  exclude: string[],
  token: string,
): Promise<string[]> {
  const data = await apiRequest<RecommendResponse>('/recommendations', {
    method: 'POST',
    body: { prompt, exclude },
    token,
  })
  return data.recommendations
}
