/**
 * Reconhecimento de nomes em contracheques (texto puro, sem dependência de PDF).
 * Portado sem alteração de regras de extensao/app.js (v1.2.0). Testes de regressão: tests/payroll.*.test.ts
 */

export type CandidateSource = "code" | "label";

export interface Candidate {
  code: string | null;
  name: string;
  source: CandidateSource;
  position: number;
}

/** Item de texto mínimo (compatível com TextItem do PDF.js). */
export interface TextItemLike {
  str: string;
  hasEOL?: boolean;
  transform: number[];
  height?: number;
}

/** Remove acentos somente para comparação/ordenação. O nome exibido permanece o original. */
export function normalizeForSort(text: string | null | undefined): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

export function normalizeSpaces(text: string | null | undefined): string {
  return String(text || "")
    .replace(/\xA0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** PDF.js separa itens por posição: quebra de linha quando hasEOL, espaço nos demais. */
export function getPageText(items: readonly TextItemLike[]): string {
  let out = "";
  for (const item of items) {
    out += item.str || "";
    out += item.hasEOL ? "\n" : " ";
  }
  return normalizeSpaces(out);
}

export function cleanName(raw: string): string {
  return normalizeSpaces(raw)
    .replace(/\s*\n\s*/g, " ")
    .replace(/[,:;.\-\s]+$/g, "")
    .trim();
}

/** Nome plausível: pelo menos 2 palavras com letras. */
export function isPlausibleName(name: string): boolean {
  return name.split(/\s+/).filter(w => /\p{L}{2,}/u.test(w)).length >= 2;
}

const CODE_REGEX =
  /(\d{6})\s*-\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý'´`.^~Ç\s.-]{2,}?)(?=\s+(?:\n|CPF\b|C\.?P\.?F\.?\b|Admiss[aã]o\b|Cargo\b|Fun[cç][aã]o\b|Depto\b|Departamento\b|Banco\b|Ag[eê]ncia\b|Sal[aá]rio\b|CBO\b|PIS\b|Data\b|Folha\b|\d{4,}\s*-|\p{Lu}\p{Ll}|\S*:)|$)/gu;

const LABEL_REGEX =
  /(?:^|\n|\s)(?:Nome(?:\s+do\s+(?:funcion[aá]rio|colaborador|empregado|servidor|cliente|aluno|paciente))?|Funcion[aá]rio|Colaborador|Empregado|Servidor|Cliente|Aluno|Paciente|Benefici[aá]rio|Favorecido)\s*:\s*([\p{L}][\p{L}'´`.\s]{3,80}?)(?=\s{2,}|\s*\n|\s+(?:CPF|Matr[ií]cula|Cargo|Fun[cç][aã]o|Data|Admiss[aã]o|RG|C[oó]digo)\b|$)/giu;

/**
 * Candidatos a nome, em ordem de confiança:
 *  1. código de 6 dígitos - NOME   (ex.: 000578 - MARIA DA SILVA)
 *  2. campo rotulado               (ex.: Nome: Maria da Silva, Funcionário: ..., Colaborador: ...)
 * A escolha acontece depois, olhando o documento inteiro.
 */
export function extractCandidates(text: string): Candidate[] {
  const flat = text.replace(/\n/g, " \n ");
  const candidates: Candidate[] = [];
  let match: RegExpExecArray | null;

  const codeRegex = new RegExp(CODE_REGEX.source, CODE_REGEX.flags);
  while ((match = codeRegex.exec(flat)) !== null) {
    const name = cleanName(match[2]);
    // Departamentos costumam ter outro " - " no nome (ex.: 000034 - ZD - CONSORCIO).
    if (!name || name.includes(" - ") || !isPlausibleName(name)) continue;
    candidates.push({ code: match[1], name, source: "code", position: match.index });
  }

  const labelRegex = new RegExp(LABEL_REGEX.source, LABEL_REGEX.flags);
  while ((match = labelRegex.exec(flat)) !== null) {
    const name = cleanName(match[1]);
    if (!name || !isPlausibleName(name)) continue;
    candidates.push({ code: null, name, source: "label", position: match.index });
  }

  return candidates;
}

/** Primeira linha com texto de verdade: último recurso para trechos sem nome identificável. */
export function firstTextLine(text: string): string {
  for (const line of text.split("\n")) {
    const clean = line.trim();
    if ((clean.match(/\p{L}/gu) || []).length >= 3) return clean.slice(0, 80);
  }
  return "";
}

export const keyOf = (c: { code: string | null; name: string | null }): string =>
  `${c.code || ""}|${normalizeForSort(c.name)}`;

/** Comparação alfabética pt-BR ignorando acentos e caixa. */
export function compareNames(a: string, b: string): number {
  return normalizeForSort(a).localeCompare(normalizeForSort(b), "pt-BR", { sensitivity: "base", numeric: true });
}
