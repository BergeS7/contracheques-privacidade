/**
 * Elementos sobrepostos às páginas: marca-d'água, numeração, cabeçalho e rodapé.
 * São NOVOS elementos desenhados por cima; o conteúdo original não é alterado.
 * Fontes padrão (Helvetica) cobrem o português (WinAnsi); caracteres fora disso viram "?".
 */
import { StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { throwIfAborted } from "../errors";
import { loadPdf, saveDocument, type PdfInput, type OpContext } from "./document";

export function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Substitui caracteres que a fonte padrão não consegue codificar. */
export function sanitizeForFont(text: string, font: PDFFont): string {
  let out = "";
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += ch === "\t" ? "    " : "?";
    }
  }
  return out;
}

/** Caixa visível da página já considerando /Rotate (para posicionar como o usuário vê). */
function visualFrame(page: PDFPage) {
  const { width, height } = page.getSize();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  return { width, height, rotation, vw: rotation % 180 === 0 ? width : height, vh: rotation % 180 === 0 ? height : width };
}

/** Converte coordenadas visuais (origem embaixo à esquerda, como o usuário vê) para as da página. */
function toPageCoords(page: PDFPage, vx: number, vy: number) {
  const { width, height, rotation } = visualFrame(page);
  switch (rotation) {
    // Página → visual em /Rotate 90: (vx, vy) = (y, width − x). Inverso abaixo.
    case 90: return { x: width - vy, y: vx, angle: 90 };
    case 180: return { x: width - vx, y: height - vy, angle: 180 };
    // /Rotate 270: (vx, vy) = (height − y, x).
    case 270: return { x: vy, y: height - vx, angle: 270 };
    default: return { x: vx, y: vy, angle: 0 };
  }
}

function drawVisualText(page: PDFPage, text: string, vx: number, vy: number, opts: {
  font: PDFFont; size: number; color: ReturnType<typeof rgb>; opacity?: number; rotate?: number;
}) {
  const p = toPageCoords(page, vx, vy);
  page.drawText(text, {
    x: p.x,
    y: p.y,
    size: opts.size,
    font: opts.font,
    color: opts.color,
    opacity: opts.opacity ?? 1,
    rotate: degrees(p.angle + (opts.rotate ?? 0))
  });
}

export interface WatermarkOptions {
  text: string;
  size: number;
  color: string;
  opacity: number;
  rotation: number;
  pages?: number[];
  layout: "center" | "tile";
  bold?: boolean;
}

export async function addWatermark(input: PdfInput, options: WatermarkOptions, ctx: OpContext = {}) {
  const doc = await loadPdf(input.bytes, { name: input.name });
  const font = await doc.embedFont(options.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
  const text = sanitizeForFont(options.text, font);
  const color = hexToRgb(options.color);
  const target = options.pages ? new Set(options.pages) : null;
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    throwIfAborted(ctx.signal);
    if (target && !target.has(i + 1)) return;
    const { vw, vh } = visualFrame(page);
    const textWidth = font.widthOfTextAtSize(text, options.size);
    const rad = (options.rotation * Math.PI) / 180;
    const place = (cx: number, cy: number) => {
      // Ponto inicial para o centro do texto girado cair em (cx, cy).
      const dx = (textWidth / 2) * Math.cos(rad) - (options.size / 3) * Math.sin(rad);
      const dy = (textWidth / 2) * Math.sin(rad) + (options.size / 3) * Math.cos(rad);
      drawVisualText(page, text, cx - dx, cy - dy, { font, size: options.size, color, opacity: options.opacity, rotate: options.rotation });
    };
    if (options.layout === "tile") {
      const stepX = Math.max(textWidth * 0.9, 120);
      const stepY = Math.max(options.size * 4, 80);
      for (let y = stepY / 2; y < vh; y += stepY) for (let x = stepX / 2; x < vw + stepX; x += stepX) place(x, y);
    } else {
      place(vw / 2, vh / 2);
    }
    ctx.onProgress?.((i + 1) / pages.length);
  });
  return saveDocument(doc);
}

export type BoxPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

export interface PageNumberOptions {
  position: BoxPosition;
  /** Use {n} para a página e {total} para o total. */
  format: string;
  startAt: number;
  size: number;
  margin: number;
  color: string;
  /** Páginas (1-based) que recebem número; as demais são puladas, mas contam. */
  pages?: number[];
}

function placeText(page: PDFPage, text: string, font: PDFFont, size: number, position: BoxPosition, margin: number, color: ReturnType<typeof rgb>) {
  const { vw, vh } = visualFrame(page);
  const width = font.widthOfTextAtSize(text, size);
  const x = position.endsWith("left") ? margin : position.endsWith("right") ? vw - margin - width : (vw - width) / 2;
  const y = position.startsWith("top") ? vh - margin - size : margin;
  drawVisualText(page, text, x, y, { font, size, color });
}

export async function addPageNumbers(input: PdfInput, options: PageNumberOptions, ctx: OpContext = {}) {
  const doc = await loadPdf(input.bytes, { name: input.name });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const color = hexToRgb(options.color);
  const pages = doc.getPages();
  const total = pages.length + options.startAt - 1;
  const target = options.pages ? new Set(options.pages) : null;
  pages.forEach((page, i) => {
    throwIfAborted(ctx.signal);
    if (target && !target.has(i + 1)) return;
    const n = i + options.startAt;
    const label = sanitizeForFont(options.format.replaceAll("{n}", String(n)).replaceAll("{total}", String(total)), font);
    placeText(page, label, font, options.size, options.position, options.margin, color);
    ctx.onProgress?.((i + 1) / pages.length);
  });
  return saveDocument(doc);
}

export interface HeaderFooterOptions {
  header?: string;
  footer?: string;
  align: "left" | "center" | "right";
  size: number;
  margin: number;
  color: string;
}

/** Cabeçalho/rodapé com {n}, {total}, {arquivo} e {data}. */
export async function addHeaderFooter(input: PdfInput, options: HeaderFooterOptions, ctx: OpContext = {}) {
  const doc = await loadPdf(input.bytes, { name: input.name });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const color = hexToRgb(options.color);
  const pages = doc.getPages();
  const date = new Date().toLocaleDateString("pt-BR");
  const fill = (t: string, n: number) =>
    sanitizeForFont(t.replaceAll("{n}", String(n)).replaceAll("{total}", String(pages.length)).replaceAll("{arquivo}", input.name).replaceAll("{data}", date), font);
  pages.forEach((page, i) => {
    throwIfAborted(ctx.signal);
    if (options.header) placeText(page, fill(options.header, i + 1), font, options.size, `top-${options.align === "center" ? "center" : options.align}` as BoxPosition, options.margin, color);
    if (options.footer) placeText(page, fill(options.footer, i + 1), font, options.size, `bottom-${options.align === "center" ? "center" : options.align}` as BoxPosition, options.margin, color);
    ctx.onProgress?.((i + 1) / pages.length);
  });
  return saveDocument(doc);
}
