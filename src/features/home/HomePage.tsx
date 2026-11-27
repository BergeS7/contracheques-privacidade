import { useMemo, useState } from "react";
import { Search, ShieldCheck, WifiOff, Cpu, X, ArrowRight } from "lucide-react";
import { CATEGORIES, TOOLS, searchTools, suggestTools, toolById, type ToolDef } from "@/features/registry";
import { ToolCard } from "./ToolCard";
import { Dropzone } from "@/components/upload/Dropzone";
import { usePrefs } from "@/stores/prefs";
import { setPendingFiles } from "@/stores/pendingFiles";
import { navigate, toolPath, categoryPath } from "@/app/router";
import { Button, IconButton } from "@/components/ui";

export function HomePage() {
  const [query, setQuery] = useState("");
  const [dropped, setDropped] = useState<File[] | null>(null);
  const { favorites, recent } = usePrefs();
  const results = useMemo(() => (query.trim() ? searchTools(query) : null), [query]);
  const favTools = favorites.map(toolById).filter((t): t is ToolDef => !!t && t.status === "available");
  const recentTools = recent.map(toolById).filter((t): t is ToolDef => !!t && t.status === "available").slice(0, 4);
  const featured = TOOLS.filter(t => t.featured);
  const suggestions = dropped ? suggestTools(dropped) : [];
  const availableCount = TOOLS.filter(t => t.status === "available").length;

  const openWith = (tool: ToolDef) => {
    if (dropped) setPendingFiles(dropped);
    navigate(toolPath(tool.id));
  };

  return (
    <div className="tp-fade-in">
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:pt-16">
          <div className="max-w-3xl">
            <h1 className="text-[32px] font-bold leading-[1.1] tracking-tight text-ink sm:text-[44px]">
              Todas as ferramentas PDF que você precisa.
            </h1>
            <p className="mt-4 text-lg text-muted">
              Organize, edite, converta e automatize seus documentos com segurança e privacidade.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              <li className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-ok" aria-hidden />Processamento local</li>
              <li className="flex items-center gap-1.5"><WifiOff className="size-4 text-ok" aria-hidden />Funciona offline</li>
              <li className="flex items-center gap-1.5"><Cpu className="size-4 text-ok" aria-hidden />Sem cadastro, sem envio de arquivos</li>
            </ul>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="relative self-start">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Buscar entre ${availableCount} ferramentas: juntar, contracheques, JPG...`}
                aria-label="Buscar ferramentas"
                className="h-14 w-full rounded-lg border border-line-strong bg-surface pl-12 pr-4 text-base text-ink shadow-sm placeholder:text-muted focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
              />
            </div>
            {!dropped ? (
              <Dropzone compact accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.txt" multiple onFiles={setDropped}
                label="Solte arquivos aqui para começar" hint="Sugerimos a ferramenta certa. Nada é enviado." />
            ) : (
              <div className="rounded-lg border border-brand/40 bg-brand-soft p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{dropped.length} arquivo(s) prontos. O que deseja fazer?</p>
                  <IconButton icon={X} label="Descartar arquivos" onClick={() => setDropped(null)} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.length ? suggestions.map(t => (
                    <Button key={t.id} size="sm" variant="secondary" icon={t.icon} onClick={() => openWith(t)}>{t.name}</Button>
                  )) : <p className="text-sm text-muted">Formato não reconhecido. Use PDF, JPG, PNG, WEBP ou TXT.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10">
        {results ? (
          <section aria-label="Resultados da busca">
            <h2 className="mb-4 text-lg font-semibold">{results.length ? `${results.length} resultado(s) para “${query}”` : `Nada encontrado para “${query}”`}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map(t => <ToolCard key={t.id} tool={t} />)}
            </div>
          </section>
        ) : (
          <>
            {(favTools.length > 0 || recentTools.length > 0) && (
              <div className="grid gap-8 lg:grid-cols-2">
                {favTools.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Favoritas</h2>
                    <div className="grid gap-2 sm:grid-cols-2">{favTools.map(t => <ToolCard key={t.id} tool={t} compact />)}</div>
                  </section>
                )}
                {recentTools.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Usadas recentemente</h2>
                    <div className="grid gap-2 sm:grid-cols-2">{recentTools.map(t => <ToolCard key={t.id} tool={t} compact />)}</div>
                  </section>
                )}
              </div>
            )}

            <section>
              <h2 className="mb-4 text-lg font-semibold">Mais usadas</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {featured.map(t => <ToolCard key={t.id} tool={t} />)}
              </div>
            </section>

            {CATEGORIES.map(cat => {
              const tools = TOOLS.filter(t => t.category === cat.id);
              const available = tools.filter(t => t.status === "available");
              const planned = tools.filter(t => t.status !== "available");
              return (
                <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
                  <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-2">
                    <div>
                      <h2 id={`cat-${cat.id}`} className="text-lg font-semibold">{cat.name}</h2>
                      <p className="text-sm text-muted">{cat.description}</p>
                    </div>
                    <a href={`#${categoryPath(cat.id)}`} className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand hover:underline">
                      Ver categoria <ArrowRight className="size-4" aria-hidden />
                    </a>
                  </div>
                  {available.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{available.map(t => <ToolCard key={t.id} tool={t} />)}</div>
                  )}
                  {planned.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{planned.map(t => <ToolCard key={t.id} tool={t} compact />)}</div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
