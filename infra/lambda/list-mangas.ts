import { listMangas } from './shared/db'
import { internalError, ok } from './shared/http'
import { requireAuth } from './shared/require-auth'

export const handler = requireAuth(async (_event, auth) => {
  try {
    const mangas = await listMangas(auth.sub)
    return ok(mangas)
  } catch (err) {
    return internalError(err)
  }
})
