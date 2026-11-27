import { useState } from "react";
import { Menu, Moon, Settings, Sun, X, Monitor } from "lucide-react";
import { Logo } from "./Logo";
import { SettingsDialog } from "./SettingsDialog";
import { CATEGORIES } from "@/features/registry";
import { categoryPath } from "@/app/router";
import { IconButton, cx } from "@/components/ui";
import { prefs, usePrefs, resolvedTheme } from "@/stores/prefs";

const NAV = [{ id: "", name: "Todas as ferramentas", href: "#/" }, ...CATEGORIES.filter(c => c.id !== "ocr").map(c => ({ id: c.id, name: c.name, href: `#${categoryPath(c.id)}` }))];

export function Header({ route }: { route: string }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const { theme } = usePrefs();
  const activeId = route.startsWith("/categoria/") ? route.split("/")[2] : route === "/" ? "" : null;
  const nextTheme = theme === "system" ? (resolvedTheme() === "dark" ? "light" : "dark") : theme === "dark" ? "light" : "dark";
  const ThemeIcon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <a href="#/" aria-label="TudoPDF — início" className="shrink-0"><Logo /></a>
        <nav aria-label="Categorias" className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map(item => (
            <a
              key={item.id}
              href={item.href}
              aria-current={activeId === item.id ? "page" : undefined}
              className={cx(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                activeId === item.id ? "text-brand" : "text-ink-2 hover:bg-surface-3 hover:text-ink"
              )}
            >
              {item.name}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <IconButton icon={ThemeIcon} label={`Tema: ${theme === "system" ? "do sistema" : theme === "dark" ? "escuro" : "claro"} (alternar)`} onClick={() => prefs.setTheme(nextTheme)} />
          <IconButton icon={Settings} label="Configurações" onClick={() => setSettings(true)} />
          <IconButton icon={open ? X : Menu} label="Menu" className="lg:hidden" aria-expanded={open} onClick={() => setOpen(!open)} />
        </div>
      </div>
      {open && (
        <nav aria-label="Categorias" className="border-t border-line bg-surface px-4 py-2 lg:hidden">
          {NAV.map(item => (
            <a key={item.id} href={item.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3">
              {item.name}
            </a>
          ))}
        </nav>
      )}
      <SettingsDialog open={settings} onClose={() => setSettings(false)} />
    </header>
  );
}
