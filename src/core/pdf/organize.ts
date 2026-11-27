/**
 * Operações de organização de páginas (pdf-lib). Todas são estruturais: o conteúdo das páginas é
 * copiado sem redesenhar, então texto continua selecionável e a qualidade é preservada.
 */
import { PDFDocument, degrees, PageSizes } from "pdf-lib";
import { TudoPdfError, throwIfAborted } from "../errors";
import { loadPdf, newDocument, saveDocument, type PdfInput, type OpContext } from "./document";
import { range } from "./pageRanges";

/** Uma página da composição final: página existente (com rotação extra) ou página em branco. */
export type PageSpec =
  | { kind: "page"; doc: number; page: number; rotate?: number }
  | { kind: "blank"; width: number; height: number };

const normalizeAngle = (a: number) => (((Math.round(a / 90) * 90) % 360) + 360) % 360;

/**
 * Monta um novo PDF a partir de páginas de um ou mais documentos, na ordem pedida.
 * É a base de juntar, extrair, excluir, duplicar, reordenar, girar, intercalar e inserir em branco.
 */
export async function composePages(inputs: PdfInput[], specs: PageSpec[], ctx: OpContext = {}): Promise<Uint8Array> {
  if (!specs.length) throw new TudoPdfError("INVALID_INPUT", "O resultado não teria nenhuma página.");
  const out = await newDocument();
  const sources: PDFDocument[] = [];
  for (let i = 0; i < inputs.length; i++) {
    throwIfAborted(ctx.signal);
    if (specs.some(s => s.kind === "page" && s.doc === i)) {
      sources[i] = await loadPdf(inputs[i].bytes, { name: inputs[i].name });
    }
    ctx.onProgress?.(((i + 1) / inputs.length) * 0.4, `Lendo ${inputs[i].name}`);
  }

  // copyPages uma vez por documento (recursos compartilhados entram uma vez só).
  // Páginas repetidas (duplicar) precisam de cópias separadas.
  const copies = new Map<number, Map<number, import("pdf-lib").PDFPage[]>>();
  for (const [docIndex, src] of sources.entries()) {
    if (!src) continue;
    const wanted = specs.filter((s): s is Extract<PageSpec, { kind: "page" }> => s.kind === "page" && s.doc === docIndex);
    for (const s of wanted) {
      if (s.page < 1 || s.page > src.getPageCount()) {
        throw new TudoPdfError("INVALID_INPUT", `A página ${s.page} não existe em ${inputs[docIndex].name}.`);
      }
    }
    const indices = wanted.map(s => s.page - 1);
    const copied = await out.copyPages(src, indices);
    const byPage = new Map<number, import("pdf-lib").PDFPage[]>();
    wanted.forEach((s, i) => {
      if (!byPage.has(s.page)) byPage.set(s.page, []);
      byPage.get(s.page)!.push(copied[i]);
    });
    copies.set(docIndex, byPage);
  }

  specs.forEach((spec, i) => {
    if (i % 50 === 0) throwIfAborted(ctx.signal);
    if (spec.kind === "blank") {
      out.addPage([spec.width, spec.height]);
      return;
    }
    const page = copies.get(spec.doc)!.get(spec.page)!.shift()!;
    if (spec.rotate) page.setRotation(degrees(normalizeAngle(page.getRotation().angle + spec.rotate)));
    out.addPage(page);
    ctx.onProgress?.(0.4 + ((i + 1) / specs.length) * 0.5, "Montando páginas");
  });

  const bytes = await saveDocument(out);
  ctx.onProgress?.(1, "Concluído");
  return bytes;
}

export async function pageCount(input: PdfInput, _ctx: OpContext = {}): Promise<number> {
  return (await loadPdf(input.bytes, { name: input.name })).getPageCount();
}

/** Juntar: todos os documentos, na ordem recebida. */
export async function mergePdfs(inputs: PdfInput[], ctx: OpContext = {}): Promise<Uint8Array> {
  if (inputs.length < 2) throw new TudoPdfError("INVALID_INPUT", "Selecione pelo menos dois PDFs para juntar.");
  const specs: PageSpec[] = [];
  for (const [doc, input] of inputs.entries()) {
    const total = await pageCount(input);
    for (const page of range(1, total)) specs.push({ kind: "page", doc, page });
  }
  return composePages(inputs, specs, ctx);
}

