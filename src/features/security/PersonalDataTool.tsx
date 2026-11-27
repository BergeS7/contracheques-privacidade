import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell } from "@/features/shared/ToolShell";
import { Badge, Button, Checkbox, Panel } from "@/components/ui";
import { findPatterns, maskValue, KIND_LABEL, type FindingKind } from "@/core/recognition/patterns";
import { extractAllText } from "@/features/shared/textExtraction";
import { toCsv } from "@/services/download";

interface Row { file: string; page: number; kind: FindingKind; value: string; valid: boolean }

const ALL_KINDS: FindingKind[] = ["cpf", "cnpj", "email", "telefone", "cep", "data", "valor"];

export default function PersonalDataTool({ tool }: ToolComponentProps) {
  const [kinds, setKinds] = useState<FindingKind[]>(["cpf", "cnpj", "email", "telefone"]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [noText, setNoText] = useState<string[]>([]);
  const [reveal, setReveal] = useState(false);

  const summary = useMemo(() => {
    const m = new Map<FindingKind, number>();
    for (const r of rows ?? []) m.set(r.kind, (m.get(r.kind) || 0) + 1);
    return m;
  }, [rows]);

  return (
    <ToolShell
      tool={tool}
      modifiesDocument={false}
      actionLabel="Procurar dados"
      onReset={() => setRows(null)}
      validate={() => (kinds.length ? null : "Escolha pelo menos um tipo de dado.")}
      options={() => (
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-ink-2">Procurar</p>
          {ALL_KINDS.map(k => (
            <Checkbox key={k} label={KIND_LABEL[k]} checked={kinds.includes(k)}
              onChange={v => setKinds(v ? [...kinds, k] : kinds.filter(x => x !== k))} />
          ))}
          <p className="pt-2 text-xs text-muted">CPF e CNPJ são conferidos pelos dígitos verificadores. A análise usa o texto do PDF: documentos digitalizados precisam de OCR.</p>
        </div>
      )}
      run={async (fs, ctx) => {
        const texts = await extractAllText(fs, ctx);
        const found: Row[] = [];
        const empty: string[] = [];
        for (const { file, pages, error } of texts) {
          if (error || pages.every(p => !p.text.trim())) { empty.push(file.name); continue; }
          for (const p of pages) for (const f of findPatterns(p.text, kinds)) found.push({ file: file.name, page: p.page, kind: f.kind, value: f.value, valid: f.valid });
        }
        setRows(found);
        setNoText(empty);
        const csv = toCsv([["Arquivo", "Página", "Tipo", "Valor", "Dígito verificador"], ...found.map(r => [r.file, r.page, KIND_LABEL[r.kind], r.value, r.kind === "cpf" || r.kind === "cnpj" ? (r.valid ? "válido" : "inválido") : ""])]);
        const json = new Blob([JSON.stringify(found, null, 2)], { type: "application/json" });
        return [
          { name: "dados-encontrados.csv", blob: csv, note: `${found.length} ocorrência(s) · contém dados pessoais` },
          { name: "dados-encontrados.json", blob: json, note: "mesmo conteúdo em JSON" }
        ];
      }}
      resultExtra={rows && (
        <Panel
          title={`${rows.length} ocorrência(s)`}
          actions={<Button size="sm" variant="ghost" icon={reveal ? EyeOff : Eye} onClick={() => setReveal(!reveal)}>{reveal ? "Ocultar valores" : "Mostrar valores"}</Button>}
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {[...summary.entries()].map(([k, n]) => <Badge key={k} tone="brand">{KIND_LABEL[k]}: {n}</Badge>)}
          </div>
          {noText.length > 0 && <p className="mb-3 text-sm text-warn">Sem texto (provavelmente digitalizados): {noText.join(", ")}</p>}
          {rows.length > 0 ? (
            <div className="max-h-[480px] overflow-auto rounded border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
                  <tr><th className="px-3 py-2">Arquivo</th><th className="px-3 py-2">Pág.</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Valor</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.slice(0, 2000).map((r, i) => (
                    <tr key={i}>
                      <td className="max-w-48 truncate px-3 py-1.5" title={r.file}>{r.file}</td>
                      <td className="px-3 py-1.5 tabular-nums">{r.page}</td>
                      <td className="px-3 py-1.5">{KIND_LABEL[r.kind]}{(r.kind === "cpf" || r.kind === "cnpj") && !r.valid && <span className="ml-1 text-xs text-warn">(DV inválido)</span>}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{reveal ? r.value : maskValue(r.kind, r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">Nenhum dado dos tipos escolhidos foi encontrado.</p>}
          {rows.length > 2000 && <p className="mt-2 text-xs text-muted">Mostrando 2.000 de {rows.length}. O relatório completo está no CSV.</p>}
        </Panel>
      )}
    />
  );
}
