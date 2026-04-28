import { timingSafeEqual } from 'node:crypto'
import type { APIGatewayProxyHandler } from 'aws-lambda'
import { signToken } from './shared/auth'
import {
  internalError,
  malformedJson,
  ok,
  parseJsonBody,
  unauthorized,
  validationError,
} from './shared/http'
import { getSecret } from './shared/ssm'
import { FIXED_USER_ID } from './shared/types'

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8')
  const bBuf = Buffer.from(b, 'utf8')
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, Buffer.alloc(aBuf.length))
    return false
  }
  return timingSafeEqual(aBuf, bBuf)
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const passwordParam = process.env.APP_PASSWORD_PARAM
    if (!passwordParam) {
      console.error('APP_PASSWORD_PARAM env var not set')
      return internalError(new Error('server misconfigured'))
    }

    let body: unknown
    try {
      body = parseJsonBody(event.body)
    } catch {
      return malformedJson()
    }

    if (typeof body !== 'object' || body === null) {
      return validationError('request body must be a JSON object')
    }
    const { password } = body as Record<string, unknown>

    if (typeof password !== 'string') {
      return validationError('password is required and must be a string', { field: 'password' })
    }

    const expectedPassword = await getSecret(passwordParam)

    if (!safeEqual(password, expectedPassword)) {
      return unauthorized('invalid password')
    }

    const token = await signToken(FIXED_USER_ID)
    return ok({ token })
  } catch (err) {
    return internalError(err)
  }
}
