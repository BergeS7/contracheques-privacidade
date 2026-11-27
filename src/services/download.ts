/** Downloads e ZIP. URLs temporárias são revogadas após o uso. */
import { safeFilename } from "@/core/validation/file";

export function toBlob(bytes: Uint8Array | Blob, mime = "application/pdf"): Blob {
  return bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: mime });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename(filename);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export interface ZipEntry {
  name: string;
  data: Uint8Array | Blob | string;
}

/** Cria um ZIP local (JSZip carregado sob demanda). Nomes repetidos recebem sufixo. */
export async function makeZip(entries: ZipEntry[], onProgress?: (fraction: number) => void): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const entry of entries) {
    const parts = entry.name.split("/").map(p => safeFilename(p));
    let name = parts.join("/");
    if (used.has(name.toLowerCase())) {
      const dot = name.lastIndexOf(".");
      const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
      let i = 2;
      while (used.has(`${base} (${i})${ext}`.toLowerCase())) i++;
      name = `${base} (${i})${ext}`;
    }
    used.add(name.toLowerCase());
    zip.file(name, entry.data);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, meta =>
    onProgress?.(meta.percent / 100)
  );
}

export function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  // Evita injeção de fórmulas ao abrir no Excel.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV com ";" (padrão do Excel em português) e BOM UTF-8. */
export function toCsv(rows: unknown[][]): Blob {
  const text = rows.map(r => r.map(csvEscape).join(";")).join("\r\n");
  return new Blob([String.fromCharCode(0xfeff) + text], { type: "text/csv;charset=utf-8" });
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}
