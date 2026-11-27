/**
 * Validação de arquivos de entrada. Todo arquivo é tratado como não confiável.
 */
import { TudoPdfError } from "../errors";

/** Limites de segurança (memória do navegador). */
export const LIMITS = {
  maxFileBytes: 500 * 1024 * 1024,
  maxTotalBytes: 1024 * 1024 * 1024,
  maxFiles: 500,
  maxPages: 5000,
  maxImagePixels: 80_000_000
} as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

/** Um PDF válido começa com "%PDF-" (tolerando lixo inicial de até 1 KB, como os leitores fazem). */
export function hasPdfHeader(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length - 5, 1024);
  for (let i = 0; i <= limit; i++) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2d) {
      return true;
    }
  }
  return false;
}

/** Procura o marcador %%EOF no final do arquivo (arquivos truncados costumam não ter). */
export function hasEofMarker(bytes: Uint8Array): boolean {
  const tail = new TextDecoder("latin1").decode(bytes.subarray(Math.max(0, bytes.length - 2048)));
  return tail.includes("%%EOF");
}

export function validatePdfBytes(bytes: Uint8Array, name = "arquivo"): void {
  if (!bytes || bytes.length === 0) throw new TudoPdfError("EMPTY_FILE", `${name}: o arquivo está vazio.`);
  if (bytes.length > LIMITS.maxFileBytes) {
    throw new TudoPdfError("TOO_LARGE", `${name}: arquivo muito grande (${formatBytes(bytes.length)}). Limite: ${formatBytes(LIMITS.maxFileBytes)}.`);
  }
  if (!hasPdfHeader(bytes)) throw new TudoPdfError("NOT_PDF", `${name}: não é um arquivo PDF válido.`);
}

const IMAGE_SIGNATURES: { type: ImageKind; test: (b: Uint8Array) => boolean }[] = [
  { type: "jpeg", test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "png", test: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "webp", test: b => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { type: "gif", test: b => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { type: "bmp", test: b => b[0] === 0x42 && b[1] === 0x4d }
];

export type ImageKind = "jpeg" | "png" | "webp" | "gif" | "bmp";

/** Identifica a imagem pelo conteúdo (não pela extensão). */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  return IMAGE_SIGNATURES.find(s => s.test(bytes))?.type ?? null;
}

/** Nome de arquivo seguro para download (sem caracteres reservados do Windows). */
export function safeFilename(name: string, fallback = "documento"): string {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]/g, " ")
    .split("").map(ch => (ch.charCodeAt(0) < 32 ? " " : ch)).join("")
    .replace(/\s+/g, " ")
    .replace(/^[ .]+|[ .]+$/g, "")
    .slice(0, 150);
  return cleaned || fallback;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]{1,5}$/i, "");
}
