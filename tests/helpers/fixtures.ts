// Documentos SINTÉTICOS para testes. Nomes, CPFs e valores são fictícios.
import { PDFDocument, StandardFonts, PDFFont, PDFPage, degrees, rgb } from "pdf-lib";

export interface FakeEmployee {
  code: string;
  name: string;
}

const LABELS = [
  "EMPRESA EXEMPLO COMERCIO LTDA",
  "Recibo de Pagamento de Salario",
  "Vencimentos",
  "Descontos",
  "Valor Liquido",
  "Assinatura do Funcionario"
];

/** Desenha um contracheque fictício com o topo em yTop (≈ 340 pt de altura). */
export function drawSlip(page: PDFPage, font: PDFFont, yTop: number, emp: FakeEmployee) {
  const t = (text: string, x: number, y: number, size = 10) => page.drawText(text, { x, y, size, font });
  t(LABELS[0], 40, yTop, 12);
  t(LABELS[1], 40, yTop - 20);
  t(`${emp.code} - ${emp.name}`, 40, yTop - 50);
  t("CPF: 000.000.000-00", 330, yTop - 50);
  t("Cargo: Auxiliar Administrativo", 40, yTop - 70);
  t(LABELS[2], 40, yTop - 110);
  t("Salario Base 1.000,00", 40, yTop - 130);
  t(LABELS[3], 300, yTop - 110);
  t("INSS 75,00", 300, yTop - 130);
  t(LABELS[4], 40, yTop - 300);
  t("925,00", 300, yTop - 300);
  t(LABELS[5], 40, yTop - 330);
}

/** Uma pessoa por folha (A4). */
export async function singleSlipPdf(employees: FakeEmployee[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const emp of employees) {
    const page = doc.addPage([595, 842]);
    drawSlip(page, font, 800, emp);
  }
  return doc.save();
}

/**
 * Duas vias por folha: cada item é [cima, baixo]. `null` deixa a metade vazia.
 * Passo vertical entre os dois contracheques: 421 pt (metade de A4).
 */
export async function doubleSlipPdf(sheets: [FakeEmployee | null, FakeEmployee | null][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const [top, bottom] of sheets) {
    const page = doc.addPage([595, 842]);
    if (top) drawSlip(page, font, 800, top);
    if (bottom) drawSlip(page, font, 379, bottom);
  }
  return doc.save();
}

/** PDF genérico com N páginas numeradas ("Pagina 1", ...) e tamanhos opcionais. */
export async function numberedPdf(count: number, sizes?: [number, number][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < count; i++) {
    const size = sizes?.[i % sizes.length] ?? [595, 842];
    const page = doc.addPage(size);
    page.drawText(`Pagina ${i + 1}`, { x: 50, y: size[1] - 80, size: 24, font, color: rgb(0, 0, 0) });
  }
  return doc.save();
}

/** Página sem nenhum texto (simula digitalização). */
export async function appendBlankPage(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.addPage([595, 842]);
  page.drawRectangle({ x: 50, y: 50, width: 100, height: 100, color: rgb(0.8, 0.8, 0.8) });
  return doc.save();
}

export async function rotatedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText("Rotacionada", { x: 50, y: 700, size: 20, font });
  page.setRotation(degrees(90));
  return doc.save();
}

/** Converte texto WinAnsi em hex como o pdf-lib grava (para procurar texto oculto nos fluxos). */
export function winAnsiHex(text: string): string {
  return [...text].map(ch => ch.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase()).join("");
}
