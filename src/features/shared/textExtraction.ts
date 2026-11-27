import { openTextDoc } from "@/services/pdfjs";
import { extractTextPages } from "@/core/conversion/text";
import type { LoadedFile } from "@/components/upload/loadedFile";
import type { RunContext } from "./ToolShell";

/** Texto de cada página de cada arquivo, com progresso e cancelamento. */
export async function extractAllText(files: LoadedFile[], ctx: RunContext) {
  const result: { file: LoadedFile; pages: { page: number; text: string }[]; error?: string }[] = [];
  for (const [i, file] of files.entries()) {
    try {
      const doc = await openTextDoc(file.bytes);
      try {
        const pages = await extractTextPages(doc, {
          signal: ctx.signal,
          onProgress: (p, m) => ctx.onProgress((i + p) / files.length, `${file.name}: ${m ?? ""}`)
        });
        result.push({ file, pages: pages.map(p => ({ page: p.page, text: p.lines.map(l => l.text).join("\n") })) });
      } finally {
        await doc.destroy?.();
      }
    } catch (e) {
      if (ctx.signal.aborted) throw e;
      result.push({ file, pages: [], error: (e as Error).message });
    }
  }
  return result;
}
