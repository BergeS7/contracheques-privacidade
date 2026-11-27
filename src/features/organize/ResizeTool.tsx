import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { NumberInput, Segmented, Select } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { PAPER_SIZES } from "@/core/pdf/organize";
import { pdfInput } from "@/features/shared/usePageCounts";

type Paper = keyof typeof PAPER_SIZES;

export default function ResizeTool({ tool }: ToolComponentProps) {
  const [paper, setPaper] = useState<Paper>("A4");
  const [orientation, setOrientation] = useState<"auto" | "portrait" | "landscape">("auto");
  const [marginMm, setMarginMm] = useState(0);
  return (
    <ToolShell
      tool={tool}
      actionLabel="Alterar tamanho"
      validate={() => (!Number.isFinite(marginMm) || marginMm < 0 || marginMm > 50 ? "Margem: de 0 a 50 mm." : null)}
      options={() => (
        <>
          <Select label="Novo tamanho" value={paper} onChange={setPaper} options={Object.keys(PAPER_SIZES).map(k => ({ value: k as Paper, label: k }))} />
          <Segmented label="Orientação" value={orientation} onChange={setOrientation} options={[
            { value: "auto", label: "Manter" },
            { value: "portrait", label: "Retrato" },
            { value: "landscape", label: "Paisagem" }
          ]} />
          <NumberInput label="Margem (mm)" value={marginMm} min={0} max={50} onChange={setMarginMm} />
          <p className="text-xs text-muted">O conteúdo é ajustado proporcionalmente e centralizado. O texto continua selecionável.</p>
        </>
      )}
      run={async (fs, ctx) => {
        const bytes = await runJob("resizePages", [pdfInput(fs[0]), paper, orientation, (marginMm * 72) / 25.4], ctx);
        return [{ name: `${baseName(fs[0].name)} - ${paper}.pdf`, blob: pdfBlob(bytes) }];
      }}
    />
  );
}
