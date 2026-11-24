import { beforeEach, describe, expect, it } from 'vitest'
import { cacheItems, clearQueuedOperation, queueOperation, queuedOperations, readCachedItems } from './offline'
import type { ShoppingItem } from '../types'

const storage = new Map<string, string>()

function item(id: string): ShoppingItem {
  return {
    id,
    family_id: 'family-a',
    name: 'Melk',
    quantity: 1,
    unit: null,
    note: null,
    category_id: 'category-a',
    is_urgent: false,
    is_favorite: false,
    created_by: 'user-a',
    created_at: '2026-01-01T10:00:00.000Z',
    purchased_at: null,
    purchased_by: null,
  }
}

beforeEach(() => {
  storage.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
})

describe('offline family queue', () => {
  it('persists queued operations only for their family and removes completed entries', () => {
    queueOperation('family-a', { id: 'op-a', type: 'add', item: item('item-a') })
    queueOperation('family-a', { id: 'op-a', type: 'add', item: item('item-a') })

    expect(queuedOperations('family-a')).toHaveLength(1)
    expect(queuedOperations('family-b')).toHaveLength(0)

    clearQueuedOperation('family-a', 'op-a')
    expect(queuedOperations('family-a')).toHaveLength(0)
  })

  it('stores the last visible family list for offline reopening', () => {
    cacheItems('family-a', [item('item-a')])
    cacheItems('family-b', [item('item-b')])

    expect(readCachedItems('family-a').map((entry) => entry.id)).toEqual(['item-a'])
    expect(readCachedItems('family-b').map((entry) => entry.id)).toEqual(['item-b'])
  })
})
