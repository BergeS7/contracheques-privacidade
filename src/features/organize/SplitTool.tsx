import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { NumberInput, Segmented, TextInput } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { parseRangeGroups, formatPageList, range } from "@/core/pdf/pageRanges";
import { describeError } from "@/core/errors";
import { useToolFiles, pdfInput } from "@/features/shared/usePageCounts";
import { PageCountNote, pageCountValidation } from "./common";

type Mode = "ranges" | "every" | "each";

export default function SplitTool({ tool }: ToolComponentProps) {
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState("1-2; 3-");
  const [every, setEvery] = useState(1);
  const tf = useToolFiles();

  return (
    <ToolShell
      tool={tool}
      actionLabel="Dividir PDF"
      onFilesChange={tf.setFiles}
      zipName={f => `${baseName(f[0].name)} - partes.zip`}
      validate={fs => {
        const pending = pageCountValidation(tf, fs[0]);
        if (pending) return pending;
        const n = tf.total(fs[0])!;
        if (mode === "ranges") {
          try { parseRangeGroups(ranges, n); } catch (e) { return describeError(e); }
        }
        if (mode === "every" && (!Number.isInteger(every) || every < 1)) return "Informe um número inteiro de páginas.";
        return null;
      }}
      options={fs => (
        <>
          <PageCountNote total={tf.total(fs[0])} />
          <Segmented label="Como dividir" value={mode} onChange={setMode} options={[
            { value: "ranges", label: "Intervalos" },
            { value: "every", label: "A cada N" },
            { value: "each", label: "Cada página" }
          ]} />
          {mode === "ranges" && (
            <TextInput label="Partes" value={ranges} onChange={e => setRanges(e.target.value)}
              hint="Separe as partes com ponto e vírgula. Ex.: 1-3; 4-6; 7-" />
          )}
          {mode === "every" && <NumberInput label="Páginas por parte" value={every} min={1} onChange={setEvery} />}
        </>
      )}
      run={async (fs, ctx) => {
        const file = fs[0];
        const n = tf.total(file)!;
        const groups = mode === "ranges" ? parseRangeGroups(ranges, n)
          : mode === "each" ? range(1, n).map(p => [p])
          : range(0, Math.ceil(n / every) - 1).map(i => range(i * every + 1, Math.min(n, (i + 1) * every)));
        const parts = await runJob("splitByGroups", [pdfInput(file), groups], ctx);
        const stem = baseName(file.name);
        const width = String(parts.length).length;
        return parts.map((bytes, i) => ({
          name: `${stem} - parte ${String(i + 1).padStart(width, "0")}.pdf`,
          blob: pdfBlob(bytes),
          note: `páginas ${formatPageList(groups[i])}`
        }));
      }}
    />
  );
}
