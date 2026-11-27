/**
 * Organizador de contracheques — fluxo completo, independente de interface.
 * O carregador de PDF (PDF.js) é injetado para o mesmo código rodar no navegador e nos testes (Node).
 */
import { analyzeDocument, buildUnits, buildGroups, validateOutputOrder, type PayrollUnit, type PayrollGroup, type SortDirection, type TextDocLike } from "./recognize";
import { buildPayrollPdf } from "./build";
import { compareNames, keyOf, normalizeForSort } from "./text";

export * from "./recognize";
export * from "./text";
export { buildPayrollPdf } from "./build";

export interface PayrollInput {
  name: string;
  bytes: Uint8Array;
}

export type OpenTextDoc = (bytes: Uint8Array) => Promise<TextDocLike & { destroy?: () => Promise<void> | void }>;

export interface PayrollAnalysis {
  units: PayrollUnit[];
  pagesPerDoc: number[];
}

export async function analyzePayroll(
  inputs: PayrollInput[],
  open: OpenTextDoc,
  options: { signal?: AbortSignal; onProgress?: (fraction: number, message: string) => void } = {}
): Promise<PayrollAnalysis> {
  const units: PayrollUnit[] = [];
  const pagesPerDoc: number[] = [];
  for (let docIndex = 0; docIndex < inputs.length; docIndex++) {
    const input = inputs[docIndex];
    // Cópia: o PDF.js transfere o buffer para o worker e o original ficaria vazio para o pdf-lib.
    const doc = await open(input.bytes.slice());
    try {
      const pages = await analyzeDocument(doc, {
        docIndex,
        signal: options.signal,
        onProgress: (done, total) =>
          options.onProgress?.(
            (docIndex + done / total) / inputs.length,
            `Lendo ${input.name}: página ${done} de ${total}`
          )
      });
      pagesPerDoc.push(doc.numPages);
      // A detecção de cabeçalhos repetidos é feita por documento.
      units.push(...buildUnits(pages));
    } finally {
      await doc.destroy?.();
    }
  }
  return { units, pagesPerDoc };
}

/** Correções manuais: chave do grupo original → novo nome. */
export type NameOverrides = Record<string, string>;

/** Aplica correções manuais de nome antes de agrupar (unidades com o mesmo novo nome se juntam). */
export function applyOverrides(units: PayrollUnit[], overrides: NameOverrides): PayrollUnit[] {
  return units.map(unit => {
    const key = unit.source === "empty" || !unit.name ? null : keyOf(unit);
    const unitKey = `${unit.docIndex}:${unit.pageNumber}:${unit.part}`;
    const override = overrides[unitKey] ?? (key ? overrides[key] : undefined);
    if (override === undefined) return unit;
    const name = override.trim().replace(/\s+/g, " ");
    if (!name) return unit;
    // Nome definido pelo usuário: confiança total. O código só é mantido se o nome não mudou
    // (apenas grafia/acentos); caso contrário ele pertencia ao nome antigo.
    const sameName = normalizeForSort(name) === normalizeForSort(unit.name);
    const corrected: PayrollUnit = {
      ...unit,
      name,
      code: sameName ? unit.code : null,
      source: unit.source === "code" && sameName ? "code" : "label",
      confidence: 1,
      manual: true
    };
    return corrected;
  });
}

export function organizeGroups(units: PayrollUnit[], direction: SortDirection = "asc"): PayrollGroup[] {
  return buildGroups(units, direction);
}

/** PDF único com todos os contracheques na ordem dos grupos (com verificação de integridade). */
export async function buildCombined(inputs: PayrollInput[], groups: PayrollGroup[], pagesPerDoc: number[]) {
  const order = groups.flatMap(g => g.units);
  validateOutputOrder(order, pagesPerDoc);
  return buildPayrollPdf(inputs.map(i => i.bytes), order);
}

/** Um PDF por grupo (funcionário). Páginas sem texto formam um grupo próprio. */
export async function buildPerGroup(
  inputs: PayrollInput[],
  groups: PayrollGroup[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
) {
  const results: { group: PayrollGroup; pdfBytes: Uint8Array }[] = [];
  for (let i = 0; i < groups.length; i++) {
    if (signal?.aborted) throw new DOMException("Operação cancelada.", "AbortError");
    const { pdfBytes } = await buildPayrollPdf(inputs.map(x => x.bytes), groups[i].units);
    results.push({ group: groups[i], pdfBytes });
    onProgress?.(i + 1, groups.length);
  }
  return results;
}

export interface Inconsistency {
  level: "aviso" | "erro";
  message: string;
  pages: string;
}

const PART_LABEL = { whole: "", top: " (cima)", bottom: " (baixo)" } as const;
export const unitLabel = (u: PayrollUnit, docNames?: string[]) =>
  `${docNames && docNames.length > 1 ? `${docNames[u.docIndex]} · ` : ""}p.${u.pageNumber}${PART_LABEL[u.part]}`;

/** Relatório de pontos que merecem revisão humana. */
export function findInconsistencies(groups: PayrollGroup[], docNames: string[]): Inconsistency[] {
  const issues: Inconsistency[] = [];
  for (const group of groups) {
    const pages = group.units.map(u => unitLabel(u, docNames)).join(", ");
    if (group.source === "empty") {
      issues.push({ level: "aviso", message: `${group.units.length} trecho(s) sem texto (provavelmente digitalizados). Ficaram no final.`, pages });
    } else if (group.source === "line") {
      issues.push({ level: "aviso", message: `Nome não encontrado; ordenado pela 1ª linha: “${group.name}”.`, pages });
    }
  }
  // Mesmo nome com códigos diferentes, ou mesmo código com nomes diferentes.
  const byName = new Map<string, Set<string>>();
  const byCode = new Map<string, Set<string>>();
  for (const g of groups) {
    if (!g.name || g.source === "line") continue;
    const n = normalizeForSort(g.name);
    if (!byName.has(n)) byName.set(n, new Set());
    byName.get(n)!.add(g.code || "—");
    if (g.code) {
      if (!byCode.has(g.code)) byCode.set(g.code, new Set());
      byCode.get(g.code)!.add(g.name);
    }
  }
  for (const [name, codes] of byName) {
    if (codes.size > 1) issues.push({ level: "aviso", message: `O nome ${name} aparece com códigos diferentes (${[...codes].join(", ")}).`, pages: "" });
  }
  for (const [code, names] of byCode) {
    if (names.size > 1) issues.push({ level: "erro", message: `O código ${code} aparece com nomes diferentes: ${[...names].sort(compareNames).join(" / ")}.`, pages: "" });
  }
  return issues;
}
