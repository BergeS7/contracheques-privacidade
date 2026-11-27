import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName } from "@/features/shared/ToolShell";
import { openTextDoc } from "@/services/pdfjs";
import { extractTextPages, pagesToMarkdown, pagesToTxt } from "@/core/conversion/text";

export default function PdfToTextTool({ tool }: ToolComponentProps) {
  const md = tool.preset?.format === "md";
  return (
    <ToolShell
      tool={tool}
      modifiesDocument={false}
      actionLabel={md ? "Converter para Markdown" : "Extrair texto"}
      zipName={() => (md ? "markdown.zip" : "textos.zip")}
      run={async (fs, ctx) => {
        const out = [];
        for (const [i, f] of fs.entries()) {
          const doc = await openTextDoc(f.bytes);
          try {
            const pages = await extractTextPages(doc, {
              signal: ctx.signal,
              onProgress: (p, m) => ctx.onProgress((i + p) / fs.length, `${f.name}: ${m ?? ""}`)
            });
            const chars = pages.reduce((n, p) => n + p.lines.reduce((s, l) => s + l.text.length, 0), 0);
            const content = md ? pagesToMarkdown(pages) : pagesToTxt(pages);
            out.push({
              name: `${baseName(f.name)}.${md ? "md" : "txt"}`,
              blob: new Blob([content], { type: md ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8" }),
              note: chars === 0 ? "sem texto: o PDF parece digitalizado (precisa de OCR)" : `${pages.length} página(s)`
            });
          } finally {
            await doc.destroy?.();
          }
        }
        return out;
      }}
    />
  );
}
