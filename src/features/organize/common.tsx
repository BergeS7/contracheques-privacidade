import type { LoadedFile } from "@/components/upload/loadedFile";
import type { useToolFiles } from "@/features/shared/usePageCounts";

export function PageCountNote({ total }: { total: number | null }) {
  if (total === null) return <p className="text-sm text-muted">Lendo o documento...</p>;
  return <p className="text-sm text-muted">Documento com <strong className="text-ink">{total}</strong> página(s).</p>;
}

/** Mensagem enquanto a contagem de páginas não está disponível (ou falhou). */
export function pageCountValidation(tf: ReturnType<typeof useToolFiles>, file?: LoadedFile): string | null {
  if (!file) return null;
  if (tf.failed(file)) return "Não foi possível ler este PDF (corrompido ou protegido).";
  if (tf.total(file) === null) return "Lendo o documento...";
  return null;
}
