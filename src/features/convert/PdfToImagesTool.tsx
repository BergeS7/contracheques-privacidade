import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName } from "@/features/shared/ToolShell";
import { NumberInput, Segmented, TextInput } from "@/components/ui";
import { openPdf, renderPageToBlob } from "@/services/pdfjs";
import { parsePageList } from "@/core/pdf/pageRanges";
import { describeError, throwIfAborted } from "@/core/errors";
import { useToolFiles } from "@/features/shared/usePageCounts";
import { pageCountValidation, PageCountNote } from "@/features/organize/common";

const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
const EXT = { jpeg: "jpg", png: "png", webp: "webp" } as const;
type Format = keyof typeof MIME;

export default function PdfToImagesTool({ tool }: ToolComponentProps) {
  const format = (tool.preset?.format ?? "jpeg") as Format;
  const [dpi, setDpi] = useState<"96" | "150" | "300">("150");
  const [quality, setQuality] = useState(90);
  const [pages, setPages] = useState("todas");
  const tf = useToolFiles();
  return (
    <ToolShell
      tool={tool}
      actionLabel={`Converter para ${EXT[format].toUpperCase()}`}
      modifiesDocument={false}
      onFilesChange={tf.setFiles}
      zipName={f => `${baseName(f[0].name)} - ${EXT[format]}.zip`}
      validate={fs => {
        const pending = pageCountValidation(tf, fs[0]);
        if (pending) return pending;
        if (format !== "png" && (!Number.isFinite(quality) || quality < 10 || quality > 100)) return "Qualidade: de 10 a 100.";
        try { parsePageList(pages, tf.total(fs[0])!); return null; } catch (e) { return describeError(e); }
      }}
      options={fs => (
        <>
          <PageCountNote total={tf.total(fs[0])} />
          <Segmented label="Resolução" value={dpi} onChange={setDpi} options={[
            { value: "96", label: "Tela (96)" },
            { value: "150", label: "Média (150)" },
            { value: "300", label: "Impressão (300)" }
          ]} />
          {format !== "png" && <NumberInput label="Qualidade (%)" value={quality} min={10} max={100} onChange={setQuality} />}
          <TextInput label="Páginas" value={pages} onChange={e => setPages(e.target.value)} hint="Ex.: todas, 1-3, 5" />
        </>
      )}
      run={async (fs, ctx) => {
        const file = fs[0];
        const list = parsePageList(pages, tf.total(file)!);
        const { doc, close } = await openPdf(file.bytes);
        try {
          const width = String(Math.max(...list)).length;
          const out = [];
          for (const [i, p] of list.entries()) {
            throwIfAborted(ctx.signal);
            ctx.onProgress(i / list.length, `Página ${p} (${i + 1} de ${list.length})`);
            const blob = await renderPageToBlob(doc, p, Number(dpi), MIME[format], quality / 100);
            out.push({ name: `${baseName(file.name)} - página ${String(p).padStart(width, "0")}.${EXT[format]}`, blob });
          }
          ctx.onProgress(1);
          return out;
        } finally {
          await close();
        }
      }}
    />
  );
}
