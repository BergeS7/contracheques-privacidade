// PDF.js no Node (build "legacy") para ler o texto dos PDFs gerados nos testes.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { OpenTextDoc } from "../../src/core/payroll";

const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;

export const openTextDoc: OpenTextDoc = async bytes => {
  const task = pdfjs.getDocument({ data: bytes, verbosity: 0 });
  const doc = await task.promise;
  return Object.assign(doc, { destroy: () => task.destroy() }) as unknown as Awaited<ReturnType<OpenTextDoc>>;
};

/** Texto de cada página, na ordem. */
export async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const task = pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 });
  const doc = await task.promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out.push(content.items.map(it => ("str" in it ? it.str : "")).join(" "));
  }
  await task.destroy();
  return out;
}

export { pdfjs };
