/**
 * Monta o PDF final dos contracheques a partir das unidades ordenadas.
 * - Folhas inteiras são copiadas sem recorte, escala, rotação ou alteração de conteúdo.
 * - Metades viram Form XObjects vetoriais com o texto da outra metade APAGADO do fluxo.
 * - A cópia da página inteira usada para gerar metades é removida do arquivo final.
 * Portado de extensao/app.js (v1.2.0), generalizado para vários documentos de entrada.
 */
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFRef,
  PDFRawStream,
  PDFPage,
  decodePDFRawStream,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  drawObject
} from "pdf-lib";
import { removeTextOutside } from "../pdf/contentFilter";
import type { PayrollUnit } from "./recognize";

interface Half {
  formRef: PDFRef;
  box: { x: number; y: number; width: number; height: number };
  bottom: number;
  top: number;
  extent: [number, number] | null | undefined;
}

export interface BuildResult {
  pdfBytes: Uint8Array;
  pageCount: number;
}

/** Junta os fluxos de conteúdo de uma página (pode ser um array de streams). */
function contentBytes(doc: PDFDocument, page: PDFPage): Uint8Array {
  const contents = page.node.Contents();
  if (!contents) return new Uint8Array();
  const streams = contents instanceof PDFArray
    ? contents.asArray().map(ref => doc.context.lookup(ref))
    : [contents];
  const parts = streams
    .filter((s): s is PDFRawStream => s instanceof PDFRawStream)
    .map(stream => decodePDFRawStream(stream).decode());
  const joined = new Uint8Array(parts.reduce((sum, p) => sum + p.length + 1, 0));
  let offset = 0;
  for (const p of parts) { joined.set(p, offset); offset += p.length; joined[offset++] = 0x0a; }
  return joined;
}

export async function buildPayrollPdf(sources: Uint8Array[], order: PayrollUnit[]): Promise<BuildResult> {
  const outDoc = await PDFDocument.create();
  outDoc.setProducer("TudoPDF — by BergeS7");
  outDoc.setCreator("TudoPDF");

  // Uma única cópia das páginas necessárias de cada documento: recursos compartilhados entram uma vez.
  const copyOf = new Map<string, PDFPage>();
  const docIndexes = [...new Set(order.map(u => u.docIndex))];
  for (const docIndex of docIndexes) {
    const srcDoc = await PDFDocument.load(sources[docIndex], { updateMetadata: false });
    const needed = [...new Set(order.filter(u => u.docIndex === docIndex).map(u => u.pageNumber))];
    const copies = await outDoc.copyPages(srcDoc, needed.map(n => n - 1));
    needed.forEach((n, i) => copyOf.set(`${docIndex}:${n}`, copies[i]));
  }
  const pageKey = (u: PayrollUnit) => `${u.docIndex}:${u.pageNumber}`;
  const splitPages = new Set(order.filter(u => u.part !== "whole").map(pageKey));

  function makeHalf(unit: PayrollUnit, copied: PDFPage): Half {
    const box = copied.getMediaBox();
    const split = unit.split as number;
    const [bottom, top] = unit.part === "top" ? [split, box.y + box.height] : [box.y, split];
    const filtered = removeTextOutside(
      contentBytes(outDoc, copied),
      unit.part === "top" ? y => y > split : y => y <= split
    );
    const form = outDoc.context.flateStream(filtered, {
      Type: "XObject",
      Subtype: "Form",
      BBox: [box.x, bottom, box.x + box.width, top],
      Resources: copied.node.Resources()
    });
    return { formRef: outDoc.context.register(form), box, bottom, top, extent: unit.extent };
  }

  function discardPage(copied: PDFPage) {
    const contentsEntry = copied.node.get(PDFName.of("Contents"));
    const contentRefs = contentsEntry instanceof PDFArray ? contentsEntry.asArray() : [contentsEntry];
    for (const ref of contentRefs) if (ref instanceof PDFRef) outDoc.context.delete(ref);
    outDoc.context.delete(copied.ref);
  }

  // Na folha nova, a metade de cima encosta no topo e a de baixo no pé da folha.
  const upperShift = (half: Half, height: number) => height - (half.top - half.box.y);
  const lowerShift = (half: Half) => -(half.bottom - half.box.y);

  // Só junta duas metades na mesma folha se os textos não se sobrepuserem (folga de 4 pt).
  function fitsTogether(upper: Half, lower: Half): boolean {
    if (!upper.extent || !lower.extent) return true;
    const height = upper.box.height;
    const upperLowest = upper.extent[0] - upper.box.y + upperShift(upper, height);
    const lowerHighest = lower.extent[1] - lower.box.y + lowerShift(lower);
    return lower.box.height === height && lower.box.width === upper.box.width && lowerHighest + 4 <= upperLowest;
  }

  function drawHalf(page: PDFPage, half: Half, shift: number) {
    const name = page.node.newXObject("Metade", half.formRef);
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(1, 0, 0, 1, -half.box.x, shift - half.box.y),
      drawObject(name),
      popGraphicsState()
    );
  }

  function addHalfPage(upper: Half, lower: Half | null) {
    const { width, height } = upper.box;
    const page = outDoc.addPage([width, height]);
    drawHalf(page, upper, upperShift(upper, height));
    if (lower) drawHalf(page, lower, lowerShift(lower));
  }

  let pending: Half | null = null;
  for (const unit of order) {
    const copied = copyOf.get(pageKey(unit))!;
    if (unit.part === "whole") {
      if (pending) addHalfPage(pending, null);
      pending = null;
      // Uma página inteira pode ser pedida por mais de um grupo apenas em exportações parciais
      // (nunca no PDF completo, garantido por validateOutputOrder).
      outDoc.addPage(copied);
      continue;
    }
    const half = makeHalf(unit, copied);
    if (pending && fitsTogether(pending, half)) {
      addHalfPage(pending, half);
      pending = null;
    } else {
      if (pending) addHalfPage(pending, null);
      pending = half;
    }
  }
  if (pending) addHalfPage(pending, null);
  for (const key of splitPages) {
    // Se a mesma folha também entrou inteira (não ocorre no fluxo validado), não pode ser apagada.
    const usedWhole = order.some(u => u.part === "whole" && pageKey(u) === key);
    if (!usedWhole) discardPage(copyOf.get(key)!);
  }

  const pdfBytes = await outDoc.save({
    useObjectStreams: false, // maximiza compatibilidade com leitores antigos
    addDefaultPage: false,
    updateFieldAppearances: false
  });
  return { pdfBytes, pageCount: outDoc.getPageCount() };
}
