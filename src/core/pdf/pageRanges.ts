import { TudoPdfError } from "../errors";

/**
 * Interpreta intervalos de páginas (1-based): "1-3, 5, 8-", "-4", "todas".
 * Mantém a ordem e as repetições digitadas (útil para extrair/reordenar).
 */
export function parsePageList(input: string, total: number): number[] {
  const text = input.trim().toLowerCase();
  if (!text || text === "todas" || text === "*") return range(1, total);
  const result: number[] = [];
  for (const rawPart of text.split(/[,;]+/)) {
    const part = rawPart.trim().replace(/\s+/g, "");
    if (!part) continue;
    const m = /^(\d*)-(\d*)$/.exec(part) ?? /^(\d+)()$/.exec(part);
    if (!m) throw new TudoPdfError("INVALID_INPUT", `Intervalo inválido: “${rawPart.trim()}”. Use, por exemplo, 1-3, 5, 8-.`);
    const isRange = part.includes("-");
    const start = m[1] ? Number(m[1]) : 1;
    const end = isRange ? (m[2] ? Number(m[2]) : total) : start;
    if (start < 1 || end < 1 || start > total || end > total) {
      throw new TudoPdfError("INVALID_INPUT", `A página ${Math.max(start, end)} não existe (o documento tem ${total}).`);
    }
    if (start <= end) result.push(...range(start, end));
    else for (let p = start; p >= end; p--) result.push(p);
  }
  if (!result.length) throw new TudoPdfError("INVALID_INPUT", "Nenhuma página selecionada.");
  return result;
}

/** Vários grupos separados por ";" ou quebra de linha → um documento por grupo. */
export function parseRangeGroups(input: string, total: number): number[][] {
  return input
    .split(/[;\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(group => parsePageList(group, total));
}

export function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

/** Representação compacta: [1,2,3,5] → "1-3, 5". */
export function formatPageList(pages: number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < pages.length) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    parts.push(j > i ? `${pages[i]}-${pages[j]}` : `${pages[i]}`);
    i = j + 1;
  }
  return parts.join(", ");
}
