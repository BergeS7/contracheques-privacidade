/**
 * Inspeção e remoção de metadados, e diagnóstico do arquivo (criptografia, assinaturas,
 * JavaScript embutido, formulários, integridade estrutural).
 */
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString, PDFRef, EncryptedPDFError } from "pdf-lib";
import { hasEofMarker, hasPdfHeader, validatePdfBytes } from "../validation/file";
import { loadPdf, saveDocument, type PdfInput, type OpContext } from "./document";

export interface PdfInfo {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

export interface PdfInspection {
  ok: boolean;
  fileSize: number;
  pdfVersion: string | null;
  pageCount: number | null;
  encrypted: boolean;
  hasXmpMetadata: boolean;
  info: PdfInfo;
  hasDigitalSignatures: boolean;
  signatureCount: number;
  hasJavaScript: boolean;
  hasForms: boolean;
  hasEmbeddedFiles: boolean;
  hasEofMarker: boolean;
  incrementalUpdates: number;
  pageSizes: { width: number; height: number; count: number }[];
  problems: string[];
}

const latin1 = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

function countOccurrences(haystack: string, needle: RegExp): number {
  return (haystack.match(needle) || []).length;
}

/** Diagnóstico sem alterar o arquivo. Nunca lança para arquivos corrompidos: reporta em `problems`. */
export async function inspectPdf(input: PdfInput, _ctx: OpContext = {}): Promise<PdfInspection> {
  const { bytes } = input;
  const text = latin1(bytes);
  const result: PdfInspection = {
    ok: true,
    fileSize: bytes.length,
    pdfVersion: /%PDF-(\d\.\d)/.exec(text.slice(0, 1024))?.[1] ?? null,
    pageCount: null,
    encrypted: /\/Encrypt\s/.test(text),
    hasXmpMetadata: /\/Type\s*\/Metadata/.test(text),
    info: {},
    hasDigitalSignatures: false,
    signatureCount: 0,
    hasJavaScript: /\/(JavaScript|JS)\s*[(<[/]/.test(text),
    hasForms: /\/AcroForm\b/.test(text),
    hasEmbeddedFiles: /\/EmbeddedFiles\b/.test(text),
    hasEofMarker: hasEofMarker(bytes),
    incrementalUpdates: Math.max(0, countOccurrences(text, /%%EOF/g) - 1),
    pageSizes: [],
    problems: []
  };
  // Assinaturas digitais: dicionários /Type /Sig com /ByteRange (ou campos /FT /Sig).
  result.signatureCount = countOccurrences(text, /\/ByteRange\s*\[/g);
  result.hasDigitalSignatures = result.signatureCount > 0 || /\/FT\s*\/Sig\b/.test(text);

  if (!bytes.length) {
    result.ok = false;
    result.problems.push("Arquivo vazio.");
    return result;
  }
  if (!hasPdfHeader(bytes)) {
    result.ok = false;
    result.problems.push("Cabeçalho %PDF ausente: não é um PDF.");
    return result;
  }
  if (!result.hasEofMarker) result.problems.push("Marcador %%EOF ausente: o arquivo pode estar truncado.");

  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true, throwOnInvalidObject: true });
    result.pageCount = doc.getPageCount();
    if (!result.encrypted) {
      result.info = {
        title: doc.getTitle(),
        author: doc.getAuthor(),
        subject: doc.getSubject(),
        keywords: doc.getKeywords(),
        creator: doc.getCreator(),
        producer: doc.getProducer(),
        creationDate: doc.getCreationDate()?.toLocaleString("pt-BR"),
        modificationDate: doc.getModificationDate()?.toLocaleString("pt-BR")
      };
    }
    const sizes = new Map<string, { width: number; height: number; count: number }>();
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      const key = `${Math.round(width)}x${Math.round(height)}`;
      const entry = sizes.get(key) ?? { width: Math.round(width), height: Math.round(height), count: 0 };
      entry.count++;
      sizes.set(key, entry);
    }
    result.pageSizes = [...sizes.values()];
  } catch (error) {
    result.ok = false;
    result.problems.push(
      error instanceof EncryptedPDFError
        ? "Arquivo criptografado: não é possível ler a estrutura sem a senha."
        : "Estrutura interna inválida: o arquivo está corrompido ou malformado."
    );
  }
  if (result.encrypted) result.problems.push("O arquivo está criptografado (protegido por senha ou com restrições).");
  if (result.hasJavaScript) result.problems.push("Contém JavaScript embutido. O TudoPDF nunca executa esses scripts.");
  return result;
}

/**
 * Remove metadados: dicionário Info, fluxo XMP do catálogo e das páginas, PieceInfo.
 * O conteúdo visível não é alterado.
 */
export async function removeMetadata(input: PdfInput, _ctx: OpContext = {}): Promise<Uint8Array> {
  validatePdfBytes(input.bytes, input.name);
  const doc = await loadPdf(input.bytes, { name: input.name });
  // Info: remove o dicionário inteiro (loadPdf usa updateMetadata:false, então o pdf-lib
  // não recria datas nem produtor ao salvar).
  const infoRef = doc.context.trailerInfo.Info;
  if (infoRef instanceof PDFRef) doc.context.delete(infoRef);
  doc.context.trailerInfo.Info = undefined;
  const removeKey = (dict: PDFDict, key: string) => {
    const value = dict.get(PDFName.of(key));
    if (value instanceof PDFRef) doc.context.delete(value);
    dict.delete(PDFName.of(key));
  };
  removeKey(doc.catalog, "Metadata");
  removeKey(doc.catalog, "PieceInfo");
  for (const page of doc.getPages()) {
    removeKey(page.node, "Metadata");
    removeKey(page.node, "PieceInfo");
  }
  return saveDocument(doc);
}

/** Lista as chaves presentes no dicionário Info (útil para conferir a remoção). */
export async function infoKeys(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  const ref = doc.context.trailerInfo.Info;
  if (!ref) return [];
  const info = doc.context.lookup(ref);
  if (!(info instanceof PDFDict)) return [];
  return info.keys().map(k => k.asString()).filter(k => {
    const v = info.get(PDFName.of(k.replace(/^\//, "")));
    if (v instanceof PDFString || v instanceof PDFHexString) return v.decodeText() !== "";
    return v !== undefined && !(v instanceof PDFArray && v.size() === 0);
  });
}
