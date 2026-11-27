/**
 * Operações disponíveis no worker. O último argumento de cada uma é o contexto (progresso),
 * injetado pelo worker. Os demais precisam ser serializáveis (structured clone).
 */
import * as organize from "@/core/pdf/organize";
import * as stamp from "@/core/pdf/stamp";
import * as metadata from "@/core/pdf/metadata";
import { imagesToPdf } from "@/core/conversion/images";
import { textToPdf } from "@/core/conversion/text";
import { buildPayrollPdf } from "@/core/payroll/build";
import { validateOutputOrder, type PayrollUnit } from "@/core/payroll/recognize";
import type { OpContext } from "@/core/pdf/document";

export const operations = {
  composePages: organize.composePages,
  merge: organize.mergePdfs,
  selectPages: organize.selectPages,
  deletePages: organize.deletePages,
  rotatePages: organize.rotatePages,
  reversePages: organize.reversePages,
  duplicatePages: organize.duplicatePages,
  interleave: organize.interleavePdfs,
  splitOddEven: organize.splitOddEven,
  splitByGroups: organize.splitByGroups,
  splitEvery: organize.splitEvery,
  insertBlankPages: organize.insertBlankPages,
  resizePages: organize.resizePages,
  pageCount: organize.pageCount,
  watermark: stamp.addWatermark,
  pageNumbers: stamp.addPageNumbers,
  headerFooter: stamp.addHeaderFooter,
  inspect: metadata.inspectPdf,
  removeMetadata: metadata.removeMetadata,
  imagesToPdf,
  textToPdf,
  async payrollCombined(sources: Uint8Array[], order: PayrollUnit[], pagesPerDoc: number[], ctx: OpContext) {
    validateOutputOrder(order, pagesPerDoc);
    ctx.onProgress?.(0.2, "Gerando PDF organizado");
    return buildPayrollPdf(sources, order);
  },
  async payrollPerGroup(sources: Uint8Array[], groups: PayrollUnit[][], ctx: OpContext) {
    const out: Uint8Array[] = [];
    for (const [i, units] of groups.entries()) {
      out.push((await buildPayrollPdf(sources, units)).pdfBytes);
      ctx.onProgress?.((i + 1) / groups.length, `PDF ${i + 1} de ${groups.length}`);
    }
    return out;
  }
};

export type Operations = typeof operations;
export type OperationName = keyof Operations;
