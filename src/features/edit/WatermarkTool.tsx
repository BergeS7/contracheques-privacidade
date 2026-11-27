import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { Checkbox, ColorInput, NumberInput, Segmented, TextInput } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { parsePageList } from "@/core/pdf/pageRanges";
import { describeError } from "@/core/errors";
import { useToolFiles, pdfInput } from "@/features/shared/usePageCounts";
import { pageCountValidation } from "@/features/organize/common";

export default function WatermarkTool({ tool }: ToolComponentProps) {
  const [text, setText] = useState("CONFIDENCIAL");
  const [size, setSize] = useState(56);
  const [color, setColor] = useState("#d62828");
  const [opacity, setOpacity] = useState(20);
  const [rotation, setRotation] = useState(45);
  const [layout, setLayout] = useState<"center" | "tile">("center");
  const [bold, setBold] = useState(true);
  const [pages, setPages] = useState("todas");
  const tf = useToolFiles();
  return (
    <ToolShell
      tool={tool}
      actionLabel="Aplicar marca-d'água"
      onFilesChange={tf.setFiles}
      validate={fs => {
        if (!text.trim()) return "Digite o texto da marca-d'água.";
        if (size < 6 || size > 300) return "Tamanho: 6 a 300.";
        if (opacity < 1 || opacity > 100) return "Opacidade: 1 a 100%.";
        const pending = pageCountValidation(tf, fs[0]);
        if (pending) return pending;
        try { parsePageList(pages, tf.total(fs[0])!); return null; } catch (e) { return describeError(e); }
      }}
      options={() => (
        <>
          <TextInput label="Texto" value={text} maxLength={120} onChange={e => setText(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Tamanho" value={size} min={6} max={300} onChange={setSize} />
            <NumberInput label="Opacidade (%)" value={opacity} min={1} max={100} onChange={setOpacity} />
            <NumberInput label="Inclinação (°)" value={rotation} min={-180} max={180} onChange={setRotation} />
            <ColorInput label="Cor" value={color} onChange={setColor} />
          </div>
          <Segmented label="Disposição" value={layout} onChange={setLayout} options={[
            { value: "center", label: "Centralizada" },
            { value: "tile", label: "Mosaico" }
          ]} />
          <Checkbox label="Negrito" checked={bold} onChange={setBold} />
          <TextInput label="Páginas" value={pages} onChange={e => setPages(e.target.value)} hint="Ex.: todas, 1-3" />
          <p className="text-xs text-muted">A marca é um elemento novo por cima do conteúdo. Ela não impede cópia do texto original.</p>
        </>
      )}
      run={async (fs, ctx) => {
        const list = pages.trim().toLowerCase() === "todas" ? undefined : parsePageList(pages, tf.total(fs[0])!);
        const bytes = await runJob("watermark", [pdfInput(fs[0]), { text, size, color, opacity: opacity / 100, rotation, layout, bold, pages: list }], ctx);
        return [{ name: `${baseName(fs[0].name)} - marca-d'água.pdf`, blob: pdfBlob(bytes) }];
      }}
    />
  );
}
