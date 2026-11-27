import { useState } from "react";
import { RotateCw, RotateCcw, RefreshCw } from "lucide-react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { Segmented, TextInput } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { parsePageList } from "@/core/pdf/pageRanges";
import { describeError } from "@/core/errors";
import { useToolFiles, pdfInput } from "@/features/shared/usePageCounts";
import { PageCountNote, pageCountValidation } from "./common";

export default function RotateTool({ tool }: ToolComponentProps) {
  const [angle, setAngle] = useState<"90" | "180" | "270">("90");
  const [scope, setScope] = useState<"all" | "some">("all");
  const [pages, setPages] = useState("1");
  const tf = useToolFiles();
  return (
    <ToolShell
      tool={tool}
      actionLabel="Girar páginas"
      onFilesChange={tf.setFiles}
      validate={fs => {
        const pending = pageCountValidation(tf, fs[0]);
        if (pending) return pending;
        if (scope === "all") return null;
        try { parsePageList(pages, tf.total(fs[0])!); return null; } catch (e) { return describeError(e); }
      }}
      options={fs => (
        <>
          <PageCountNote total={tf.total(fs[0])} />
          <Segmented label="Rotação" value={angle} onChange={setAngle} options={[
            { value: "90", label: "90°", icon: RotateCw },
            { value: "180", label: "180°", icon: RefreshCw },
            { value: "270", label: "90° anti-horário", icon: RotateCcw }
          ]} />
          <Segmented label="Páginas" value={scope} onChange={setScope} options={[
            { value: "all", label: "Todas" },
            { value: "some", label: "Escolher" }
          ]} />
          {scope === "some" && <TextInput label="Quais páginas" value={pages} onChange={e => setPages(e.target.value)} hint="Ex.: 1, 3-4" />}
          <p className="text-xs text-muted">A rotação é somada à atual de cada página. Para girar páginas individualmente, use Organizar páginas.</p>
        </>
      )}
      run={async (fs, ctx) => {
        const target = scope === "all" ? "all" as const : parsePageList(pages, tf.total(fs[0])!);
        const bytes = await runJob("rotatePages", [pdfInput(fs[0]), target, Number(angle)], ctx);
        return [{ name: `${baseName(fs[0].name)} - girado.pdf`, blob: pdfBlob(bytes) }];
      }}
    />
  );
}
