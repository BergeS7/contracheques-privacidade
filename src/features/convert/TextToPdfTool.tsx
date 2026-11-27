import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { NumberInput, Select } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { PAPER_SIZES } from "@/core/pdf/organize";

type Paper = keyof typeof PAPER_SIZES;

/** Decodifica TXT em UTF-8; se houver bytes inválidos, assume Windows-1252 (comum em arquivos antigos). */
function decodeText(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // remove BOM
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export default function TextToPdfTool({ tool }: ToolComponentProps) {
  const [paper, setPaper] = useState<Paper>("A4");
  const [font, setFont] = useState<"Helvetica" | "Times" | "Courier">("Helvetica");
  const [size, setSize] = useState(11);
  const [marginMm, setMarginMm] = useState(20);
  return (
    <ToolShell
      tool={tool}
      actionLabel="Gerar PDF"
      validate={() => (size < 6 || size > 36 ? "Tamanho da fonte: 6 a 36." : marginMm < 5 || marginMm > 60 ? "Margem: 5 a 60 mm." : null)}
      options={() => (
        <>
          <Select label="Papel" value={paper} onChange={setPaper} options={Object.keys(PAPER_SIZES).map(k => ({ value: k as Paper, label: k }))} />
          <Select label="Fonte" value={font} onChange={setFont} options={[
            { value: "Helvetica", label: "Sem serifa (Helvetica)" },
            { value: "Times", label: "Com serifa (Times)" },
            { value: "Courier", label: "Monoespaçada (Courier)" }
          ]} />
          <NumberInput label="Tamanho da fonte" value={size} min={6} max={36} onChange={setSize} />
          <NumberInput label="Margem (mm)" value={marginMm} min={5} max={60} onChange={setMarginMm} />
          <p className="text-xs text-muted">Acentos do português são suportados. Emojis e alfabetos não latinos viram “?”.</p>
        </>
      )}
      run={async (fs, ctx) => {
        const text = decodeText(fs[0].bytes);
        const bytes = await runJob("textToPdf", [text, { pageSize: paper, fontSize: size, margin: (marginMm * 72) / 25.4, font }], ctx);
        return [{ name: `${baseName(fs[0].name)}.pdf`, blob: pdfBlob(bytes) }];
      }}
    />
  );
}
