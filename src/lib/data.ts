import { supabase } from './supabase'
import { clearQueuedOperation, queuedOperations, type PendingOperation } from './offline'
import type { ActivityEntry, Category, Family, FamilyMember, Profile, PurchaseHistoryEntry, ShoppingItem, ShoppingSession } from '../types'

function client() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export async function getFamilies(userId: string): Promise<Family[]> {
  const { data, error } = await client().from('family_members')
    .select('family:families!family_members_family_id_fkey(id,name,created_by)')
    .eq('user_id', userId)
  throwOnError(error)
  return (data ?? []).flatMap((entry) => {
    const related = relationOne(entry.family)
    return related ? [related as unknown as Family] : []
  })
}

export async function createFamily(name: string, userId: string): Promise<Family> {
  const db = client()
  const { data: family, error } = await db.from('families')
    .insert({ name: name.trim(), created_by: userId })
    .select('id,name,created_by')
    .single()
  throwOnError(error)
  if (!family) throw new Error('Family could not be created.')
  const { error: memberError } = await db.from('family_members')
    .insert({ family_id: family.id, user_id: userId, role: 'owner' })
  if (memberError) {
    const { error: cleanupError } = await db.from('families').delete().eq('id', family.id)
    if (cleanupError) throw new Error(`${memberError.message}; family cleanup failed: ${cleanupError.message}`)
    throw new Error(memberError.message)
  }
  return family as Family
}

export async function createInvite(familyId: string): Promise<string> {
  const { data, error } = await client().rpc('create_family_invite', { p_family_id: familyId })
  throwOnError(error)
  if (typeof data !== 'string') throw new Error('No invitation code was returned.')
  return data
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await client().rpc('revoke_family_invite', { p_invite_id: inviteId })
  throwOnError(error)
}

export async function joinFamily(code: string): Promise<string> {
  const { data, error } = await client().rpc('join_family_by_code', { p_code: code })
  throwOnError(error)
  if (typeof data !== 'string') throw new Error('No family was returned for this invitation.')
  return data
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await client().from('categories')
    .select('id,name_nl,name_en,name_ar,emoji,sort_order')
    .order('sort_order')
  throwOnError(error)
  return (data ?? []) as Category[]
}

export async function getFamilyItems(familyId: string): Promise<ShoppingItem[]> {
  const { data, error } = await client().from('shopping_items')
    .select('*,creator:profiles!shopping_items_created_by_fkey(id,display_name,avatar_url),purchaser:profiles!shopping_items_purchased_by_fkey(id,display_name,avatar_url),category:categories(*)')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
  throwOnError(error)
  return (data ?? []).map((row) => ({
    ...row,
    creator: relationOne(row.creator),
    purchaser: relationOne(row.purchaser),
    category: relationOne(row.category),
  })) as unknown as ShoppingItem[]
}

export async function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const { data, error } = await client().from('family_members')
    .select('family_id,user_id,role,profile:profiles!family_members_user_id_fkey(id,display_name,avatar_url)')
    .eq('family_id', familyId)
    .order('joined_at')
  throwOnError(error)
  return (data ?? []).map((member) => ({
    family_id: member.family_id,
    user_id: member.user_id,
    role: member.role,
    profile: relationOne(member.profile) as unknown as Profile,
  })) as FamilyMember[]
}

export async function getShoppingSessions(familyId: string): Promise<ShoppingSession[]> {
  const { data, error } = await client().from('shopping_sessions')
    .select('id,user_id,started_at,profile:profiles!shopping_sessions_user_id_fkey(id,display_name,avatar_url)')
    .eq('family_id', familyId)
    .gt('last_seen_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
  throwOnError(error)
  return (data ?? []).map((session) => ({
    ...session,
    profile: relationOne(session.profile),
  })) as unknown as ShoppingSession[]
}

export async function getActivity(familyId: string): Promise<ActivityEntry[]> {
  const { data, error } = await client().from('activity_logs')
    .select('id,action,item_name,created_at,actor:profiles!activity_logs_actor_id_fkey(id,display_name)')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(12)
  throwOnError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    item_name: row.item_name,
    created_at: row.created_at,
    actor: Array.isArray(row.actor) ? row.actor[0] ?? null : row.actor,
  })) as ActivityEntry[]
}