/** Extrair/reordenar/duplicar: páginas na ordem informada (repetições permitidas). */
export function selectPages(input: PdfInput, pages: number[], ctx: OpContext = {}) {
  return composePages([input], pages.map(page => ({ kind: "page", doc: 0, page })), ctx);
}

export async function deletePages(input: PdfInput, remove: number[], ctx: OpContext = {}) {
  const total = await pageCount(input);
  const drop = new Set(remove);
  const keep = range(1, total).filter(p => !drop.has(p));
  if (!keep.length) throw new TudoPdfError("INVALID_INPUT", "Não é possível excluir todas as páginas.");
  return selectPages(input, keep, ctx);
}

export async function rotatePages(input: PdfInput, pages: number[] | "all", angle: number, ctx: OpContext = {}) {
  const total = await pageCount(input);
  const target = new Set(pages === "all" ? range(1, total) : pages);
  return composePages([input], range(1, total).map(page => ({
    kind: "page", doc: 0, page, rotate: target.has(page) ? angle : 0
  })), ctx);
}

export async function reversePages(input: PdfInput, ctx: OpContext = {}) {
  const total = await pageCount(input);
  return selectPages(input, range(1, total).reverse(), ctx);
}

/** Duplica cada página selecionada logo após a original. */
export async function duplicatePages(input: PdfInput, pages: number[], copies = 1, ctx: OpContext = {}) {
  const total = await pageCount(input);
  const target = new Set(pages);
  const order = range(1, total).flatMap(p => (target.has(p) ? Array(copies + 1).fill(p) : [p]));
  return selectPages(input, order, ctx);
}

/**
 * Intercalar: A1, B1, A2, B2… Útil para digitalizações frente/verso.
 * `reverseSecond` inverte o segundo documento (versos digitalizados de trás para frente).
 */
export async function interleavePdfs(inputs: PdfInput[], reverseSecond = false, ctx: OpContext = {}) {
  if (inputs.length < 2) throw new TudoPdfError("INVALID_INPUT", "Selecione pelo menos dois PDFs para intercalar.");
  const lists = await Promise.all(inputs.map(async (input, doc) => {
    const pages = range(1, await pageCount(input));
    if (doc === 1 && reverseSecond) pages.reverse();
    return pages.map(page => ({ kind: "page" as const, doc, page }));
  }));
  const specs: PageSpec[] = [];
  const longest = Math.max(...lists.map(l => l.length));
  for (let i = 0; i < longest; i++) for (const list of lists) if (list[i]) specs.push(list[i]);
  return composePages(inputs, specs, ctx);
}

/** Separa em dois documentos: páginas ímpares e páginas pares. */
export async function splitOddEven(input: PdfInput, ctx: OpContext = {}) {
  const total = await pageCount(input);
  const odd = range(1, total).filter(p => p % 2 === 1);
  const even = range(1, total).filter(p => p % 2 === 0);
  const result: { label: string; bytes: Uint8Array }[] = [];
  if (odd.length) result.push({ label: "impares", bytes: await selectPages(input, odd, ctx) });
  if (even.length) result.push({ label: "pares", bytes: await selectPages(input, even, ctx) });
  return result;
}

/** Dividir: um documento por grupo de páginas. */
export async function splitByGroups(input: PdfInput, groups: number[][], ctx: OpContext = {}) {
  const out: Uint8Array[] = [];
  for (const [i, group] of groups.entries()) {
    throwIfAborted(ctx.signal);
    out.push(await selectPages(input, group));
    ctx.onProgress?.((i + 1) / groups.length, `Parte ${i + 1} de ${groups.length}`);
  }
  return out;
}

export async function splitEvery(input: PdfInput, size: number, ctx: OpContext = {}) {
  if (!Number.isInteger(size) || size < 1) throw new TudoPdfError("INVALID_INPUT", "Informe um número de páginas por parte maior que zero.");
  const total = await pageCount(input);
  const groups: number[][] = [];
  for (let start = 1; start <= total; start += size) groups.push(range(start, Math.min(total, start + size - 1)));
  return splitByGroups(input, groups, ctx);
}

