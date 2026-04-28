import { deleteManga, getManga } from './shared/db'
import { internalError, noContent, notFound, validationError } from './shared/http'
import { requireAuth } from './shared/require-auth'

export const handler = requireAuth(async (event, auth) => {
  try {
    const id = event.pathParameters?.id
    if (!id) {
      return validationError('id path parameter is required', undefined, event)
    }

    const existing = await getManga(id, auth.sub)
    if (!existing) return notFound(id, event)

    await deleteManga(id, auth.sub)
    return noContent(event)
  } catch (err) {
    return internalError(err, event)
  }
})
