/**
 * Live view sizing: estimates body measurements from height + weight and compares them with
 * typical garment measurements for each size. These are averages, not tailoring, so wording stays
 * friendly ("likely a regular fit") rather than absolute.
 */
import type { Category } from '@/types';

export interface Body {
  heightCm: number;
  weightKg: number;
}

export interface BodyMeasurements {
  bmi: number;
  chest: number; // circumference, cm
  waist: number;
  hips: number;
  euShoe: number;
}

export type FitKind = 'too-small' | 'snug' | 'regular' | 'relaxed' | 'too-big' | 'one-size';

export interface FitResult {
  kind: FitKind;
  /** Garment size relative to the body: <1 tighter, >1 looser. Drives the drawing. */
  ease: number;
  /** Garment length relative to the ideal for this body: <1 shorter, >1 longer. */
  length: number;
  headline: string;
  detail: string;
  recommended: string | null;
}

export const LIMITS = { height: [140, 210], weight: [40, 160] } as const;

export function measure({ heightCm, weightKg }: Body): BodyMeasurements {
  const bmi = weightKg / (heightCm / 100) ** 2;
  const scale = Math.pow(heightCm / 175, 0.6);
  return {
    bmi,
    chest: (52 + 1.95 * bmi) * scale,
    waist: (20 + 2.6 * bmi) * scale,
    hips: (50 + 2.0 * bmi) * scale,
    euShoe: Math.round((heightCm * 0.152 + 1.5) * 1.5),
  };
}

// Body chest each top size is cut for (regular fit), and its body length.
const TOP_CHEST: Record<string, number> = { XXS: 82, XS: 87, S: 93, M: 99, L: 105, XL: 112, XXL: 119 };
const TOP_LENGTH: Record<string, number> = { XXS: 62, XS: 65, S: 68, M: 71, L: 73, XL: 75, XXL: 77 };
// Body waist each bottom size fits.
const LETTER_WAIST: Record<string, number> = { XXS: 64, XS: 68, S: 74, M: 80, L: 87, XL: 95, XXL: 103 };

export const TOP_SIZES = Object.keys(TOP_CHEST);
export const WAIST_SIZES = ['W26', 'W28', 'W30', 'W32', 'W34', 'W36', 'W38'];
export const SHOE_SIZES = Array.from({ length: 11 }, (_, i) => `EU ${36 + i}`);

export type GarmentKind = 'top' | 'bottom' | 'shoes' | 'hat' | 'bag';

export function garmentKind(category: Category, title = ''): GarmentKind {
  if (category === 'Hoodies' || category === 'T-shirts' || category === 'Jackets') return 'top';
  if (category === 'Jeans' || category === 'Trousers') return 'bottom';
  if (category === 'Shoes') return 'shoes';
  return /beanie|hat|cap|bucket/i.test(title) ? 'hat' : 'bag';
}

/** Which sizes to offer as "try another size" chips. */
export function sizeOptions(kind: GarmentKind, current: string): string[] {
  if (kind === 'top') return TOP_SIZES;
  if (kind === 'bottom') return current.startsWith('W') ? WAIST_SIZES : TOP_SIZES;
  if (kind === 'shoes') return SHOE_SIZES;
  return [];
}

function waistFor(size: string): number | null {
  if (size.startsWith('W')) return Number(size.slice(1)) * 2.54;
  return LETTER_WAIST[size] ?? null;
}

function verdict(diff: number, tight: number, snug: number, relaxed: number, big: number): FitKind {
  if (diff < tight) return 'too-small';
  if (diff < snug) return 'snug';
  if (diff <= relaxed) return 'regular';
  if (diff <= big) return 'relaxed';
  return 'too-big';
}

const HEADLINE: Record<FitKind, string> = {
  'too-small': 'Probably too small',
  snug: 'Snug fit',
  regular: 'Regular fit',
  relaxed: 'Relaxed, oversized fit',
  'too-big': 'Probably too big',
  'one-size': 'One size fits most',
};

function closest(sizes: string[], value: (s: string) => number | null, target: number): string | null {
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const s of sizes) {
    const v = value(s);
    if (v == null) continue;
    const d = Math.abs(v - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = s;
    }
  }
  return best;
}

