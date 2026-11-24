import type { Category } from '../types'

export const categorySeeds: Omit<Category, 'id'>[] = [
  { name_nl: 'Groenten en fruit', name_en: 'Fruit & vegetables', name_ar: 'خضار وفواكه', emoji: '🥑', sort_order: 1 },
  { name_nl: 'Kruiden en specerijen', name_en: 'Herbs & spices', name_ar: 'أعشاب وتوابل', emoji: '🌿', sort_order: 2 },
  { name_nl: 'Brood en bakkerij', name_en: 'Bakery', name_ar: 'مخبوزات', emoji: '🥖', sort_order: 3 },
  { name_nl: 'Zuivel en eieren', name_en: 'Dairy & eggs', name_ar: 'ألبان وبيض', emoji: '🥛', sort_order: 4 },
  { name_nl: 'Vlees en vis', name_en: 'Meat & fish', name_ar: 'لحوم وأسماك', emoji: '🐟', sort_order: 5 },
  { name_nl: 'Dranken', name_en: 'Drinks', name_ar: 'مشروبات', emoji: '🧃', sort_order: 6 },
  { name_nl: 'Diepvries', name_en: 'Frozen', name_ar: 'مجمدات', emoji: '🧊', sort_order: 7 },
  { name_nl: 'Huishoudelijke producten', name_en: 'Household products', name_ar: 'منتجات منزلية', emoji: '🧽', sort_order: 8 },
  { name_nl: 'Persoonlijke verzorging', name_en: 'Personal care', name_ar: 'عناية شخصية', emoji: '🧴', sort_order: 9 },
  { name_nl: 'Overige', name_en: 'Other', name_ar: 'أخرى', emoji: '🛒', sort_order: 10 },
]

const categoryWords: Record<string, string[]> = {
  'Groenten en fruit': ['appel', 'aardbei', 'avocado', 'banaan', 'broccoli', 'citroen', 'druif', 'komkommer', 'paprika', 'sla', 'tomaat', 'ui', 'wortel', 'spinazie', 'orange', 'banana', 'tomato', 'onion', 'carrot', 'apple'],
  'Kruiden en specerijen': ['basilicum', 'kaneel', 'kerrie', 'knoflook', 'koriander', 'oregano', 'peper', 'peterselie', 'zout', 'paprika poeder'],
  'Brood en bakkerij': ['brood', 'croissant', 'cracker', 'bagel', 'pistolet', 'stokbrood', 'toast', 'broodje'],
  'Zuivel en eieren': ['boter', 'kaas', 'kwark', 'melk', 'room', 'yoghurt', 'ei', 'eieren', 'cheese', 'milk', 'yogurt'],
  'Vlees en vis': ['kip', 'gehakt', 'ham', 'zalm', 'tonijn', 'vis', 'vlees', 'worst'],
  'Dranken': ['water', 'sap', 'koffie', 'thee', 'limonade', 'cola', 'drinken'],
  'Diepvries': ['diepvries', 'ijs', 'pizza', 'friet'],
  'Huishoudelijke producten': ['afwas', 'wasmiddel', 'toiletpapier', 'keukenrol', 'schoonmaak', 'vuilniszak', 'spons'],
  'Persoonlijke verzorging': ['shampoo', 'tandpasta', 'zeep', 'deo', 'conditioner', 'douchegel'],
}

export function inferCategory(name: string, categories: Category[]): Category {
  const normalized = name.trim().toLocaleLowerCase()
  const match = Object.entries(categoryWords).find(([, words]) =>
    words.some((word) => normalized.includes(word)),
  )
  const label = match?.[0] ?? 'Overige'
  return categories.find((category) => category.name_nl === label) ?? categories[categories.length - 1]
}
