import { PDFDocument, EncryptedPDFError } from "pdf-lib";
import { TudoPdfError } from "../errors";
import { LIMITS, validatePdfBytes } from "../validation/file";

export interface LoadOptions {
  name?: string;
}

/**
 * Abre um PDF com o pdf-lib, validando antes e convertendo erros em mensagens claras.
 * O pdf-lib não executa JavaScript embutido: scripts do documento nunca rodam.
 */
export async function loadPdf(bytes: Uint8Array, options: LoadOptions = {}): Promise<PDFDocument> {
  const name = options.name ?? "arquivo";
  validatePdfBytes(bytes, name);
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });
  } catch (error) {
    if (error instanceof EncryptedPDFError) {
      throw new TudoPdfError("ENCRYPTED", `${name}: o PDF está protegido por senha. Remova a proteção antes de continuar.`);
    }
    throw new TudoPdfError("CORRUPTED", `${name}: não foi possível ler o PDF (arquivo corrompido ou malformado).`);
  }
  const pages = doc.getPageCount();
  if (pages === 0) throw new TudoPdfError("CORRUPTED", `${name}: o PDF não tem páginas.`);
  if (pages > LIMITS.maxPages) {
    throw new TudoPdfError("LIMIT", `${name}: ${pages} páginas excedem o limite de ${LIMITS.maxPages} por documento.`);
  }
  return doc;
}

export async function newDocument(): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.setProducer("TudoPDF — by BergeS7");
  doc.setCreator("TudoPDF");
  return doc;
}

export async function saveDocument(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
}

export interface PdfInput {
  name: string;
  bytes: Uint8Array;
}

export interface PdfOutput {
  name: string;
  bytes: Uint8Array;
  mime: string;
}

export type ProgressFn = (fraction: number, message?: string) => void;

export interface OpContext {
  signal?: AbortSignal;
  onProgress?: ProgressFn;
}
