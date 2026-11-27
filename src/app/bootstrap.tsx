import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, prefs } from "@/stores/prefs";

export function bootstrap(root: HTMLElement) {
  applyTheme();
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (prefs.get().theme === "system") applyTheme();
  });

  // Evita que um arquivo solto fora da área de upload seja aberto pelo navegador (saindo do app).
  window.addEventListener("dragover", e => e.preventDefault());
  window.addEventListener("drop", e => e.preventDefault());

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  // PWA: service worker só na versão web publicada (a extensão já funciona offline).
  if (__BUILD_TARGET__ === "web" && import.meta.env.PROD && "serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    });
  }
}
