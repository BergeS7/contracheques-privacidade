import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { ColorInput, NumberInput, Segmented, TextInput } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { pdfInput } from "@/features/shared/usePageCounts";

export default function HeaderFooterTool({ tool }: ToolComponentProps) {
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("{arquivo} · {data} · {n}/{total}");
  const [align, setAlign] = useState<"left" | "center" | "right">("center");
  const [size, setSize] = useState(9);
  const [marginMm, setMarginMm] = useState(8);
  const [color, setColor] = useState("#555555");
  return (
    <ToolShell
      tool={tool}
      actionLabel="Aplicar"
      validate={() => (!header.trim() && !footer.trim() ? "Preencha o cabeçalho, o rodapé ou ambos." : null)}
      options={() => (
        <>
          <TextInput label="Cabeçalho" value={header} maxLength={200} onChange={e => setHeader(e.target.value)} />
          <TextInput label="Rodapé" value={footer} maxLength={200} onChange={e => setFooter(e.target.value)} hint="Variáveis: {n}, {total}, {arquivo}, {data}" />
          <Segmented label="Alinhamento" value={align} onChange={setAlign} options={[
            { value: "left", label: "Esquerda" },
            { value: "center", label: "Centro" },
            { value: "right", label: "Direita" }
          ]} />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Tamanho" value={size} min={6} max={36} onChange={setSize} />
            <NumberInput label="Margem (mm)" value={marginMm} min={0} max={60} onChange={setMarginMm} />
          </div>
          <ColorInput label="Cor" value={color} onChange={setColor} />
        </>
      )}
      run={async (fs, ctx) => {
        const bytes = await runJob("headerFooter", [pdfInput(fs[0]), { header, footer, align, size, margin: (marginMm * 72) / 25.4, color }], ctx);
        return [{ name: `${baseName(fs[0].name)} - com cabeçalho.pdf`, blob: pdfBlob(bytes) }];
      }}
    />
  );
}