export const PAPER_SIZES: Record<string, [number, number]> = {
  A4: PageSizes.A4 as [number, number],
  A3: PageSizes.A3 as [number, number],
  A5: PageSizes.A5 as [number, number],
  Carta: PageSizes.Letter as [number, number],
  Ofício: PageSizes.Legal as [number, number]
};

/**
 * Insere páginas em branco. `position`: "after-each" (após cada página), "start", "end" ou uma lista
 * de páginas após as quais inserir. O tamanho segue a página vizinha quando size = "match".
 */
export async function insertBlankPages(
  input: PdfInput,
  position: "start" | "end" | "after-each" | number[],
  size: "match" | keyof typeof PAPER_SIZES = "match",
  ctx: OpContext = {}
) {
  const doc = await loadPdf(input.bytes, { name: input.name });
  const total = doc.getPageCount();
  const sizeOf = (page: number): [number, number] => {
    if (size !== "match") return PAPER_SIZES[size];
    const p = doc.getPage(Math.min(Math.max(page, 1), total) - 1);
    const { width, height } = p.getSize();
    return [width, height];
  };
  const blank = (near: number): PageSpec => {
    const [width, height] = sizeOf(near);
    return { kind: "blank", width, height };
  };
  const after = new Set(Array.isArray(position) ? position : position === "after-each" ? range(1, total) : []);
  const specs: PageSpec[] = [];
  if (position === "start") specs.push(blank(1));
  for (const page of range(1, total)) {
    specs.push({ kind: "page", doc: 0, page });
    if (after.has(page)) specs.push(blank(page));
  }
  if (position === "end") specs.push(blank(total));
  return composePages([input], specs, ctx);
}

/**
 * Alterar tamanho: cada página é desenhada (vetorialmente) dentro do novo tamanho, mantendo a
 * proporção e centralizada. O texto continua selecionável.
 */
export async function resizePages(
  input: PdfInput,
  target: keyof typeof PAPER_SIZES,
  orientation: "auto" | "portrait" | "landscape" = "auto",
  margin = 0,
  ctx: OpContext = {}
) {
  const src = await loadPdf(input.bytes, { name: input.name });
  const out = await newDocument();
  const pages = src.getPages();
  const embedded = await out.embedPages(pages);
  embedded.forEach((emb, i) => {
    throwIfAborted(ctx.signal);
    const srcPage = pages[i];
    const rotation = normalizeAngle(srcPage.getRotation().angle);
    const { width: sw, height: sh } = srcPage.getSize();
    const visualLandscape = rotation % 180 === 0 ? sw > sh : sh > sw;
    let [tw, th] = PAPER_SIZES[target];
    const landscape = orientation === "auto" ? visualLandscape : orientation === "landscape";
    if (landscape !== tw > th) [tw, th] = [th, tw];
    const page = out.addPage([tw, th]);
    // Tamanho visual da página de origem (considerando rotação).
    const [vw, vh] = rotation % 180 === 0 ? [sw, sh] : [sh, sw];
    const scale = Math.min((tw - 2 * margin) / vw, (th - 2 * margin) / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const x = (tw - dw) / 2;
    const y = (th - dh) / 2;
    // /Rotate R gira no sentido horário; drawPage gira anti-horário em torno do ponto de ancoragem.
    // Âncoras calculadas para que o conteúdo girado ocupe exatamente [x, x+dw] × [y, y+dh].
    const placements: Record<number, { x: number; y: number }> = {
      0: { x, y },
      90: { x, y: y + dh },
      180: { x: x + dw, y: y + dh },
      270: { x: x + dw, y }
    };
    page.drawPage(emb, {
      ...placements[rotation],
      xScale: scale,
      yScale: scale,
      rotate: degrees(rotation === 0 ? 0 : 360 - rotation)
    });
    ctx.onProgress?.((i + 1) / embedded.length, `Página ${i + 1} de ${embedded.length}`);
  });
  return saveDocument(out);
}

export { compareFilenames } from "../../utils/sort";
