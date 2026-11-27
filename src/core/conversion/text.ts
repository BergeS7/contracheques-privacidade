/**
 * Conversões de texto:
 *  - PDF → TXT / Markdown: extrai a camada de texto (PDFs digitalizados precisam de OCR).
 *  - TXT → PDF: texto com quebra automática de linhas, fonte padrão (português coberto).
 */
import { StandardFonts } from "pdf-lib";
import { TudoPdfError, throwIfAborted } from "../errors";
import { newDocument, saveDocument, type OpContext } from "../pdf/document";
import { PAPER_SIZES } from "../pdf/organize";
import { sanitizeForFont } from "../pdf/stamp";
import type { TextDocLike } from "../payroll/recognize";

interface Item { str: string; x: number; y: number; h: number; w: number; eol: boolean }

const asItems = (items: unknown[]): Item[] =>
  items
    .filter((it): it is { str: string; transform: number[]; height: number; width: number; hasEOL?: boolean } =>
      typeof it === "object" && it !== null && "str" in it && "transform" in it)
    .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], h: Math.abs(it.height || it.transform[3] || 0), w: it.width || 0, eol: !!it.hasEOL }));

/** Agrupa itens em linhas pela posição vertical e ordena da esquerda para a direita. */
export function itemsToLines(items: unknown[]): { text: string; size: number; y: number }[] {
  const list = asItems(items).filter(i => i.str.trim() !== "");
  const lines: { y: number; size: number; parts: Item[] }[] = [];
  for (const item of list.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const tolerance = Math.max(2, item.h * 0.5);
    const line = lines.find(l => Math.abs(l.y - item.y) <= tolerance);
    if (line) {
      line.parts.push(item);
      line.size = Math.max(line.size, item.h);
    } else {
      lines.push({ y: item.y, size: item.h, parts: [item] });
    }
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map(line => {
      const parts = line.parts.sort((a, b) => a.x - b.x);
      let text = "";
      let lastEnd: number | null = null;
      for (const p of parts) {
        if (lastEnd !== null) {
          const gap = p.x - lastEnd;
          text += gap > p.h * 1.5 ? "\t" : gap > p.h * 0.15 && !text.endsWith(" ") && !p.str.startsWith(" ") ? " " : "";
        }
        text += p.str;
        lastEnd = p.x + p.w;
      }
      return { text: text.replace(/[ ]{2,}/g, " ").trimEnd(), size: line.size, y: line.y };
    });
}

export interface ExtractedPage {
  page: number;
  lines: { text: string; size: number; y: number }[];
}

export async function extractTextPages(doc: TextDocLike, ctx: OpContext = {}): Promise<ExtractedPage[]> {
  const pages: ExtractedPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    throwIfAborted(ctx.signal);
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    pages.push({ page: n, lines: itemsToLines(items) });
    ctx.onProgress?.(n / doc.numPages, `Página ${n} de ${doc.numPages}`);
  }
  return pages;
}

export function pagesToTxt(pages: ExtractedPage[]): string {
  return pages
    .map(p => `--- Página ${p.page} ---\n${p.lines.map(l => l.text).join("\n")}`)
    .join("\n\n")
    .concat("\n");
}

/**
 * Markdown heurístico: linhas com fonte bem maior que o corpo viram títulos; parágrafos são
 * reconstruídos pelo espaçamento. Tabelas e imagens não são reconstruídas (limitação documentada).
 */
export function pagesToMarkdown(pages: ExtractedPage[]): string {
  const sizes = pages.flatMap(p => p.lines.map(l => Math.round(l.size))).filter(Boolean);
  const freq = new Map<number, number>();
  for (const s of sizes) freq.set(s, (freq.get(s) || 0) + 1);
  const body = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
  const escape = (t: string) => t.replace(/([\\`*_[\]#<>])/g, "\\$1").replace(/\t/g, " | ");
  const out: string[] = [];
  for (const page of pages) {
    let prevY: number | null = null;
    let paragraph: string[] = [];
    const flush = () => { if (paragraph.length) { out.push(paragraph.join(" ")); out.push(""); paragraph = []; } };
    for (const line of page.lines) {
      const text = line.text.trim();
      if (!text) continue;
      const ratio = line.size / body;
      const gap = prevY === null ? 0 : prevY - line.y;
      prevY = line.y;
      if (ratio >= 1.6) { flush(); out.push(`# ${escape(text)}`, ""); continue; }
      if (ratio >= 1.25) { flush(); out.push(`## ${escape(text)}`, ""); continue; }
      if (/^([•▪●\-–*]|\d+[.)])\s+/.test(text)) { flush(); out.push(`- ${escape(text.replace(/^([•▪●\-–*]|\d+[.)])\s+/, ""))}`); continue; }
      if (gap > line.size * 1.8) flush();
      paragraph.push(escape(text));
    }
    flush();
    if (page !== pages[pages.length - 1]) out.push("---", "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export interface TextToPdfOptions {
  pageSize: keyof typeof PAPER_SIZES;
  fontSize: number;
  margin: number;
  font: "Helvetica" | "Times" | "Courier";
}

const FONT_MAP = { Helvetica: StandardFonts.Helvetica, Times: StandardFonts.TimesRoman, Courier: StandardFonts.Courier };

export async function textToPdf(text: string, options: TextToPdfOptions, ctx: OpContext = {}): Promise<Uint8Array> {
  if (!text.trim()) throw new TudoPdfError("INVALID_INPUT", "O texto está vazio.");
  const doc = await newDocument();
  const font = await doc.embedFont(FONT_MAP[options.font]);
  const [pw, ph] = PAPER_SIZES[options.pageSize];
  const maxWidth = pw - 2 * options.margin;
  const lineHeight = options.fontSize * 1.35;
  const width = (s: string) => font.widthOfTextAtSize(s, options.fontSize);

  const lines: string[] = [];
  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const clean = sanitizeForFont(rawLine.replace(/\t/g, "    "), font);
    if (!clean) { lines.push(""); continue; }
    let current = "";
    for (const word of clean.split(/(\s+)/)) {
      if (width(current + word) <= maxWidth) { current += word; continue; }
      if (current.trim()) lines.push(current.trimEnd());
      current = word.trimStart();
      // Palavra maior que a linha: quebra por caractere.
      while (width(current) > maxWidth) {
        let cut = current.length - 1;
        while (cut > 1 && width(current.slice(0, cut)) > maxWidth) cut--;
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    lines.push(current.trimEnd());
  }

  const perPage = Math.max(1, Math.floor((ph - 2 * options.margin) / lineHeight));
  for (let start = 0; start < lines.length; start += perPage) {
    throwIfAborted(ctx.signal);
    const page = doc.addPage([pw, ph]);
    lines.slice(start, start + perPage).forEach((line, i) => {
      if (line) page.drawText(line, { x: options.margin, y: ph - options.margin - options.fontSize - i * lineHeight, size: options.fontSize, font });
    });
    ctx.onProgress?.(Math.min(1, (start + perPage) / lines.length));
  }
  return saveDocument(doc);
}
