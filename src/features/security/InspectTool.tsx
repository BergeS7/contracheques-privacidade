import { useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName } from "@/features/shared/ToolShell";
import { Badge, Panel } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { formatBytes } from "@/core/validation/file";
import type { PdfInspection } from "@/core/pdf/metadata";
import { pdfInput } from "@/features/shared/usePageCounts";
import { toCsv } from "@/services/download";

const INFO_LABEL: Record<string, string> = {
  title: "Título", author: "Autor", subject: "Assunto", keywords: "Palavras-chave",
  creator: "Aplicativo de origem", producer: "Produtor do PDF", creationDate: "Criado em", modificationDate: "Modificado em"
};

export default function InspectTool({ tool }: ToolComponentProps) {
  const [results, setResults] = useState<{ name: string; r: PdfInspection }[]>([]);
  return (
    <ToolShell
      tool={tool}
      allowEncrypted
      modifiesDocument={false}
      actionLabel="Analisar"
      onReset={() => setResults([])}
      run={async (fs, ctx) => {
        const out: { name: string; r: PdfInspection }[] = [];
        for (const [i, f] of fs.entries()) {
          ctx.onProgress(i / fs.length, `Analisando ${f.name}`);
          out.push({ name: f.name, r: await runJob("inspect", [pdfInput(f)], { signal: ctx.signal }) });
        }
        setResults(out);
        const rows: unknown[][] = [["Arquivo", "Íntegro", "Páginas", "Versão", "Tamanho", "Criptografado", "Assinaturas", "JavaScript", "Formulário", "Anexos", "Atualizações incrementais", "Autor", "Produtor", "Problemas"]];
        for (const { name, r } of out) {
          rows.push([name, r.ok ? "sim" : "não", r.pageCount ?? "", r.pdfVersion ?? "", r.fileSize, r.encrypted ? "sim" : "não", r.signatureCount, r.hasJavaScript ? "sim" : "não", r.hasForms ? "sim" : "não", r.hasEmbeddedFiles ? "sim" : "não", r.incrementalUpdates, r.info.author ?? "", r.info.producer ?? "", r.problems.join(" | ")]);
        }
        return [{ name: fs.length === 1 ? `${baseName(fs[0].name)} - diagnóstico.csv` : "diagnóstico.csv", blob: toCsv(rows), note: "relatório para planilha" }];
      }}
      resultExtra={results.length > 0 && (
        <div className="space-y-4">
          {results.map(({ name, r }) => <Report key={name} name={name} r={r} />)}
        </div>
      )}
    />
  );
}

function Report({ name, r }: { name: string; r: PdfInspection }) {
  const yesNo = (v: boolean, warnIfTrue = false) => <Badge tone={v ? (warnIfTrue ? "warn" : "info") : "neutral"}>{v ? "Sim" : "Não"}</Badge>;
  const infoEntries = Object.entries(r.info).filter(([, v]) => v);
  return (
    <Panel title={<span className="flex items-center gap-2">{r.ok && !r.problems.length ? <CheckCircle2 className="size-4 text-ok" /> : <AlertTriangle className="size-4 text-warn" />}{name}</span>}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Item k="Estrutura">{r.ok ? <Badge tone="ok">Íntegra</Badge> : <Badge tone="err">Com problemas</Badge>}</Item>
        <Item k="Páginas">{r.pageCount ?? "—"}</Item>
        <Item k="Versão PDF">{r.pdfVersion ?? "—"}</Item>
        <Item k="Tamanho">{formatBytes(r.fileSize)}</Item>
        <Item k="Criptografado">{yesNo(r.encrypted, true)}</Item>
        <Item k="Assinatura digital">{r.hasDigitalSignatures ? <Badge tone="info">{r.signatureCount || 1} encontrada(s)</Badge> : yesNo(false)}</Item>
        <Item k="JavaScript embutido">{yesNo(r.hasJavaScript, true)}</Item>
        <Item k="Formulário">{yesNo(r.hasForms)}</Item>
        <Item k="Arquivos anexados">{yesNo(r.hasEmbeddedFiles, true)}</Item>
        <Item k="Metadados XMP">{yesNo(r.hasXmpMetadata)}</Item>
        <Item k="Edições incrementais">{r.incrementalUpdates}</Item>
        <Item k="Tamanhos de página">{r.pageSizes.map(s => `${s.width}×${s.height} pt (${s.count})`).join(", ") || "—"}</Item>
      </dl>
      {infoEntries.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="mb-2 text-[13px] font-semibold text-ink-2">Metadados</h3>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {infoEntries.map(([k, v]) => <Item key={k} k={INFO_LABEL[k] ?? k}><span className="break-words">{v}</span></Item>)}
          </dl>
        </div>
      )}
      {r.hasDigitalSignatures && (
        <p className="mt-3 text-xs text-muted">A presença de assinatura foi detectada pela estrutura do arquivo. A validade criptográfica do certificado não é verificada aqui. Qualquer modificação invalida a assinatura.</p>
      )}
      {r.problems.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-warn">{r.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
      )}
    </Panel>
  );
}

function Item({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
