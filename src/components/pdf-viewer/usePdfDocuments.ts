import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { openPdf } from "@/services/pdfjs";
import type { LoadedFile } from "@/components/upload/loadedFile";

/** Abre vários PDFs no PDF.js (por id de arquivo). Fecha os que saem da lista e todos ao desmontar. */
export function usePdfDocuments(files: LoadedFile[]) {
  const [docs, setDocs] = useState<Record<string, PDFDocumentProxy | "erro">>({});
  const closers = useRef(new Map<string, () => Promise<void>>());
  const opening = useRef(new Set<string>());

  useEffect(() => {
    const ids = new Set(files.map(f => f.id));
    for (const [id, close] of closers.current) {
      if (!ids.has(id)) {
        void close();
        closers.current.delete(id);
        setDocs(d => { const n = { ...d }; delete n[id]; return n; });
      }
    }
    for (const file of files) {
      if (closers.current.has(file.id) || opening.current.has(file.id)) continue;
      opening.current.add(file.id);
      openPdf(file.bytes)
        .then(({ doc, close }) => {
          closers.current.set(file.id, close);
          setDocs(d => ({ ...d, [file.id]: doc }));
        })
        .catch(() => setDocs(d => ({ ...d, [file.id]: "erro" })))
        .finally(() => opening.current.delete(file.id));
    }
  }, [files]);

  useEffect(() => {
    const map = closers.current;
    return () => {
      for (const close of map.values()) void close();
      map.clear();
    };
  }, []);

  return docs;
}
