import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell } from "@/features/shared/ToolShell";
import { Panel, TextInput } from "@/components/ui";
import { searchText } from "@/core/recognition/patterns";
import { extractAllText } from "@/features/shared/textExtraction";
import { toCsv } from "@/services/download";

interface Hit { file: string; page: number; snippet: string }

export default function SearchDocsTool({ tool }: ToolComponentProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ q: string; list: Hit[]; files: number; withHits: number } | null>(null);
  return (
    <ToolShell
      tool={tool}
      modifiesDocument={false}
      actionLabel="Buscar"
      onReset={() => setHits(null)}
      validate={() => (query.trim().length < 2 ? "Digite pelo menos 2 caracteres." : null)}
      options={() => (
        <>
          <TextInput label="Procurar por" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex.: férias, 13º salário, nome" />
          <p className="text-xs text-muted">Sem diferenciar maiúsculas e acentos. Usa o texto dos PDFs (digitalizados precisam de OCR).</p>
        </>
      )}
      run={async (fs, ctx) => {
        const texts = await extractAllText(fs, ctx);
        const list: Hit[] = [];
        for (const { file, pages } of texts) for (const p of pages) for (const h of searchText(p.text, query)) list.push({ file: file.name, page: p.page, snippet: h.snippet });
        const withHits = new Set(list.map(h => h.file)).size;
        setHits({ q: query, list, files: fs.length, withHits });
        return [{ name: "resultado da busca.csv", blob: toCsv([["Arquivo", "Página", "Trecho"], ...list.map(h => [h.file, h.page, h.snippet])]), note: `${list.length} ocorrência(s)` }];
      }}
      resultExtra={hits && (
        <Panel title={`“${hits.q}”: ${hits.list.length} ocorrência(s) em ${hits.withHits} de ${hits.files} arquivo(s)`}>
          {hits.list.length === 0 ? <p className="text-sm text-muted">Nada encontrado.</p> : (
            <ul className="max-h-[520px] divide-y divide-line overflow-auto">
              {hits.list.slice(0, 1000).map((h, i) => (
                <li key={i} className="py-2 text-sm">
                  <p className="text-xs text-muted">{h.file} · página {h.page}</p>
                  <p className="text-ink-2">{h.snippet}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    />
  );
}
