import { randomUUID } from 'node:crypto'
import { putManga } from './shared/db'
import {
  created,
  internalError,
  malformedJson,
  parseJsonBody,
  validationError,
} from './shared/http'
import { requireAuth } from './shared/require-auth'
import type { Manga } from './shared/types'
import { ValidationError, validateCreateInput } from './shared/validation'

export const handler = requireAuth(async (event, auth) => {
  try {
    let body: unknown
    try {
      body = parseJsonBody(event.body)
    } catch {
      return malformedJson()
    }

    const input = validateCreateInput(body)

    const now = new Date().toISOString()
    const manga: Manga = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      lastReadAt: now,
    }

    await putManga(manga, auth.sub)
    return created(manga)
  } catch (err) {
    if (err instanceof ValidationError) {
      return validationError(err.message, err.details)
    }
    return internalError(err)
  }
})
