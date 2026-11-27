/** Erros do motor de processamento, com mensagens em português prontas para a interface. */
export type ErrorCode =
  | "EMPTY_FILE"
  | "NOT_PDF"
  | "TOO_LARGE"
  | "ENCRYPTED"
  | "CORRUPTED"
  | "INVALID_INPUT"
  | "UNSUPPORTED"
  | "CANCELLED"
  | "LIMIT";

export class TudoPdfError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "TudoPdfError";
    this.code = code;
  }
}

export const cancelled = () => new TudoPdfError("CANCELLED", "Operação cancelada.");

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw cancelled();
}

export function isCancelError(error: unknown): boolean {
  return (
    (error instanceof TudoPdfError && error.code === "CANCELLED") ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && (error as { code?: string }).code === "CANCELLED")
  );
}

/** Mensagem amigável para qualquer erro (sem expor conteúdo dos documentos). */
export function describeError(error: unknown): string {
  if (error instanceof TudoPdfError) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = String((error as { message: unknown }).message);
    if (/encrypt/i.test(msg)) return "O PDF está protegido por senha ou criptografado.";
    if (/password/i.test(msg)) return "Senha incorreta ou ausente.";
    if (/Invalid PDF|Failed to parse|No PDF header|parse/i.test(msg)) return "O arquivo parece estar corrompido ou não é um PDF válido.";
    return msg;
  }
  return String(error);
}
