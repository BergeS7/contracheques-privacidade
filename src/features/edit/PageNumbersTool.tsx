import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { ColorInput, NumberInput, Select, TextInput } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { parsePageList } from "@/core/pdf/pageRanges";
import { describeError } from "@/core/errors";
import type { BoxPosition } from "@/core/pdf/stamp";
import { useToolFiles, pdfInput } from "@/features/shared/usePageCounts";
import { pageCountValidation } from "@/features/organize/common";

export const POSITIONS: { value: BoxPosition; label: string }[] = [
  { value: "bottom-center", label: "Rodapé, centro" },
  { value: "bottom-right", label: "Rodapé, direita" },
  { value: "bottom-left", label: "Rodapé, esquerda" },
  { value: "top-center", label: "Topo, centro" },
  { value: "top-right", label: "Topo, direita" },
  { value: "top-left", label: "Topo, esquerda" }
];

export default function PageNumbersTool({ tool }: ToolComponentProps) {
  const [position, setPosition] = useState<BoxPosition>("bottom-center");
  const [format, setFormat] = useState("{n} de {total}");
  const [startAt, setStartAt] = useState(1);
  const [size, setSize] = useState(10);
  const [marginMm, setMarginMm] = useState(10);
  const [color, setColor] = useState("#333333");
  const [pages, setPages] = useState("todas");
  const tf = useToolFiles();
  return (
    <ToolShell
      tool={tool}
      actionLabel="Numerar páginas"
      onFilesChange={tf.setFiles}
      validate={fs => {
        if (!format.includes("{n}")) return "O formato precisa conter {n}.";
        if (!Number.isInteger(startAt) || startAt < 0) return "Número inicial inválido.";
        const pending = pageCountValidation(tf, fs[0]);
        if (pending) return pending;
        try { parsePageList(pages, tf.total(fs[0])!); return null; } catch (e) { return describeError(e); }
      }}
      options={() => (
        <>
          <Select label="Posição" value={position} onChange={setPosition} options={POSITIONS} />
          <TextInput label="Formato" value={format} onChange={e => setFormat(e.target.value)} hint="{n} = página, {total} = total. Ex.: Página {n} de {total}" />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Começar em" value={startAt} min={0} onChange={setStartAt} />
            <NumberInput label="Tamanho" value={size} min={6} max={48} onChange={setSize} />
            <NumberInput label="Margem (mm)" value={marginMm} min={0} max={60} onChange={setMarginMm} />
            <ColorInput label="Cor" value={color} onChange={setColor} />
          </div>
          <TextInput label="Páginas numeradas" value={pages} onChange={e => setPages(e.target.value)} hint="As demais não recebem número, mas contam na sequência." />
        </>
      )}
      run={async (fs, ctx) => {
        const list = pages.trim().toLowerCase() === "todas" ? undefined : parsePageList(pages, tf.total(fs[0])!);
        const bytes = await runJob("pageNumbers", [pdfInput(fs[0]), { position, format, startAt, size, margin: (marginMm * 72) / 25.4, color, pages: list }], ctx);
        return [{ name: `${baseName(fs[0].name)} - numerado.pdf`, blob: pdfBlob(bytes) }];
      }}
    />
  );
}
