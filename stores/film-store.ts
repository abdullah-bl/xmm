import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { storage } from '@/lib/storage';

interface FilmState {
  activeFilmId: string | null;
  intensity: number;
  favorites: string[];

  setActive: (id: string | null) => void;
  setIntensity: (value: number) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const useFilmStore = create<FilmState>()(
  persist(
    (set, get) => ({
      activeFilmId: null,
      intensity: 1,
      favorites: [],

      setActive: (activeFilmId) => set({ activeFilmId }),
      setIntensity: (intensity) =>
        set({ intensity: Math.min(Math.max(intensity, 0), 1) }),
      toggleFavorite: (id) =>
        set((state) => {
          const next = new Set(state.favorites);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return { favorites: Array.from(next) };
        }),
      isFavorite: (id) => get().favorites.includes(id),
    }),
    {
      name: 'film-store:v1',
      storage: createJSONStorage(() => ({
        getItem: (name) => storage.getString(name),
        setItem: (name, value) => storage.setString(name, value),
        removeItem: (name) => storage.remove(name),
      })),
      partialize: (state) => ({
        activeFilmId: state.activeFilmId,
        intensity: state.intensity,
        favorites: state.favorites,
      }),
    },
  ),
);
