import { apiRequest } from './client'

interface LoginResponse {
  token: string
}

export function loginApi(password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { password },
  })
}
