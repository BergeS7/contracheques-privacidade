import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { openPdf } from "@/services/pdfjs";
import { describeError } from "@/core/errors";

/** Abre um PDF no PDF.js enquanto o componente existir; libera ao trocar ou desmontar. */
export function usePdfDocument(bytes: Uint8Array | null | undefined) {
  const [state, setState] = useState<{ doc: PDFDocumentProxy | null; error: string | null; forBytes: Uint8Array | null }>({ doc: null, error: null, forBytes: null });

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    let close: (() => Promise<void>) | null = null;
    openPdf(bytes)
      .then(opened => {
        if (cancelled) { opened.close(); return; }
        close = opened.close;
        setState({ doc: opened.doc, error: null, forBytes: bytes });
      })
      .catch(err => { if (!cancelled) setState({ doc: null, error: describeError(err), forBytes: bytes }); });
    return () => {
      cancelled = true;
      close?.();
    };
  }, [bytes]);

  // Estado de outro arquivo (troca em andamento) não é exposto.
  if (!bytes || state.forBytes !== bytes) return { doc: null, error: null, loading: !!bytes };
  return { doc: state.doc, error: state.error, loading: false };
}
