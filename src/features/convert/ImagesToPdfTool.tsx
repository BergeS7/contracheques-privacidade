import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { NumberInput, Segmented, Select } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { normalizeImage } from "@/services/imageDecode";
import { PAPER_SIZES } from "@/core/pdf/organize";
import { throwIfAborted } from "@/core/errors";

type PageSize = "fit" | keyof typeof PAPER_SIZES;

export default function ImagesToPdfTool({ tool }: ToolComponentProps) {
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [orientation, setOrientation] = useState<"auto" | "portrait" | "landscape">("auto");
  const [marginMm, setMarginMm] = useState(10);
  const [output, setOutput] = useState<"single" | "each">("single");
  return (
    <ToolShell
      tool={tool}
      sortable
      actionLabel="Converter para PDF"
      zipName={() => "imagens em PDF.zip"}
      validate={() => (!Number.isFinite(marginMm) || marginMm < 0 || marginMm > 50 ? "Margem: de 0 a 50 mm." : null)}
      options={fs => (
        <>
          <Select label="Tamanho da página" value={pageSize} onChange={setPageSize} options={[
            { value: "fit", label: "Igual à imagem" },
            ...Object.keys(PAPER_SIZES).map(k => ({ value: k as PageSize, label: k }))
          ]} />
          {pageSize !== "fit" && (
            <Segmented label="Orientação" value={orientation} onChange={setOrientation} options={[
              { value: "auto", label: "Automática" },
              { value: "portrait", label: "Retrato" },
              { value: "landscape", label: "Paisagem" }
            ]} />
          )}
          <NumberInput label="Margem (mm)" value={marginMm} min={0} max={50} onChange={setMarginMm} />
          {fs.length > 1 && (
            <Segmented label="Resultado" value={output} onChange={setOutput} options={[
              { value: "single", label: "Um PDF" },
              { value: "each", label: "Um por imagem" }
            ]} />
          )}
          <p className="text-xs text-muted">JPG e PNG entram sem recompressão. WEBP é convertido para PNG antes (sem perda).</p>
        </>
      )}
      run={async (fs, ctx) => {
        const images = [];
        for (const [i, f] of fs.entries()) {
          throwIfAborted(ctx.signal);
          ctx.onProgress((i / fs.length) * 0.3, `Preparando ${f.name}`);
          images.push({ name: f.name, bytes: await normalizeImage(f.name, f.bytes) });
        }
        const options = { pageSize, orientation, margin: (marginMm * 72) / 25.4 };
        const report = (base: number, span: number) => (p: number, m?: string) => ctx.onProgress(base + p * span, m);
        if (output === "single" || fs.length === 1) {
          const bytes = await runJob("imagesToPdf", [images, options], { signal: ctx.signal, onProgress: report(0.3, 0.7) });
          return [{ name: fs.length === 1 ? `${baseName(fs[0].name)}.pdf` : "imagens.pdf", blob: pdfBlob(bytes), note: `${fs.length} página(s)` }];
        }
        const out = [];
        for (const [i, img] of images.entries()) {
          const bytes = await runJob("imagesToPdf", [[img], options], { signal: ctx.signal });
          out.push({ name: `${baseName(img.name)}.pdf`, blob: pdfBlob(bytes) });
          ctx.onProgress(0.3 + ((i + 1) / images.length) * 0.7, `${i + 1} de ${images.length}`);
        }
        return out;
      }}
    />
  );
}
