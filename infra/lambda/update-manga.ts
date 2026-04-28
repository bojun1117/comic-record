import { getManga, putManga } from './shared/db'
import {
  internalError,
  malformedJson,
  notFound,
  ok,
  parseJsonBody,
  validationError,
} from './shared/http'
import { requireAuth } from './shared/require-auth'
import type { Manga } from './shared/types'
import { ValidationError, patchTouchesProgress, validatePatchInput } from './shared/validation'

export const handler = requireAuth(async (event, auth) => {
  try {
    const id = event.pathParameters?.id
    if (!id) {
      return validationError('id path parameter is required')
    }

    const existing = await getManga(id, auth.sub)
    if (!existing) return notFound(id)

    let body: unknown
    try {
      body = parseJsonBody(event.body)
    } catch {
      return malformedJson()
    }

    const patch = validatePatchInput(body, existing)

    const now = new Date().toISOString()
    const updated: Manga = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
      lastReadAt: patchTouchesProgress(patch) ? now : existing.lastReadAt,
    }

    await putManga(updated, auth.sub)
    return ok(updated)
  } catch (err) {
    if (err instanceof ValidationError) {
      return validationError(err.message, err.details)
    }
    return internalError(err)
  }
})
