/** Ordem alfabética "natural" de nomes de arquivo (pt-BR, ignora acentos e caixa, 2 < 10). */
export function compareFilenames(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true });
}
