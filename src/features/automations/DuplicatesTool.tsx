import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell } from "@/features/shared/ToolShell";
import { Badge, Panel } from "@/components/ui";
import { extractAllText } from "@/features/shared/textExtraction";
import { toCsv } from "@/services/download";

async function sha256(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

interface Group { kind: "idêntico" | "mesmo texto"; files: string[] }

export default function DuplicatesTool({ tool }: ToolComponentProps) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  return (
    <ToolShell
      tool={tool}
      minFiles={2}
      modifiesDocument={false}
      actionLabel="Procurar duplicados"
      onReset={() => setGroups(null)}
      options={() => (
        <p className="text-sm text-muted">
          <strong className="text-ink">Idêntico</strong>: os bytes do arquivo são iguais (SHA-256).{" "}
          <strong className="text-ink">Mesmo texto</strong>: arquivos diferentes com o mesmo conteúdo textual (ex.: exportado duas vezes).
        </p>
      )}
      run={async (fs, ctx) => {
        const byHash = new Map<string, string[]>();
        for (const f of fs) {
          const h = await sha256(f.bytes);
          byHash.set(h, [...(byHash.get(h) ?? []), f.name]);
        }
        const identical = [...byHash.values()].filter(g => g.length > 1);
        const identicalSet = new Set(identical.flat());
        const texts = await extractAllText(fs, ctx);
        const byText = new Map<string, string[]>();
        for (const { file, pages } of texts) {
          const normalized = pages.map(p => p.text).join("\n").normalize("NFC").replace(/\s+/g, " ").trim();
          if (normalized.length < 20) continue;
          const h = await sha256(normalized);
          byText.set(h, [...(byText.get(h) ?? []), file.name]);
        }
        const sameText = [...byText.values()].filter(g => g.length > 1 && !g.every(n => identicalSet.has(n)));
        const result: Group[] = [
          ...identical.map(files => ({ kind: "idêntico" as const, files })),
          ...sameText.map(files => ({ kind: "mesmo texto" as const, files }))
        ];
        setGroups(result);
        return [{ name: "duplicados.csv", blob: toCsv([["Grupo", "Tipo", "Arquivo"], ...result.flatMap((g, i) => g.files.map(f => [i + 1, g.kind, f]))]), note: `${result.length} grupo(s)` }];
      }}
      resultExtra={groups && (
        <Panel title={groups.length ? `${groups.length} grupo(s) de duplicados` : "Nenhum duplicado encontrado"}>
          <ul className="space-y-3">
            {groups.map((g, i) => (
              <li key={i} className="rounded border border-line p-3">
                <Badge tone={g.kind === "idêntico" ? "brand" : "info"}>{g.kind}</Badge>
                <ul className="mt-2 list-disc pl-5 text-sm">{g.files.map((f, j) => <li key={j}>{f}</li>)}</ul>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    />
  );
}