export function fitFor(body: Body, kind: GarmentKind, size: string): FitResult {
  const m = measure(body);

  if (kind === 'top' && TOP_CHEST[size]) {
    const diff = TOP_CHEST[size] - m.chest;
    const kindOfFit = verdict(diff, -7, -2.5, 5, 12);
    const idealLength = body.heightCm * 0.4;
    const length = TOP_LENGTH[size] / idealLength;
    const recommended = closest(TOP_SIZES, (s) => TOP_CHEST[s], m.chest + 1.5);
    const lengthNote = length < 0.93 ? ' It will sit short on you, more like a cropped fit.' : length > 1.08 ? ' It will be on the long side.' : '';
    const chestNote =
      kindOfFit === 'too-small' ? 'It will be tight across your chest and shoulders.'
      : kindOfFit === 'snug' ? 'Close to the body. Fine if you like a fitted look.'
      : kindOfFit === 'regular' ? 'Comfortable room across the chest, how it was designed to fit.'
      : kindOfFit === 'relaxed' ? 'Loose and roomy. Great if you like an oversized look.'
      : 'Much bigger than your size; it will hang very loose.';
    return {
      kind: kindOfFit,
      ease: Math.min(1.3, Math.max(0.88, TOP_CHEST[size] / m.chest)),
      length: Math.min(1.2, Math.max(0.8, length)),
      headline: HEADLINE[kindOfFit],
      detail: chestNote + lengthNote,
      recommended,
    };
  }

  if (kind === 'bottom') {
    const waist = waistFor(size);
    if (waist != null) {
      const diff = waist - m.waist;
      const kindOfFit = verdict(diff, -6, -2, 4, 9);
      const pool = size.startsWith('W') ? WAIST_SIZES : TOP_SIZES;
      const recommended = closest(pool, waistFor, m.waist + 1);
      const detail =
        kindOfFit === 'too-small' ? 'The waist will be too tight to close comfortably.'
        : kindOfFit === 'snug' ? 'A close fit at the waist.'
        : kindOfFit === 'regular' ? 'Should sit comfortably at your waist.'
        : kindOfFit === 'relaxed' ? 'Roomy at the waist; you may want a belt.'
        : 'Too wide at the waist; you would need a belt.';
      return {
        kind: kindOfFit,
        ease: Math.min(1.3, Math.max(0.9, waist / m.waist)),
        length: 1,
        headline: HEADLINE[kindOfFit],
        detail,
        recommended,
      };
    }
  }

  if (kind === 'shoes' && size.startsWith('EU')) {
    const diff = Number(size.slice(3)) - m.euShoe;
    const kindOfFit: FitKind = diff <= -2 ? 'too-small' : diff === -1 ? 'snug' : diff <= 1 ? 'regular' : 'too-big';
    return {
      kind: kindOfFit,
      ease: 1 + diff * 0.04,
      length: 1,
      headline: kindOfFit === 'regular' ? 'Likely your size' : HEADLINE[kindOfFit],
      detail: `People your height usually wear around EU ${m.euShoe}. Shoe sizes vary by brand, so ask the seller for the insole length if unsure.`,
      recommended: `EU ${m.euShoe}`,
    };
  }

  return {
    kind: 'one-size',
    ease: 1,
    length: 1,
    headline: HEADLINE['one-size'],
    detail: kind === 'hat' ? 'Stretchy one-size fit for most heads.' : 'Accessories fit everyone. Here is how it looks with your build.',
    recommended: null,
  };
}

/** Garment colour from the photo-detected colour (falls back to words in the title). */
const PALETTE: Record<string, string> = {
  black: '#232323',
  white: '#F4F2EE',
  grey: '#9A9C9E',
  blue: '#3C5A8C',
  green: '#4F6B45',
  red: '#B23A35',
  brown: '#7A5233',
  beige: '#D8C7A8',
  pink: '#E7A5B6',
  purple: '#6E4F8C',
  yellow: '#E2BE45',
  orange: '#D9773A',
};

export function garmentColors(photoColors: string[] | undefined, title: string): [string, string | null] {
  let names = (photoColors ?? []).filter((c) => PALETTE[c]);
  if (!names.length) {
    const lower = title.toLowerCase();
    names = Object.keys(PALETTE).filter((c) => lower.includes(c) || (c === 'blue' && /denim|navy/.test(lower)));
  }
  const first = PALETTE[names[0]] ?? '#6F7F73';
  const second = names[1] ? PALETTE[names[1]] : null;
  return [first, second];
}