export async function getInvite(familyId: string) {
  const { data, error } = await client().from('family_invites')
    .select('id,expires_at,created_at')
    .eq('family_id', familyId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  throwOnError(error)
  return data
}

export async function getPreferences(userId: string) {
  const { data, error } = await client().from('user_preferences')
    .select('language,theme')
    .eq('user_id', userId)
    .maybeSingle()
  throwOnError(error)
  return data
}

export async function savePreferences(userId: string, preferences: { language: string; theme: string }) {
  const { error } = await client().from('user_preferences')
    .upsert({ user_id: userId, ...preferences, updated_at: new Date().toISOString() })
  throwOnError(error)
}

export async function saveProfile(userId: string, displayName: string, avatarUrl: string) {
  const { error } = await client().from('profiles')
    .update({ display_name: displayName.trim(), avatar_url: avatarUrl.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', userId)
  throwOnError(error)
}

export async function addItem(item: ShoppingItem): Promise<void> {
  const db = client()
  const categoryId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.category_id)
    ? item.category_id
    : (await db.from('categories').select('id').eq('name_nl', item.category?.name_nl ?? 'Overige').single()).data?.id
  if (!categoryId) throw new Error('Product category could not be resolved.')
  const { error } = await db.from('shopping_items').upsert({
    id: item.id,
    family_id: item.family_id,
    name: item.name.trim(),
    quantity: item.quantity,
    unit: item.unit || null,
    note: item.note || null,
    category_id: categoryId,
    is_urgent: item.is_urgent,
    is_favorite: item.is_favorite,
    created_by: item.created_by,
    created_at: item.created_at,
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (error?.code === '23505') throw new Error('DUPLICATE_ACTIVE_ITEM')
  throwOnError(error)
}

export async function updateItem(itemId: string, changes: Partial<ShoppingItem>) {
  const { error } = await client().from('shopping_items').update(changes).eq('id', itemId)
  if (error?.code === '23505') throw new Error('DUPLICATE_ACTIVE_ITEM')
  throwOnError(error)
}

export async function setPurchased(itemId: string, purchased: boolean) {
  const { error } = await client().from('shopping_items').update({
    purchased_at: purchased ? new Date().toISOString() : null,
  }).eq('id', itemId)
  throwOnError(error)
}

export async function deleteItem(itemId: string) {
  const { error } = await client().from('shopping_items').delete().eq('id', itemId)
  throwOnError(error)
}

export async function getPurchaseHistory(familyId: string): Promise<PurchaseHistoryEntry[]> {
  const { data, error } = await client().from('purchase_history')
    .select('id,item_name,quantity,unit,purchased_at,purchaser:profiles!purchase_history_purchased_by_fkey(display_name),category:categories(*)')
    .eq('family_id', familyId)
    .order('purchased_at', { ascending: false })
    .limit(100)
  throwOnError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    item_name: row.item_name,
    quantity: row.quantity,
    unit: row.unit,
    purchased_at: row.purchased_at,
    purchaser: relationOne(row.purchaser),
    category: relationOne(row.category),
  })) as PurchaseHistoryEntry[]
}

export async function startShopping(familyId: string, userId: string) {
  const { error } = await client().from('shopping_sessions')
    .upsert({ family_id: familyId, user_id: userId, started_at: new Date().toISOString(), last_seen_at: new Date().toISOString() }, { onConflict: 'family_id,user_id' })
  throwOnError(error)
}

export async function touchShoppingSession(familyId: string, userId: string) {
  const { error } = await client().from('shopping_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('family_id', familyId).eq('user_id', userId)
  throwOnError(error)
}

export async function stopShopping(familyId: string, userId: string) {
  const { error } = await client().from('shopping_sessions')
    .delete().eq('family_id', familyId).eq('user_id', userId)
  throwOnError(error)
}

const syncInFlight = new Map<string, Promise<number>>()

export async function syncOperations(familyId: string): Promise<number> {
  const pending = syncInFlight.get(familyId)
  if (pending) return pending
  const task = syncQueue(familyId)
  syncInFlight.set(familyId, task)
  try {
    return await task
  } finally {
    syncInFlight.delete(familyId)
  }
}

async function syncQueue(familyId: string): Promise<number> {
  let duplicateCount = 0
  for (const operation of queuedOperations(familyId)) {
    try {
      await applyOperation(operation)
      clearQueuedOperation(familyId, operation.id)
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_ACTIVE_ITEM' && operation.type === 'add') {
        clearQueuedOperation(familyId, operation.id)
        duplicateCount += 1
        continue
      }
      throw error
    }
  }
  return duplicateCount
}

async function applyOperation(operation: PendingOperation) {
  if (operation.type === 'add') return addItem(operation.item)
  if (operation.type === 'update') return updateItem(operation.itemId, operation.changes)
  if (operation.type === 'purchase') {
    const { error } = await client().from('shopping_items').update({
      purchased_at: operation.purchased ? new Date().toISOString() : null,
    }).eq('id', operation.itemId)
    throwOnError(error)
    return
  }
  return deleteItem(operation.itemId)
}
