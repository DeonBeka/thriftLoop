import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import type { Product } from '@/types';

import { useAuth } from './useAuth';

/** What the basket remembers about an item (second-hand items are one of a kind, so no quantities). */
export interface BasketItem {
  id: number;
  title: string;
  price: number;
  size: string;
  condition: string;
  image: string | null;
  sellerId: number;
  sellerUsername: string;
  addedAt: number;
}

interface BasketContextValue {
  items: BasketItem[];
  count: number;
  has: (productId: number) => boolean;
  add: (product: Product) => void;
  remove: (productId: number) => void;
  /** Remove several items at once (e.g. after they were ordered). */
  removeMany: (productIds: number[]) => void;
}

const BasketContext = createContext<BasketContextValue | null>(null);
const MAX_ITEMS = 20;

// Stored on the device, one basket per account (plus a guest basket for signed-out browsing).
type Owner = number | 'guest';
const keyFor = (owner: Owner) => `thriftloop.basket.${owner}`;

function clearBasket(owner: Owner) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(keyFor(owner));
    else void SecureStore.deleteItemAsync(keyFor(owner));
  } catch {
    // ignore
  }
}

function readBasket(userId: Owner): BasketItem[] {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(keyFor(userId)) : SecureStore.getItem(keyFor(userId));
    const parsed = raw ? (JSON.parse(raw) as BasketItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBasket(userId: Owner, items: BasketItem[]) {
  const raw = JSON.stringify(items);
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(keyFor(userId), raw);
    else void SecureStore.setItemAsync(keyFor(userId), raw);
  } catch {
    // Storage full or unavailable: the basket still works for this session.
  }
}

export function BasketProvider({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const owner: Owner = user?.id ?? 'guest';
  const [items, setItems] = useState<BasketItem[]>([]);

  // Load the right basket when the account changes. Items picked while signed out move into the
  // account on sign-in, so nothing is lost.
  useEffect(() => {
    if (initializing) return;
    if (owner === 'guest') {
      setItems(readBasket('guest'));
      return;
    }
    const mine = readBasket(owner);
    const guest = readBasket('guest');
    const merged = [...mine, ...guest.filter((g) => !mine.some((m) => m.id === g.id))].slice(-MAX_ITEMS);
    if (guest.length) {
      writeBasket(owner, merged);
      clearBasket('guest');
    }
    setItems(merged);
  }, [owner, initializing]);

  const update = useCallback(
    (fn: (prev: BasketItem[]) => BasketItem[]) => {
      setItems((prev) => {
        const next = fn(prev);
        writeBasket(owner, next);
        return next;
      });
    },
    [owner],
  );

  const add = useCallback(
    (p: Product) =>
      update((prev) =>
        prev.some((i) => i.id === p.id)
          ? prev
          : [
              ...prev,
              {
                id: p.id,
                title: p.title,
                price: p.price,
                size: p.size,
                condition: p.condition,
                image: p.images[0]?.url ?? null,
                sellerId: p.seller.id,
                sellerUsername: p.seller.username,
                addedAt: Date.now(),
              },
            ].slice(-MAX_ITEMS),
      ),
    [update],
  );
  const remove = useCallback((id: number) => update((prev) => prev.filter((i) => i.id !== id)), [update]);
  const removeMany = useCallback(
    (ids: number[]) => update((prev) => prev.filter((i) => !ids.includes(i.id))),
    [update],
  );
  const has = useCallback((id: number) => items.some((i) => i.id === id), [items]);

  const value = useMemo(
    () => ({ items, count: items.length, has, add, remove, removeMany }),
    [items, has, add, remove, removeMany],
  );
  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket(): BasketContextValue {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error('useBasket must be used inside BasketProvider');
  return ctx;
}
