/**
 * Executa operações pesadas em um Web Worker dedicado, com progresso real e cancelamento.
 */
import type { Operations, OperationName } from "@/workers/operations";
import { TudoPdfError, type ErrorCode } from "@/core/errors";

type DropLast<T extends unknown[]> = T extends [...infer Head, unknown] ? Head : T;
type OpArgs<K extends OperationName> = DropLast<Parameters<Operations[K]>>;
type OpResult<K extends OperationName> = Awaited<ReturnType<Operations[K]>>;

export interface JobOptions {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

export function runJob<K extends OperationName>(op: K, args: OpArgs<K>, options: JobOptions = {}): Promise<OpResult<K>> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new TudoPdfError("CANCELLED", "Operação cancelada."));
      return;
    }
    const worker = new Worker(new URL("../workers/pdf.worker.ts", import.meta.url), { type: "module", name: `tudopdf-${op}` });
    const finish = () => {
      worker.terminate();
      options.signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      finish();
      reject(new TudoPdfError("CANCELLED", "Operação cancelada."));
    };
    options.signal?.addEventListener("abort", onAbort);
    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data as { type: string; fraction?: number; message?: string; value?: unknown; code?: ErrorCode };
      if (msg.type === "progress") options.onProgress?.(msg.fraction ?? 0, msg.message);
      else if (msg.type === "result") { finish(); resolve(msg.value as OpResult<K>); }
      else if (msg.type === "error") { finish(); reject(new TudoPdfError(msg.code ?? "INVALID_INPUT", msg.message ?? "Erro desconhecido.")); }
    };
    worker.onerror = event => {
      finish();
      reject(new TudoPdfError("INVALID_INPUT", `Falha no processamento: ${event.message || "erro no worker"}`));
    };
    // Os dados de entrada são copiados (structured clone): os arquivos originais continuam disponíveis
    // para novas operações na mesma tela.
    worker.postMessage({ op, args });
  });
}
