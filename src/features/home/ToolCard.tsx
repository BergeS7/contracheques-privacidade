import { Star } from "lucide-react";
import type { ToolDef } from "@/features/registry";
import { toolPath } from "@/app/router";
import { cx } from "@/components/ui";
import { prefs, usePrefs } from "@/stores/prefs";

export function ToolCard({ tool, compact }: { tool: ToolDef; compact?: boolean }) {
  const { favorites } = usePrefs();
  const fav = favorites.includes(tool.id);
  const Icon = tool.icon;
  const available = tool.status === "available";

  if (!available) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-dashed border-line px-3.5 py-3" aria-disabled="true">
        <Icon className="mt-0.5 size-5 shrink-0 text-muted/70" aria-hidden />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            {tool.name}
            <span className="rounded bg-surface-3 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted">Em breve</span>
          </p>
          {!compact && <p className="mt-0.5 line-clamp-2 text-xs text-muted/80">{tool.description}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex items-start gap-3 rounded-md border border-line bg-surface px-3.5 py-3.5 shadow-sm transition-[border-color,box-shadow] hover:border-brand/50 hover:shadow-md">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-brand-ink">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <a href={`#${toolPath(tool.id)}`} className="text-[15px] font-semibold text-ink after:absolute after:inset-0 after:content-['']">
          {tool.name}
        </a>
        {!compact && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{tool.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => prefs.toggleFavorite(tool.id)}
        aria-label={fav ? `Remover ${tool.name} dos favoritos` : `Adicionar ${tool.name} aos favoritos`}
        aria-pressed={fav}
        className={cx(
          "absolute right-2 top-2 z-10 rounded p-1 transition-opacity",
          fav ? "text-brand opacity-100" : "text-muted opacity-0 hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
        )}
      >
        <Star className={cx("size-4", fav && "fill-current")} aria-hidden />
      </button>
    </div>
  );
}
