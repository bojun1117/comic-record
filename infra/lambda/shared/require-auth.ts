// 共用 auth middleware:把 mangas handler 包成需要 JWT
// 用法:export const handler = requireAuth(myHandler)

import type { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'
import { extractBearerToken, verifyToken, type AuthPayload } from './auth'
import { unauthorized } from './http'

// 讓 handler 拿到驗證過的 user 資訊
export type AuthedHandler = (
  event: APIGatewayProxyEvent,
  auth: AuthPayload,
) => Promise<APIGatewayProxyResult>

export function requireAuth(inner: AuthedHandler): APIGatewayProxyHandler {
  return async (event) => {
    const token = extractBearerToken(event.headers as Record<string, string | undefined>)
    if (!token) {
      return unauthorized('missing token')
    }

    let auth: AuthPayload
    try {
      auth = await verifyToken(token)
    } catch {
      return unauthorized('invalid or expired token')
    }

    return await inner(event, auth)
  }
}
