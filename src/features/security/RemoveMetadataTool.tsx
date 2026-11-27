import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { runJob } from "@/services/jobs";
import { pdfInput } from "@/features/shared/usePageCounts";

export default function RemoveMetadataTool({ tool }: ToolComponentProps) {
  return (
    <ToolShell
      tool={tool}
      actionLabel="Remover metadados"
      zipName={() => "sem metadados.zip"}
      options={() => (
        <div className="space-y-2 text-sm text-muted">
          <p>Serão apagados: título, autor, assunto, palavras-chave, aplicativo de origem, produtor, datas, fluxos XMP e dados privados de aplicativos (PieceInfo).</p>
          <p>O conteúdo visível das páginas não muda. Textos dentro das páginas não são metadados: para eles use Localizar dados pessoais.</p>
        </div>
      )}
      run={async (fs, ctx) => {
        const out = [];
        for (const [i, f] of fs.entries()) {
          ctx.onProgress(i / fs.length, f.name);
          const bytes = await runJob("removeMetadata", [pdfInput(f)], { signal: ctx.signal });
          out.push({ name: `${baseName(f.name)} - sem metadados.pdf`, blob: pdfBlob(bytes) });
        }
        return out;
      }}
    />
  );
}
