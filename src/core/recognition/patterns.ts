/**
 * Reconhecimento local de dados pessoais e campos comuns em documentos brasileiros.
 * CPF e CNPJ são validados pelos dígitos verificadores (reduz falsos positivos).
 */

export type FindingKind = "cpf" | "cnpj" | "email" | "telefone" | "data" | "valor" | "cep";

export interface Finding {
  kind: FindingKind;
  value: string;
  /** Validado por dígito verificador (CPF/CNPJ) ou formato inequívoco. */
  valid: boolean;
  index: number;
}

export const KIND_LABEL: Record<FindingKind, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  data: "Data",
  valor: "Valor monetário",
  cep: "CEP"
};

const digits = (s: string) => s.replace(/\D/g, "");

export function isValidCpf(value: string): boolean {
  const d = digits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCnpj(value: string): boolean {
  const d = digits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

const PATTERNS: { kind: FindingKind; regex: RegExp; validate?: (v: string) => boolean }[] = [
  { kind: "cnpj", regex: /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g, validate: isValidCnpj },
  { kind: "cpf", regex: /(?<![\d/])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\d/])/g, validate: isValidCpf },
  { kind: "email", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: "telefone", regex: /(?<!\d)(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}(?!\d)/g },
  { kind: "cep", regex: /(?<!\d)\d{5}-\d{3}(?!\d)/g },
  { kind: "data", regex: /(?<!\d)(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])\/(?:\d{4}|\d{2})(?!\d)/g },
  { kind: "valor", regex: /R\$\s?-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|(?<![\d.,])\d{1,3}(?:\.\d{3})+,\d{2}(?![\d,])/g }
];

/**
 * Encontra ocorrências no texto. Intervalos já reconhecidos por um padrão mais específico
 * (CNPJ antes de CPF antes de telefone) não são reaproveitados por outro.
 */
export function findPatterns(text: string, kinds?: FindingKind[]): Finding[] {
  const wanted = kinds ? new Set(kinds) : null;
  const taken: [number, number][] = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);
  const findings: Finding[] = [];
  for (const { kind, regex, validate } of PATTERNS) {
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      const valid = validate ? validate(m[0]) : true;
      // CPF/CNPJ inválido sem pontuação é só um número qualquer: ignora.
      if (validate && !valid && !/[./-]/.test(m[0])) continue;
      if (kind === "telefone" && digits(m[0]).length < 10) continue;
      taken.push([start, end]);
      if (!wanted || wanted.has(kind)) findings.push({ kind, value: m[0], valid, index: start });
    }
  }
  return findings.sort((a, b) => a.index - b.index);
}

/** Mascara um valor para exibição em relatórios (ex.: 123.***.***-09). */
export function maskValue(kind: FindingKind, value: string): string {
  if (kind === "email") {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (kind === "cpf" || kind === "cnpj" || kind === "telefone") {
    let seen = 0;
    const total = digits(value).length;
    return value.replace(/\d/g, d => (++seen <= 3 || seen > total - 2 ? d : "*"));
  }
  return value;
}

/** Busca simples, sem diferenciar acentos e maiúsculas. Retorna trechos com contexto. */
export function searchText(text: string, query: string, context = 40): { index: number; snippet: string }[] {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = fold(query.trim());
  if (!q) return [];
  // fold preserva o comprimento após remover os combinantes de NFD? Não sempre: mapeamos índices.
  const map: number[] = [];
  let folded = "";
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]);
    for (let k = 0; k < f.length; k++) map.push(i);
    folded += f;
  }
  const out: { index: number; snippet: string }[] = [];
  let from = 0;
  while (true) {
    const at = folded.indexOf(q, from);
    if (at === -1) break;
    const start = map[at];
    const end = map[Math.min(at + q.length - 1, map.length - 1)] + 1;
    const snippet = `${start > context ? "…" : ""}${text.slice(Math.max(0, start - context), end + context).replace(/\s+/g, " ")}${end + context < text.length ? "…" : ""}`;
    out.push({ index: start, snippet });
    from = at + q.length;
  }
  return out;
}
