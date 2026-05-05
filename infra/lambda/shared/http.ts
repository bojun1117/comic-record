import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

// CORS allowlist 由 CDK 透過 env 注入(逗號分隔字串)
// 階段 5:localhost + GitHub Pages
function allowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// 從 event.headers 抽 Origin(API Gateway 大小寫不一致,兩邊都看)
function getOrigin(event?: APIGatewayProxyEvent): string | null {
  if (!event) return null
  const h = event.headers as Record<string, string | undefined>
  return h.Origin ?? h.origin ?? null
}

// 計算這個 request 應該回什麼 CORS headers。
// 如果 origin 在 allowlist 裡,echo 那個 origin;
// 不在的話,回第一個允許的 origin(瀏覽器會擋掉,但至少 response 結構正確)
function buildCorsHeaders(event?: APIGatewayProxyEvent): Record<string, string> {
  const allowed = allowedOrigins()
  const origin = getOrigin(event)
  const echoOrigin = origin && allowed.includes(origin) ? origin : (allowed[0] ?? '*')
  return {
    'Access-Control-Allow-Origin': echoOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin', // CDN / browser cache 要看 Origin 區分回應
  }
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
}

export function ok<T>(body: T, event?: APIGatewayProxyEvent): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { ...buildCorsHeaders(event), ...JSON_HEADERS },
    body: JSON.stringify(body),
  }
}

export function created<T>(body: T, event?: APIGatewayProxyEvent): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: { ...buildCorsHeaders(event), ...JSON_HEADERS },
    body: JSON.stringify(body),
  }
}

export function noContent(event?: APIGatewayProxyEvent): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: { ...buildCorsHeaders(event) },
    body: '',
  }
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'MALFORMED_JSON'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'

export function errorResponse(
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  event?: APIGatewayProxyEvent,
): APIGatewayProxyResult {
  const error: Record<string, unknown> = { code, message }
  if (details) error.details = details
  return {
    statusCode,
    headers: { ...buildCorsHeaders(event), ...JSON_HEADERS },
    body: JSON.stringify({ error }),
  }
}

export const validationError = (
  message: string,
  details?: Record<string, unknown>,
  event?: APIGatewayProxyEvent,
) => errorResponse(400, 'VALIDATION_ERROR', message, details, event)

export const notFound = (id: string, event?: APIGatewayProxyEvent) =>
  errorResponse(404, 'NOT_FOUND', `manga not found: ${id}`, { id }, event)

export const malformedJson = (event?: APIGatewayProxyEvent) =>
  errorResponse(400, 'MALFORMED_JSON', 'request body is not valid JSON', undefined, event)

export const unauthorized = (message = 'missing or invalid token', event?: APIGatewayProxyEvent) =>
  errorResponse(401, 'UNAUTHORIZED', message, undefined, event)

export const internalError = (err: unknown, event?: APIGatewayProxyEvent) => {
  console.error('Internal error:', err)
  return errorResponse(500, 'INTERNAL_ERROR', 'internal server error', undefined, event)
}

export function parseJsonBody(body: string | null | undefined): unknown {
  if (body === null || body === undefined || body === '') return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new SyntaxError('Invalid JSON')
  }
}
