export type Language = 'nl' | 'en' | 'ar'
export type Page = 'home' | 'list' | 'shop' | 'history' | 'family' | 'settings'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
}

export interface Family {
  id: string
  name: string
  created_by: string
}

export interface FamilyMember {
  family_id: string
  user_id: string
  role: 'owner' | 'member'
  profile: Profile
}

export interface Category {
  id: string
  name_nl: string
  name_en: string
  name_ar: string
  emoji: string
  sort_order: number
}

export interface ShoppingItem {
  id: string
  family_id: string
  name: string
  quantity: number
  unit: string | null
  note: string | null
  category_id: string
  is_urgent: boolean
  is_favorite: boolean
  created_by: string
  created_at: string
  purchased_at: string | null
  purchased_by: string | null
  creator?: Profile
  purchaser?: Profile | null
  category?: Category
  pending?: boolean
}

export interface ShoppingSession {
  id: string
  user_id: string
  started_at: string
  profile?: Profile
}

export interface ActivityEntry {
  id: string
  action: string
  item_name: string
  created_at: string
  actor: Pick<Profile, 'display_name'> | null
}

export interface PurchaseHistoryEntry {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  purchased_at: string
  purchaser: Pick<Profile, 'display_name'> | null
  category: Category | null
}

export interface UserPreferences {
  language: Language
  theme: 'light' | 'dark' | 'system'
}
