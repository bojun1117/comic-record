import type { APIGatewayProxyResult } from 'aws-lambda'

// API.md §1.5 CORS
// 階段 3 先用 *(因為前端還沒部署、URL 不固定);階段 4 再收緊成具體 origin
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
}

export function ok<T>(body: T): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, ...JSON_HEADERS },
    body: JSON.stringify(body),
  }
}

export function created<T>(body: T): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: { ...CORS_HEADERS, ...JSON_HEADERS },
    body: JSON.stringify(body),
  }
}

export function noContent(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: { ...CORS_HEADERS },
    body: '',
  }
}

// API.md §1.4 錯誤格式
// API.md §10 錯誤碼總表
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
): APIGatewayProxyResult {
  const error: Record<string, unknown> = { code, message }
  if (details) error.details = details
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...JSON_HEADERS },
    body: JSON.stringify({ error }),
  }
}

export const validationError = (message: string, details?: Record<string, unknown>) =>
  errorResponse(400, 'VALIDATION_ERROR', message, details)

export const notFound = (id: string) =>
  errorResponse(404, 'NOT_FOUND', `manga not found: ${id}`, { id })

export const malformedJson = () =>
  errorResponse(400, 'MALFORMED_JSON', 'request body is not valid JSON')

export const unauthorized = (message = 'missing or invalid token') =>
  errorResponse(401, 'UNAUTHORIZED', message)

export const internalError = (err: unknown) => {
  console.error('Internal error:', err)
  return errorResponse(500, 'INTERNAL_ERROR', 'internal server error')
}

// 安全解析 JSON body(API Gateway 給的 body 是 string 或 null)
export function parseJsonBody(body: string | null | undefined): unknown {
  if (body === null || body === undefined || body === '') return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new SyntaxError('Invalid JSON')
  }
}
