// JWT 簽發與驗證。secret 從 SSM 動態取得(不放 env var)
// jose 在 esbuild bundle 裡會被打包進去

import { SignJWT, jwtVerify } from 'jose'
import { getSecret } from './ssm'

export interface AuthPayload {
  sub: string
  iat?: number
  exp?: number
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 天

let cachedSecretKey: Uint8Array | null = null

async function getSecretKey(): Promise<Uint8Array> {
  if (cachedSecretKey) return cachedSecretKey
  const paramName = process.env.JWT_SECRET_PARAM
  if (!paramName) {
    throw new Error('JWT_SECRET_PARAM env var is required')
  }
  const secret = await getSecret(paramName)
  cachedSecretKey = new TextEncoder().encode(secret)
  return cachedSecretKey
}

export async function signToken(sub: string): Promise<string> {
  const key = await getSecretKey()
  return await new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(key)
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  const key = await getSecretKey()
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['HS256'],
  })
  if (typeof payload.sub !== 'string') {
    throw new Error('invalid token payload')
  }
  return { sub: payload.sub, iat: payload.iat, exp: payload.exp }
}

export function extractBearerToken(headers: Record<string, string | undefined>): string | null {
  const authHeader = headers.Authorization ?? headers.authorization
  if (!authHeader) return null
  const match = /^Bearer\s+(.+)$/i.exec(authHeader)
  if (!match) return null
  return match[1] ?? null
}
