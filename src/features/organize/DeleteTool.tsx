import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { TextInput } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { parsePageList } from "@/core/pdf/pageRanges";
import { describeError } from "@/core/errors";
import { useToolFiles, pdfInput } from "@/features/shared/usePageCounts";
import { PageCountNote, pageCountValidation } from "./common";

export default function DeleteTool({ tool }: ToolComponentProps) {
  const [pages, setPages] = useState("");
  const tf = useToolFiles();
  return (
    <ToolShell
      tool={tool}
      actionLabel="Excluir páginas"
      onFilesChange={tf.setFiles}
      validate={fs => {
        const pending = pageCountValidation(tf, fs[0]);
        if (pending) return pending;
        if (!pages.trim()) return "Informe as páginas a excluir.";
        try {
          const list = new Set(parsePageList(pages, tf.total(fs[0])!));
          if (list.size >= tf.total(fs[0])!) return "Não é possível excluir todas as páginas.";
          return null;
        } catch (e) { return describeError(e); }
      }}
      options={fs => (
        <>
          <PageCountNote total={tf.total(fs[0])} />
          <TextInput label="Páginas a excluir" placeholder="Ex.: 2, 5-7" value={pages} onChange={e => setPages(e.target.value)} />
        </>
      )}
      run={async (fs, ctx) => {
        const list = parsePageList(pages, tf.total(fs[0])!);
        const bytes = await runJob("deletePages", [pdfInput(fs[0]), list], ctx);
        return [{ name: `${baseName(fs[0].name)} - editado.pdf`, blob: pdfBlob(bytes), note: `${new Set(list).size} página(s) removida(s)` }];
      }}
    />
  );
}
