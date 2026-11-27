/**
 * Análise de páginas de contracheques: separação de folhas com duas pessoas, escolha do nome
 * de cada trecho, agrupamento e verificação de integridade.
 * Regras portadas de extensao/app.js (v1.2.0) sem alteração de comportamento.
 */
import {
  type Candidate,
  type CandidateSource,
  type TextItemLike,
  extractCandidates,
  firstTextLine,
  getPageText,
  keyOf,
  compareNames
} from "./text";

export type ChoiceSource = CandidateSource | "line" | "empty";
export type UnitPart = "whole" | "top" | "bottom";

export interface Choice {
  source: ChoiceSource;
  code: string | null;
  name: string | null;
}

export interface PageHalf {
  text: string;
  candidates: Candidate[];
  extent: [number, number] | null;
}

export interface AnalyzedPage {
  docIndex: number;
  pageNumber: number;
  text: string;
  split: number | null;
  candidates: Candidate[];
  top: PageHalf;
  bottom: PageHalf;
}

export interface PayrollUnit extends Choice {
  docIndex: number;
  pageNumber: number;
  part: UnitPart;
  split?: number | null;
  extent?: [number, number] | null;
  /** 0..1 — confiança do reconhecimento do nome. */
  confidence: number;
  /** Nome corrigido manualmente pelo usuário. */
  manual?: boolean;
}

export interface PayrollGroup {
  key: string;
  code: string | null;
  name: string | null;
  source: ChoiceSource;
  units: PayrollUnit[];
}

/** Página mínima (compatível com PDFPageProxy do PDF.js). */
export interface TextPageLike {
  view: number[];
  getTextContent(): Promise<{ items: unknown[] }>;
}
export interface TextDocLike {
  numPages: number;
  getPage(n: number): Promise<TextPageLike>;
}

export const CONFIDENCE: Record<ChoiceSource, number> = { code: 0.95, label: 0.8, line: 0.3, empty: 0 };

const isTextItem = (item: unknown): item is TextItemLike =>
  typeof item === "object" && item !== null && "str" in item && "transform" in item;

/** Altura ocupada por um trecho (origem embaixo), com folga para descendentes (g, p, q). */
export function itemSpan(item: TextItemLike): [number, number] {
  const y = item.transform[5];
  const h = Math.abs(item.height || item.transform[3] || 10);
  return [y - 0.3 * h, y + h];
}

export function extentOf(spans: [number, number][]): [number, number] | null {
  if (!spans.length) return null;
  return [Math.min(...spans.map(s => s[0])), Math.max(...spans.map(s => s[1]))];
}

/**
 * Onde separar uma folha com dois contracheques, sem nunca cortar um deles ao meio:
 *  1. O cabeçalho e os rótulos se repetem exatamente duas vezes, à mesma distância vertical
 *     ("passo"); exige pelo menos 3 textos repetidos concordando.
 *  2. O segundo contracheque começa um passo abaixo do topo do primeiro.
 *  3. O corte vai no meio da faixa sem texto que encosta nesse início (mínimo MIN_GAP pontos).
 * Se qualquer passo falhar, devolve null e a folha não é separada.
 */
export const MIN_GAP = 10;
export function findSplit(inkItems: TextItemLike[], y0: number, y1: number): number | null {
  const height = y1 - y0;

  const positions = new Map<string, number[]>();
  for (const item of inkItems) {
    const text = item.str.trim();
    if (text.length < 4) continue;
    if (!positions.has(text)) positions.set(text, []);
    positions.get(text)!.push(item.transform[5]);
  }
  const votes = new Map<number, number>();
  for (const ys of positions.values()) {
    if (ys.length !== 2) continue;
    const step = Math.round(Math.abs(ys[0] - ys[1]));
    if (step >= 0.25 * height) votes.set(step, (votes.get(step) || 0) + 1);
  }
  let step: number | null = null;
  let support = 0;
  for (const s of votes.keys()) {
    const v = (votes.get(s - 1) || 0) + votes.get(s)! + (votes.get(s + 1) || 0);
    if (v > support) { support = v; step = s; }
  }
  if (step === null || support < 3) return null;

  const spans = inkItems.map(itemSpan).sort((a, b) => a[0] - b[0]);
  const secondStarts = Math.max(...spans.map(s => s[1])) - step;

  let cursorHigh: number | null = null;
  const merged: [number, number][] = [];
  for (const [lo, hi] of spans) {
    if (cursorHigh !== null && lo <= cursorHigh) {
      cursorHigh = Math.max(cursorHigh, hi);
      merged[merged.length - 1][1] = cursorHigh;
    } else {
      merged.push([lo, hi]);
      cursorHigh = hi;
    }
  }
  for (let i = 0; i + 1 < merged.length; i++) {
    const gapLow = merged[i][1];
    const gapHigh = merged[i + 1][0];
    const center = (gapLow + gapHigh) / 2;
    if (gapHigh - gapLow >= MIN_GAP &&
        secondStarts >= gapLow - 4 && secondStarts <= gapHigh + 4 &&
        center > y0 + 0.25 * height && center < y0 + 0.75 * height) {
      return center;
    }
  }
  return null;
}

