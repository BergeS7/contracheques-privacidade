/**
 * PDF.js no navegador: worker, CMaps, fontes padrão e WASM empacotados localmente.
 * Scripts embutidos em PDFs não são executados (sem scripting, sem XFA).
 */
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OpenTextDoc } from "@/core/payroll";
import { TudoPdfError } from "@/core/errors";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const assetBase = new URL("./pdfjs/", document.baseURI).href;

export interface OpenedPdf {
  doc: PDFDocumentProxy;
  close: () => Promise<void>;
}

export async function openPdf(bytes: Uint8Array, password?: string): Promise<OpenedPdf> {
  // Cópia: o PDF.js transfere o buffer para o worker dele.
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    password,
    cMapUrl: `${assetBase}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    wasmUrl: `${assetBase}wasm/`,
    iccUrl: `${assetBase}iccs/`,
    enableXfa: false,
    verbosity: 0
  });
  try {
    const doc = await task.promise;
    return { doc, close: () => task.destroy() };
  } catch (error) {
    await task.destroy().catch(() => undefined);
    const name = (error as { name?: string })?.name;
    if (name === "PasswordException") throw new TudoPdfError("ENCRYPTED", "O PDF está protegido por senha.");
    if (name === "InvalidPDFException") throw new TudoPdfError("CORRUPTED", "O arquivo está corrompido ou não é um PDF válido.");
    throw error;
  }
}

export const openTextDoc: OpenTextDoc = async bytes => {
  const { doc, close } = await openPdf(bytes);
  return Object.assign(doc, { destroy: close }) as unknown as Awaited<ReturnType<OpenTextDoc>>;
};

/** Renderiza uma página em canvas. `width` é a largura desejada em pixels CSS. */
export async function renderPage(doc: PDFDocumentProxy, pageNumber: number, width: number, extraRotation = 0): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1, rotation: (page.rotate + extraRotation) % 360 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (width / base.width) * dpr, rotation: (page.rotate + extraRotation) % 360 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return canvas;
}

/** Renderiza em escala de impressão (DPI) e devolve a imagem no formato pedido. */
export async function renderPageToBlob(
  doc: PDFDocumentProxy,
  pageNumber: number,
  dpi: number,
  type: "image/png" | "image/jpeg" | "image/webp",
  quality = 0.9
): Promise<Blob> {
  const page = await doc.getPage(pageNumber);
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });
  const pixels = viewport.width * viewport.height;
  if (pixels > 80_000_000) throw new TudoPdfError("LIMIT", `Página ${pageNumber}: resolução muito alta para a memória disponível. Reduza o DPI.`);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  await page.render({ canvas, viewport, background: type === "image/jpeg" ? "#ffffff" : undefined }).promise;
  page.cleanup();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, type, quality));
  canvas.width = canvas.height = 0; // libera memória do canvas
  if (!blob) throw new TudoPdfError("UNSUPPORTED", "O navegador não conseguiu gerar a imagem.");
  return blob;
}
