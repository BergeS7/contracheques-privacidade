/**
 * Arquivos soltos na página inicial, entregues à ferramenta escolhida.
 * Ficam só em memória e são consumidos uma única vez.
 */
let pending: File[] = [];

export function setPendingFiles(files: File[]) {
  pending = files;
}

export function takePendingFiles(): File[] {
  const files = pending;
  pending = [];
  return files;
}