/** Analisa uma página a partir dos itens de texto do PDF.js. */
export function analyzePage(items: unknown[], view: number[], pageNumber: number, docIndex = 0): AnalyzedPage {
  const textItems = items.filter(isTextItem);
  const [, y0, , y1] = view;
  // Só trechos com letras contam para achar a faixa em branco; os vazios ficam no texto
  // porque é neles que o PDF.js marca as quebras de linha.
  const hasInk = (item: TextItemLike) => (item.str || "").trim() !== "";
  const split = findSplit(textItems.filter(hasInk), y0, y1);

  // transform[5] é a linha de base (origem embaixo): acima do corte = metade de cima.
  const text = getPageText(textItems);
  const topItems = split === null ? [] : textItems.filter(item => item.transform[5] > split);
  const bottomItems = split === null ? [] : textItems.filter(item => item.transform[5] <= split);
  const topText = getPageText(topItems);
  const bottomText = getPageText(bottomItems);
  const extent = (list: TextItemLike[]) => extentOf(list.filter(hasInk).map(itemSpan));
  return {
    docIndex,
    pageNumber,
    text,
    split,
    candidates: extractCandidates(text),
    top: { text: topText, candidates: extractCandidates(topText), extent: extent(topItems) },
    bottom: { text: bottomText, candidates: extractCandidates(bottomText), extent: extent(bottomItems) }
  };
}

export interface ReadOptions {
  docIndex?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/** Lê todas as páginas de um documento já aberto no PDF.js. */
export async function analyzeDocument(pdf: TextDocLike, options: ReadOptions = {}): Promise<AnalyzedPage[]> {
  const pages: AnalyzedPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    if (options.signal?.aborted) throw new DOMException("Operação cancelada.", "AbortError");
    const page = await pdf.getPage(pageNumber);
    const { items } = await page.getTextContent();
    pages.push(analyzePage(items, page.view, pageNumber, options.docIndex ?? 0));
    options.onProgress?.(pageNumber, pdf.numPages);
  }
  return pages;
}

/**
 * Escolhe o nome de um trecho olhando o documento inteiro:
 *  - candidato presente na maioria das páginas é cabeçalho (empresa, departamento) e é ignorado;
 *  - entre os restantes, vence o que mais se repete no trecho; no empate, o que aparece em menos
 *    páginas do documento; por fim, o primeiro no texto.
 */
export function makeChooser(pages: AnalyzedPage[]) {
  const docFreq = new Map<string, number>();
  for (const page of pages) {
    for (const key of new Set(page.candidates.map(keyOf))) {
      docFreq.set(key, (docFreq.get(key) || 0) + 1);
    }
  }
  const total = pages.length;
  const isHeader = (key: string) => total >= 3 && (docFreq.get(key) || 0) / total > 0.5;
  const sourceRank: Record<CandidateSource, number> = { code: 0, label: 1 };

  return (candidates: Candidate[], text: string): Choice => {
    if (!text) return { source: "empty", code: null, name: null };

    const counts = new Map<string, Candidate & { key: string; count: number }>();
    for (const c of candidates) {
      const key = keyOf(c);
      const prev = counts.get(key);
      if (prev) prev.count += 1;
      else counts.set(key, { ...c, key, count: 1 });
    }

    let options = [...counts.values()];
    const nonHeader = options.filter(o => !isHeader(o.key));
    if (nonHeader.length) options = nonHeader;

    if (!options.length) return { source: "line", code: null, name: firstTextLine(text) };

    options.sort((x, y) =>
      sourceRank[x.source] - sourceRank[y.source] ||
      y.count - x.count ||
      (docFreq.get(x.key) || 0) - (docFreq.get(y.key) || 0) ||
      x.position - y.position
    );
    const best = options[0];
    return { source: best.source, code: best.code, name: best.name };
  };
}

