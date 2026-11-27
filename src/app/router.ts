/**
 * Roteador por hash (#/ferramenta/juntar). Funciona igual na extensão (chrome-extension://),
 * no GitHub Pages e offline, sem configuração de servidor.
 */
import { useSyncExternalStore } from "react";

function current(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash.startsWith("/") ? hash : "/";
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useRoute(): string {
  return useSyncExternalStore(subscribe, current, () => "/");
}

export function navigate(path: string) {
  if (current() === path) return;
  window.location.hash = path;
  window.scrollTo({ top: 0 });
}

export const toolPath = (id: string) => `/ferramenta/${id}`;
export const categoryPath = (id: string) => `/categoria/${id}`;
