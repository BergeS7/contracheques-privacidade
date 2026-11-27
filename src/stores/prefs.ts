/**
 * Preferências locais (tema, favoritos, recentes). Ficam só neste navegador (localStorage)
 * e nunca incluem documentos ou conteúdo deles. Podem ser apagadas em Configurações.
 */
import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";

export interface Prefs {
  theme: ThemePref;
  favorites: string[];
  recent: string[];
}

const KEY = "tudopdf:prefs:v1";
const DEFAULTS: Prefs = { theme: "system", favorites: [], recent: [] };

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : "system",
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter(x => typeof x === "string").slice(0, 50) : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter(x => typeof x === "string").slice(0, 8) : []
    };
  } catch {
    return DEFAULTS;
  }
}

let state: Prefs = typeof localStorage === "undefined" ? DEFAULTS : read();
const listeners = new Set<() => void>();

function write(next: Prefs) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Armazenamento indisponível (modo privado): mantém só em memória.
  }
  listeners.forEach(l => l());
}

export const prefs = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setTheme(theme: ThemePref) {
    write({ ...state, theme });
    applyTheme();
  },
  toggleFavorite(id: string) {
    const has = state.favorites.includes(id);
    write({ ...state, favorites: has ? state.favorites.filter(f => f !== id) : [...state.favorites, id] });
  },
  pushRecent(id: string) {
    write({ ...state, recent: [id, ...state.recent.filter(r => r !== id)].slice(0, 8) });
  },
  clearAll() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith("tudopdf:")).forEach(k => localStorage.removeItem(k));
    } catch {
      // ignorado
    }
    state = DEFAULTS;
    listeners.forEach(l => l());
    applyTheme();
  }
};

export function usePrefs(): Prefs {
  return useSyncExternalStore(prefs.subscribe, prefs.get, prefs.get);
}

export function resolvedTheme(): "light" | "dark" {
  if (state.theme !== "system") return state.theme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme() {
  const dark = resolvedTheme() === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
