import type { Category, Condition, SortOption } from '@/types';

/** Each category gets a soft tint used for its tile on Home / Explore. */
export const CATEGORIES: { name: Category; tint: string }[] = [
  { name: 'Hoodies', tint: '#E4ECE5' },
  { name: 'T-shirts', tint: '#EFEBE3' },
  { name: 'Jackets', tint: '#E3E8EC' },
  { name: 'Jeans', tint: '#E1E7EF' },
  { name: 'Trousers', tint: '#ECE8E1' },
  { name: 'Shoes', tint: '#EFE6E2' },
  { name: 'Accessories', tint: '#E9E5EE' },
];

export const CONDITIONS: { name: Condition; hint: string }[] = [
  { name: 'New with tags', hint: 'Never worn, original tags attached' },
  { name: 'Like new', hint: 'Worn once or twice, no flaws' },
  { name: 'Good', hint: 'Gently used, minor signs of wear' },
  { name: 'Fair', hint: 'Visible wear, described in the listing' },
];

export const CLOTHING_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const SHOE_SIZES = ['EU 36', 'EU 37', 'EU 38', 'EU 39', 'EU 40', 'EU 41', 'EU 42', 'EU 43', 'EU 44', 'EU 45', 'EU 46'];
export const WAIST_SIZES = ['W26', 'W28', 'W30', 'W32', 'W34', 'W36', 'W38'];
export const ONE_SIZE = ['One size'];

export function sizesForCategory(category: Category | null): string[] {
  switch (category) {
    case 'Shoes':
      return SHOE_SIZES;
    case 'Jeans':
      return [...WAIST_SIZES, ...CLOTHING_SIZES];
    case 'Accessories':
      return [...ONE_SIZE, ...CLOTHING_SIZES];
    default:
      return CLOTHING_SIZES;
  }
}

export const ALL_FILTER_SIZES = [...CLOTHING_SIZES, ...WAIST_SIZES, ...SHOE_SIZES, ...ONE_SIZE];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'popular', label: 'Most saved' },
];

export const PRICE_RANGES: { label: string; min?: number; max?: number }[] = [
  { label: 'Under €20', max: 20 },
  { label: '€20–50', min: 20, max: 50 },
  { label: '€50–100', min: 50, max: 100 },
  { label: '€100+', min: 100 },
];
