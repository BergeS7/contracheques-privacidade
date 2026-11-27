import { safeFilename, stripExtension } from "../validation/file";
import type { PayrollGroup } from "./recognize";

/**
 * Nome de arquivo de um funcionário a partir de um padrão:
 * {nome}, {codigo}, {n} (posição com zeros à esquerda) e {arquivo} (PDF de origem, sem extensão).
 */
export function fillPattern(pattern: string, group: Pick<PayrollGroup, "name" | "code">, index: number, total: number, firstDoc: string): string {
  const name = group.name ?? "Sem identificação";
  const out = pattern
    .replaceAll("{nome}", name)
    .replaceAll("{codigo}", group.code ?? "")
    .replaceAll("{n}", String(index + 1).padStart(String(total).length, "0"))
    .replaceAll("{arquivo}", stripExtension(firstDoc))
    .replace(/(\s*-\s*){2,}/g, " - ")
    .replace(/^[\s-]+|[\s-]+$/g, "");
  return `${safeFilename(out || name)}.pdf`;
}
