import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { Segmented, TextInput } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { parsePageList, formatPageList } from "@/core/pdf/pageRanges";
import { describeError } from "@/core/errors";
import { useToolFiles, pdfInput } from "@/features/shared/usePageCounts";
import { PageCountNote, pageCountValidation } from "./common";

export default function ExtractTool({ tool }: ToolComponentProps) {
  const [pages, setPages] = useState("1");
  const [mode, setMode] = useState<"single" | "each">("single");
  const tf = useToolFiles();

  return (
    <ToolShell
      tool={tool}
      actionLabel="Extrair páginas"
      onFilesChange={tf.setFiles}
      zipName={f => `${baseName(f[0].name)} - páginas.zip`}
      validate={fs => {
        const pending = pageCountValidation(tf, fs[0]);
        if (pending) return pending;
        try { parsePageList(pages, tf.total(fs[0])!); return null; } catch (e) { return describeError(e); }
      }}
      options={fs => (
        <>
          <PageCountNote total={tf.total(fs[0])} />
          <TextInput label="Páginas" value={pages} onChange={e => setPages(e.target.value)} hint="Ex.: 1-3, 5, 8-. A ordem digitada é respeitada." />
          <Segmented label="Resultado" value={mode} onChange={setMode} options={[
            { value: "single", label: "Um PDF" },
            { value: "each", label: "Um por página" }
          ]} />
        </>
      )}
      run={async (fs, ctx) => {
        const file = fs[0];
        const list = parsePageList(pages, tf.total(file)!);
        const stem = baseName(file.name);
        if (mode === "single") {
          const bytes = await runJob("selectPages", [pdfInput(file), list], ctx);
          return [{ name: `${stem} - páginas ${formatPageList(list)}.pdf`, blob: pdfBlob(bytes) }];
        }
        const parts = await runJob("splitByGroups", [pdfInput(file), list.map(p => [p])], ctx);
        return parts.map((bytes, i) => ({ name: `${stem} - página ${list[i]}.pdf`, blob: pdfBlob(bytes) }));
      }}
    />
  );
}
