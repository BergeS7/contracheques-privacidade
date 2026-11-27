import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, pdfBlob } from "@/features/shared/ToolShell";
import { runJob } from "@/services/jobs";
import { pdfInput } from "@/features/shared/usePageCounts";

export default function MergeTool({ tool }: ToolComponentProps) {
  return (
    <ToolShell
      tool={tool}
      minFiles={2}
      sortable
      actionLabel="Juntar PDFs"
      run={async (files, ctx) => {
        const bytes = await runJob("merge", [files.map(pdfInput)], ctx);
        return [{ name: "juntado.pdf", blob: pdfBlob(bytes), note: `${files.length} documentos` }];
      }}
    />
  );
}
