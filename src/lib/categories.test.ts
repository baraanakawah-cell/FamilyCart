import { describe, expect, it } from 'vitest'
import { categorySeeds, inferCategory } from './categories'
import type { Category } from '../types'

const categories = categorySeeds.map((category, index) => ({ ...category, id: String(index) })) satisfies Category[]

describe('inferCategory', () => {
  it('categorizes common products without a remote service', () => {
    expect(inferCategory('Rijpe banaan', categories).name_nl).toBe('Groenten en fruit')
    expect(inferCategory('Havermelk', categories).name_nl).toBe('Zuivel en eieren')
    expect(inferCategory('Toiletpapier', categories).name_nl).toBe('Huishoudelijke producten')
  })

  it('uses the other category when the local vocabulary has no match', () => {
    expect(inferCategory('Onbekend speciaal product', categories).name_nl).toBe('Overige')
  })
})
