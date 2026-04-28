import type { Manga } from '@/types/manga'
import { apiRequest } from './client'

export type AddMangaPayload = Omit<
  Manga,
  'id' | 'createdAt' | 'updatedAt' | 'lastReadAt' | 'category'
> & {
  category?: Manga['category']
}

export function listMangasApi(token: string): Promise<Manga[]> {
  return apiRequest<Manga[]>('/mangas', { token })
}

export function createMangaApi(payload: AddMangaPayload, token: string): Promise<Manga> {
  return apiRequest<Manga>('/mangas', { method: 'POST', body: payload, token })
}

export function updateMangaApi(
  id: string,
  patch: Partial<Manga>,
  token: string,
): Promise<Manga> {
  return apiRequest<Manga>(`/mangas/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    token,
  })
}

export function deleteMangaApi(id: string, token: string): Promise<void> {
  return apiRequest<void>(`/mangas/${encodeURIComponent(id)}`, { method: 'DELETE', token })
}
