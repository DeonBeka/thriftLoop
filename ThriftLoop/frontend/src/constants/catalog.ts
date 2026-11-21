import type { Category, Condition, SortOption } from '@/types';

/** Unsplash CDN photo (Unsplash License, free to use). Square crop for small tiles. */
export function unsplash(id: string, w = 300, h = w): string {
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&crop=entropy&q=75&auto=format`;
}

/** Each category has a real photo used for its round tile on Home. */
export const CATEGORIES: { name: Category; photo: string }[] = [
  { name: 'Hoodies', photo: unsplash('1454793781512-0fafb38dce83') },
  { name: 'T-shirts', photo: unsplash('1778671394516-8270eac13c42') },
  { name: 'Jackets', photo: unsplash('1772985451338-6bbc32aeedf1') },
  { name: 'Jeans', photo: unsplash('1700844414385-0cedc33e4bd6') },
  { name: 'Trousers', photo: unsplash('1789110853687-71692f0e86be') },
  { name: 'Shoes', photo: unsplash('1608231387042-66d1773070a5') },
  { name: 'Accessories', photo: unsplash('1780480999314-bab9df2c4f1f') },
];

/** Photo for the "sell" banner on Home. */
export const HERO_PHOTO = unsplash('1543076447-215ad9ba6923', 500, 640);

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
