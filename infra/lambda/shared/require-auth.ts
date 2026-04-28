import type { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'
import { extractBearerToken, verifyToken, type AuthPayload } from './auth'
import { unauthorized } from './http'

export type AuthedHandler = (
  event: APIGatewayProxyEvent,
  auth: AuthPayload,
) => Promise<APIGatewayProxyResult>

export function requireAuth(inner: AuthedHandler): APIGatewayProxyHandler {
  return async (event) => {
    const token = extractBearerToken(event.headers as Record<string, string | undefined>)
    if (!token) {
      return unauthorized('missing token', event)
    }

    let auth: AuthPayload
    try {
      auth = await verifyToken(token)
    } catch {
      return unauthorized('invalid or expired token', event)
    }

    return await inner(event, auth)
  }
}
