import { useEffect, useState } from "react";
import type { LoadedFile } from "@/components/upload/loadedFile";
import { openPdf } from "@/services/pdfjs";

/** Número de páginas de cada PDF (lido com PDF.js, em segundo plano). */
export function usePageCounts(files: LoadedFile[]): Record<string, number | "erro"> {
  const [counts, setCounts] = useState<Record<string, number | "erro">>({});
  useEffect(() => {
    let cancelled = false;
    for (const file of files) {
      if (!file.isPdf || counts[file.id] !== undefined) continue;
      openPdf(file.bytes)
        .then(async ({ doc, close }) => {
          const n = doc.numPages;
          await close();
          if (!cancelled) setCounts(c => ({ ...c, [file.id]: n }));
        })
        .catch(() => !cancelled && setCounts(c => ({ ...c, [file.id]: "erro" })));
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);
  return counts;
}

/** Arquivos da ferramenta + contagem de páginas (para validar intervalos). */
export function useToolFiles() {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const counts = usePageCounts(files);
  const total = (file?: LoadedFile) => {
    const c = file ? counts[file.id] : undefined;
    return typeof c === "number" ? c : null;
  };
  const failed = (file?: LoadedFile) => !!file && counts[file.id] === "erro";
  return { files, setFiles, total, failed };
}

export const pdfInput =(f: LoadedFile) => ({ name: f.name, bytes: f.bytes });
