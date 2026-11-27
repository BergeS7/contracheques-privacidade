import { formatBytes, LIMITS, hasPdfHeader, detectImageKind } from "@/core/validation/file";

export interface LoadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  bytes: Uint8Array;
  isPdf: boolean;
  /** Indícios estruturais detectados na leitura (sem abrir o documento). */
  encrypted: boolean;
  signed: boolean;
  hasJs: boolean;
}

/** Procura uma sequência ASCII nos bytes sem decodificar o arquivo inteiro. */
export function containsAscii(bytes: Uint8Array, needle: string): boolean {
  const n = Array.from(needle, c => c.charCodeAt(0));
  const first = n[0];
  outer: for (let i = bytes.indexOf(first); i !== -1 && i <= bytes.length - n.length; i = bytes.indexOf(first, i + 1)) {
    for (let k = 1; k < n.length; k++) if (bytes[i + k] !== n[k]) continue outer;
    return true;
  }
  return false;
}

let counter = 0;

export async function loadFile(file: File): Promise<LoadedFile> {
  if (file.size === 0) throw new Error(`${file.name}: o arquivo está vazio.`);
  if (file.size > LIMITS.maxFileBytes) throw new Error(`${file.name}: arquivo muito grande (${formatBytes(file.size)}).`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = hasPdfHeader(bytes);
  return {
    id: `f${Date.now().toString(36)}${(counter++).toString(36)}`,
    name: file.name,
    size: file.size,
    type: file.type,
    bytes,
    isPdf,
    encrypted: isPdf && containsAscii(bytes, "/Encrypt"),
    signed: isPdf && containsAscii(bytes, "/ByteRange"),
    hasJs: isPdf && (containsAscii(bytes, "/JavaScript") || containsAscii(bytes, "/JS "))
  };
}

/** Confere se o arquivo combina com o `accept` da ferramenta (pelo conteúdo, quando possível). */
export function matchesAccept(file: LoadedFile, accept: string): boolean {
  const wantsPdf = accept.includes("pdf");
  const wantsImage = accept.includes("image/");
  const wantsText = accept.includes("text/");
  if (wantsPdf && file.isPdf) return true;
  if (wantsImage) {
    const kind = detectImageKind(file.bytes);
    if (kind && accept.includes(kind === "jpeg" ? "jpeg" : kind)) return true;
  }
  if (wantsText && (/\.txt$/i.test(file.name) || file.type.startsWith("text/"))) return true;
  return false;
}
