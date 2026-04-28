import { describe, expect, it } from 'vitest'
import type { Manga } from '../lambda/shared/types'
import {
  ValidationError,
  patchTouchesProgress,
  validateCreateInput,
  validatePatchInput,
} from '../lambda/shared/validation'

const baseManga: Manga = {
  id: 'abc',
  title: '進擊的巨人',
  currentVolume: 12,
  currentChapter: 98,
  status: 'reading',
  category: 'adventure',
  rating: null,
  coverUrl: null,
  notes: null,
  lastReadAt: '2026-04-24T14:30:00.000Z',
  createdAt: '2025-09-10T08:00:00.000Z',
  updatedAt: '2026-04-24T14:30:00.000Z',
}

describe('validateCreateInput', () => {
  it('accepts minimal valid input (only title)', () => {
    const out = validateCreateInput({ title: '咒術迴戰' })
    expect(out.title).toBe('咒術迴戰')
    expect(out.status).toBe('plan-to-read') // 預設
    expect(out.category).toBe('other') // 預設
    expect(out.rating).toBe(null)
  })

  it('trims title', () => {
    const out = validateCreateInput({ title: '  進擊的巨人  ' })
    expect(out.title).toBe('進擊的巨人')
  })

  it('rejects missing title', () => {
    expect(() => validateCreateInput({})).toThrow(ValidationError)
  })

  it('rejects empty title', () => {
    expect(() => validateCreateInput({ title: '   ' })).toThrow(ValidationError)
  })

  it('rejects invalid status', () => {
    expect(() => validateCreateInput({ title: 'x', status: 'bogus' })).toThrow(ValidationError)
  })

  it('rejects invalid category', () => {
    expect(() => validateCreateInput({ title: 'x', category: 'horror' })).toThrow(ValidationError)
  })

  it('rejects null category', () => {
    expect(() => validateCreateInput({ title: 'x', category: null })).toThrow(ValidationError)
  })

  it('rejects rating without completed status', () => {
    expect(() =>
      validateCreateInput({ title: 'x', status: 'reading', rating: 5 }),
    ).toThrow(ValidationError)
  })

  it('accepts rating with completed status', () => {
    const out = validateCreateInput({ title: 'x', status: 'completed', rating: 5 })
    expect(out.rating).toBe(5)
  })

  it('rejects negative volume', () => {
    expect(() => validateCreateInput({ title: 'x', currentVolume: -1 })).toThrow(ValidationError)
  })

  it('rejects string number', () => {
    expect(() => validateCreateInput({ title: 'x', currentVolume: '12' })).toThrow(
      ValidationError,
    )
  })

  it('rejects rating out of range', () => {
    expect(() =>
      validateCreateInput({ title: 'x', status: 'completed', rating: 6 }),
    ).toThrow(ValidationError)
  })

  it('rejects bad coverUrl protocol', () => {
    expect(() =>
      validateCreateInput({ title: 'x', coverUrl: 'ftp://example.com/a.png' }),
    ).toThrow(ValidationError)
  })
})

describe('validatePatchInput', () => {
  it('returns empty patch for empty body', () => {
    const out = validatePatchInput({}, baseManga)
    expect(out).toEqual({})
  })

  it('only updates provided keys', () => {
    const out = validatePatchInput({ currentChapter: 99 }, baseManga)
    expect(out.currentChapter).toBe(99)
    expect(out.title).toBeUndefined()
  })

  it('allows null to clear nullable field', () => {
    const out = validatePatchInput({ currentChapter: null }, baseManga)
    expect(out.currentChapter).toBe(null)
  })

  it('rejects null on category', () => {
    expect(() => validatePatchInput({ category: null }, baseManga)).toThrow(ValidationError)
  })

  it('silently ignores server-managed fields', () => {
    const out = validatePatchInput(
      {
        id: 'malicious-id',
        createdAt: '1999-01-01T00:00:00.000Z',
        updatedAt: 'x',
        lastReadAt: 'y',
        title: 'new title',
      },
      baseManga,
    )
    expect(out.title).toBe('new title')
    expect((out as Record<string, unknown>).id).toBeUndefined()
    expect((out as Record<string, unknown>).createdAt).toBeUndefined()
  })

  it('silently ignores unknown fields', () => {
    const out = validatePatchInput({ foo: 'bar', title: 'ok' }, baseManga)
    expect(out.title).toBe('ok')
    expect((out as Record<string, unknown>).foo).toBeUndefined()
  })

  it('cross-field: rating with reading status fails', () => {
    expect(() => validatePatchInput({ rating: 5 }, baseManga)).toThrow(ValidationError)
  })

  it('cross-field: status -> completed then rating allowed', () => {
    const out = validatePatchInput({ status: 'completed', rating: 5 }, baseManga)
    expect(out.rating).toBe(5)
  })

  it('cross-field: completed -> reading clears rating must include rating: null', () => {
    const completed: Manga = { ...baseManga, status: 'completed', rating: 5 }
    // 只改 status,rating 還是 5 → 違反
    expect(() => validatePatchInput({ status: 'reading' }, completed)).toThrow(ValidationError)
    // 同時清掉 rating → OK
    const out = validatePatchInput({ status: 'reading', rating: null }, completed)
    expect(out.status).toBe('reading')
    expect(out.rating).toBe(null)
  })
})

describe('patchTouchesProgress', () => {
  it('true when currentVolume in patch', () => {
    expect(patchTouchesProgress({ currentVolume: 5 })).toBe(true)
  })
  it('true when currentChapter in patch', () => {
    expect(patchTouchesProgress({ currentChapter: 10 })).toBe(true)
  })
  it('true even when value is null (key existed)', () => {
    expect(patchTouchesProgress({ currentVolume: null })).toBe(true)
  })
  it('false when only other fields', () => {
    expect(patchTouchesProgress({ title: 'x', status: 'completed' })).toBe(false)
  })
})
