import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { favoritesApi } from '@/services/api';
import type { Product } from '@/types';

import { useAuth } from './useAuth';

interface FavoritesContextValue {
  /** Product ids the current user has saved. */
  ids: Set<number>;
  isFavorite: (product: Pick<Product, 'id' | 'is_favorited'>) => boolean;
  toggle: (product: Pick<Product, 'id' | 'is_favorited'>) => Promise<void>;
  /** Bumps whenever favorites change so lists can refetch. */
  version: number;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const pending = useRef(new Set<number>());

  useEffect(() => {
    setIds(new Set());
    setLoaded(false);
    if (!user) return;
    favoritesApi
      .list()
      .then((items) => {
        setIds(new Set(items.map((p) => p.id)));
        setLoaded(true);
      })
      .catch(() => setLoaded(false));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFavorite = useCallback(
    (product: Pick<Product, 'id' | 'is_favorited'>) => (loaded ? ids.has(product.id) : ids.has(product.id) || product.is_favorited),
    [ids, loaded],
  );

  const toggle = useCallback(
    async (product: Pick<Product, 'id' | 'is_favorited'>) => {
      if (pending.current.has(product.id)) return;
      const wasFavorite = isFavorite(product);
      const apply = (fav: boolean) =>
        setIds((prev) => {
          const next = new Set(prev);
          if (fav) next.add(product.id);
          else next.delete(product.id);
          return next;
        });

      apply(!wasFavorite); // optimistic
      setLoaded(true);
      pending.current.add(product.id);
      try {
        if (wasFavorite) await favoritesApi.remove(product.id);
        else await favoritesApi.add(product.id);
        setVersion((v) => v + 1);
      } catch (err) {
        apply(wasFavorite);
        Alert.alert("Couldn't update favorites", err instanceof Error ? err.message : 'Please try again.');
      } finally {
        pending.current.delete(product.id);
      }
    },
    [isFavorite],
  );

  const value = useMemo(() => ({ ids, isFavorite, toggle, version }), [ids, isFavorite, toggle, version]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
