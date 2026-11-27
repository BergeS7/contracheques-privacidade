/// <reference lib="webworker" />
/**
 * Worker de processamento: executa as operações do pdf-lib fora da thread principal.
 * Cada tarefa roda em um worker novo; cancelar = encerrar o worker (libera toda a memória).
 * Nenhuma operação aqui acessa a rede.
 */
import { operations, type OperationName } from "./operations";
import { describeError } from "@/core/errors";
import { TudoPdfError } from "@/core/errors";

interface JobMessage {
  op: OperationName;
  args: unknown[];
}

self.onmessage = async (event: MessageEvent<JobMessage>) => {
  const { op, args } = event.data;
  const fn = operations[op] as ((...a: unknown[]) => Promise<unknown>) | undefined;
  if (!fn) {
    self.postMessage({ type: "error", message: `Operação desconhecida: ${op}`, code: "INVALID_INPUT" });
    return;
  }
  const ctx = {
    onProgress: (fraction: number, message?: string) => self.postMessage({ type: "progress", fraction, message })
  };
  try {
    const value = await fn(...args, ctx);
    self.postMessage({ type: "result", value }, collectTransferables(value));
  } catch (error) {
    self.postMessage({
      type: "error",
      message: describeError(error),
      code: error instanceof TudoPdfError ? error.code : undefined
    });
  }
};

/** Transfere (sem copiar) os buffers do resultado para a thread principal. */
function collectTransferables(value: unknown, out: Transferable[] = [], seen = new Set<unknown>()): Transferable[] {
  if (!value || typeof value !== "object" || seen.has(value)) return out;
  seen.add(value);
  if (value instanceof Uint8Array) {
    if (!out.includes(value.buffer as ArrayBuffer)) out.push(value.buffer as ArrayBuffer);
    return out;
  }
  if (Array.isArray(value)) value.forEach(v => collectTransferables(v, out, seen));
  else Object.values(value).forEach(v => collectTransferables(v, out, seen));
  return out;
}
