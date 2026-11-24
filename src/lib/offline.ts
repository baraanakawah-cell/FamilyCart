import type { ShoppingItem } from '../types'

type PendingOperation =
  | { id: string; type: 'add'; item: ShoppingItem }
  | { id: string; type: 'update'; itemId: string; changes: Partial<ShoppingItem> }
  | { id: string; type: 'purchase'; itemId: string; purchased: boolean }
  | { id: string; type: 'delete'; itemId: string }

const cacheKey = (familyId: string) => `familycart:${familyId}:items`
const queueKey = (familyId: string) => `familycart:${familyId}:queue`

export function readCachedItems(familyId: string): ShoppingItem[] {
  return JSON.parse(localStorage.getItem(cacheKey(familyId)) ?? '[]') as ShoppingItem[]
}

export function cacheItems(familyId: string, items: ShoppingItem[]) {
  localStorage.setItem(cacheKey(familyId), JSON.stringify(items))
}

export function readQueue(familyId: string): PendingOperation[] {
  return JSON.parse(localStorage.getItem(queueKey(familyId)) ?? '[]') as PendingOperation[]
}

export function queueOperation(familyId: string, operation: PendingOperation) {
  const queue = readQueue(familyId)
  if (!queue.some((entry) => entry.id === operation.id)) queue.push(operation)
  localStorage.setItem(queueKey(familyId), JSON.stringify(queue))
}

export function clearQueuedOperation(familyId: string, operationId: string) {
  localStorage.setItem(queueKey(familyId), JSON.stringify(readQueue(familyId).filter((entry) => entry.id !== operationId)))
}

export function queuedOperations(familyId: string): PendingOperation[] {
  return readQueue(familyId)
}

export type { PendingOperation }