const hasName = (choice: Choice) => choice.source === "code" || choice.source === "label";

/**
 * Transforma cada página em unidades a ordenar (páginas de UM documento):
 *  - pessoas diferentes em cima e embaixo → duas metades;
 *  - a mesma pessoa nas duas metades (duas vias) → folha inteira;
 *  - só uma metade com conteúdo → só essa metade;
 *  - qualquer outro caso → folha inteira.
 */
export function buildUnits(pages: AnalyzedPage[]): PayrollUnit[] {
  const choose = makeChooser(pages);
  const units: PayrollUnit[] = [];
  const withConfidence = (c: Choice) => ({ ...c, confidence: CONFIDENCE[c.source] });

  for (const page of pages) {
    const top = choose(page.top.candidates, page.top.text);
    const bottom = choose(page.bottom.candidates, page.bottom.text);
    const base = { docIndex: page.docIndex, pageNumber: page.pageNumber };

    const half = (part: "top" | "bottom", choice: Choice): PayrollUnit => ({
      ...base, part, split: page.split, extent: page[part].extent, ...withConfidence(choice)
    });
    const whole = (): PayrollUnit => ({ ...base, part: "whole", ...withConfidence(choose(page.candidates, page.text)) });

    if (page.split === null) {
      units.push(whole());
    } else if (hasName(top) && hasName(bottom) && keyOf(top) !== keyOf(bottom)) {
      units.push(half("top", top), half("bottom", bottom));
    } else if (hasName(top) && !page.bottom.text) {
      units.push(half("top", top));
    } else if (hasName(bottom) && !page.top.text) {
      units.push(half("bottom", bottom));
    } else {
      units.push(whole());
    }
  }
  return units;
}

export type SortDirection = "asc" | "desc";

/**
 * Agrupa unidades com o mesmo nome e ordena. Unidades sem texto vão para o fim, na ordem original.
 * Dentro de cada grupo a ordem original é mantida.
 */
export function buildGroups(units: PayrollUnit[], direction: SortDirection = "asc"): PayrollGroup[] {
  const groups = new Map<string, PayrollGroup>();
  const empty: PayrollUnit[] = [];

  for (const unit of units) {
    if (unit.source === "empty" || !unit.name) {
      empty.push(unit);
      continue;
    }
    const key = keyOf(unit);
    if (!groups.has(key)) {
      groups.set(key, { key, code: unit.code, name: unit.name, source: unit.source, units: [] });
    }
    groups.get(key)!.units.push(unit);
  }

  const sign = direction === "desc" ? -1 : 1;
  const sorted = [...groups.values()].sort((a, b) =>
    sign * compareNames(a.name!, b.name!) ||
    a.units[0].docIndex - b.units[0].docIndex ||
    a.units[0].pageNumber - b.units[0].pageNumber
  );

  if (empty.length) {
    sorted.push({ key: "__empty__", code: null, name: null, source: "empty", units: empty });
  }
  return sorted;
}

/**
 * Cada parte com conteúdo (folha inteira ou metade) entra exatamente uma vez, e toda página de
 * todos os documentos aparece. Lança erro em caso de perda ou duplicação.
 */
export function validateOutputOrder(order: PayrollUnit[], pagesPerDoc: number[]): void {
  const seen = new Set<string>();
  for (const unit of order) {
    const parts = unit.part === "whole" ? ["top", "bottom"] : [unit.part];
    for (const part of parts) {
      const id = `${unit.docIndex}:${unit.pageNumber}:${part}`;
      if (seen.has(id)) {
        throw new Error(`Falha de integridade: a página ${unit.pageNumber} entrou duas vezes.`);
      }
      seen.add(id);
    }
  }
  pagesPerDoc.forEach((total, doc) => {
    for (let page = 1; page <= total; page++) {
      if (!seen.has(`${doc}:${page}:top`) && !seen.has(`${doc}:${page}:bottom`)) {
        throw new Error(`Falha de integridade: a página ${page} não entrou no PDF final.`);
      }
    }
  });
}
