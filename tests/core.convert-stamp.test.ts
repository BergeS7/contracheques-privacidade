import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { deflateSync } from "node:zlib";
import { imagesToPdf } from "../src/core/conversion/images";
import { textToPdf, extractTextPages, pagesToTxt, pagesToMarkdown } from "../src/core/conversion/text";
import { addWatermark, addPageNumbers, addHeaderFooter } from "../src/core/pdf/stamp";
import { inspectPdf, removeMetadata, infoKeys } from "../src/core/pdf/metadata";
import { findPatterns, isValidCpf, isValidCnpj, maskValue, searchText } from "../src/core/recognition/patterns";
import { numberedPdf, rotatedPdf } from "./helpers/fixtures";
import { pageTexts, openTextDoc } from "./helpers/pdfjs-node";

/** PNG 2x1 válido gerado na hora (sem arquivos binários no repositório). */
function tinyPng(): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.from([0, 255, 0, 0, 0, 0, 255]);
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

describe("conversões", () => {
  it("imagens → PDF (tamanho da imagem e A4)", async () => {
    const png = tinyPng();
    const fit = await PDFDocument.load(await imagesToPdf([{ name: "a.png", bytes: png }], { pageSize: "fit", orientation: "auto", margin: 0 }));
    expect(fit.getPage(0).getSize()).toEqual({ width: 2, height: 1 });
    const a4 = await PDFDocument.load(await imagesToPdf([{ name: "a.png", bytes: png }, { name: "b.png", bytes: png }], { pageSize: "A4", orientation: "portrait", margin: 20 }));
    expect(a4.getPageCount()).toBe(2);
    expect(Math.round(a4.getPage(0).getWidth())).toBe(595);
  });
  it("rejeita imagem inválida com mensagem clara", async () => {
    await expect(imagesToPdf([{ name: "x.png", bytes: new TextEncoder().encode("não é imagem") }], { pageSize: "fit", orientation: "auto", margin: 0 }))
      .rejects.toThrow(/não suportado/);
  });
  it("TXT → PDF com acentos e quebra de linha automática, e volta para TXT", async () => {
    const text = "Relatório de conferência — ação: OK\n" + "palavra ".repeat(200) + "\nEmoji 😀 vira interrogação";
    const pdf = await textToPdf(text, { pageSize: "A4", fontSize: 11, margin: 50, font: "Helvetica" });
    const doc = await openTextDoc(pdf);
    const pages = await extractTextPages(doc);
    const txt = pagesToTxt(pages);
    expect(txt).toContain("Relatório de conferência");
    expect(txt).toContain("ação: OK");
    expect(txt).toContain("Emoji ? vira");
    expect(pages[0].lines.length).toBeGreaterThan(5);
  });
  it("PDF → Markdown identifica títulos", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    page.drawText("Titulo Principal", { x: 50, y: 780, size: 24, font });
    page.drawText("Texto do corpo em tamanho normal.", { x: 50, y: 740, size: 11, font });
    page.drawText("Mais uma linha do corpo.", { x: 50, y: 725, size: 11, font });
    const md = pagesToMarkdown(await extractTextPages(await openTextDoc(await doc.save())));
    expect(md).toMatch(/^# Titulo Principal/m);
    expect(md).toContain("Texto do corpo em tamanho normal. Mais uma linha do corpo.");
  });
});

describe("marca-d'água, numeração e cabeçalho", () => {
  it("numera páginas com formato personalizado", async () => {
    const out = await addPageNumbers({ name: "a.pdf", bytes: await numberedPdf(3) }, { position: "bottom-center", format: "Página {n} de {total}", startAt: 1, size: 10, margin: 30, color: "#000000" });
    const texts = await pageTexts(out);
    expect(texts[2]).toContain("Página 3 de 3");
  });
  it("aplica marca-d'água em páginas selecionadas, inclusive rotacionadas", async () => {
    const out = await addWatermark({ name: "a.pdf", bytes: await numberedPdf(2) }, { text: "CONFIDENCIAL", size: 48, color: "#d62828", opacity: 0.2, rotation: 45, layout: "center", pages: [2] });
    const texts = await pageTexts(out);
    expect(texts[0]).not.toContain("CONFIDENCIAL");
    expect(texts[1]).toContain("CONFIDENCIAL");
    const rot = await addWatermark({ name: "r.pdf", bytes: await rotatedPdf() }, { text: "COPIA", size: 30, color: "#000000", opacity: 0.3, rotation: 0, layout: "tile" });
    expect((await pageTexts(rot))[0]).toContain("COPIA");
  });
  it("adiciona cabeçalho e rodapé com variáveis", async () => {
    const out = await addHeaderFooter({ name: "rel.pdf", bytes: await numberedPdf(2) }, { header: "{arquivo}", footer: "{n}/{total}", align: "right", size: 9, margin: 20, color: "#333333" });
    const texts = await pageTexts(out);
    expect(texts[1]).toContain("rel.pdf");
    expect(texts[1]).toContain("2/2");
  });
});

describe("metadados e diagnóstico", () => {
  it("inspeciona e remove metadados de verdade", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setTitle("Folha Interna");
    doc.setAuthor("Fulano de Tal");
    const bytes = await doc.save();
    const info = await inspectPdf({ name: "a.pdf", bytes });
    expect(info.info.author).toBe("Fulano de Tal");
    expect(info.pageCount).toBe(1);
    const clean = await removeMetadata({ name: "a.pdf", bytes });
    expect(await infoKeys(clean)).toEqual([]);
    expect(Buffer.from(clean).toString("latin1")).not.toContain("Fulano");
    const after = await inspectPdf({ name: "a.pdf", bytes: clean });
    expect(after.info.author).toBeUndefined();
  });
  it("detecta arquivo corrompido, truncado e JavaScript embutido", async () => {
    const good = await numberedPdf(1);
    const truncated = good.slice(0, Math.floor(good.length / 2));
    const r = await inspectPdf({ name: "t.pdf", bytes: truncated });
    expect(r.hasEofMarker).toBe(false);
    expect(r.problems.length).toBeGreaterThan(0);
    const js = new TextEncoder().encode("%PDF-1.4\n1 0 obj << /S /JavaScript /JS (app.alert(1)) >> endobj\n%%EOF");
    expect((await inspectPdf({ name: "j.pdf", bytes: js })).hasJavaScript).toBe(true);
    expect((await inspectPdf({ name: "v.pdf", bytes: new Uint8Array() })).ok).toBe(false);
  });
  it("detecta assinatura digital pela estrutura /ByteRange", async () => {
    const fake = new TextEncoder().encode("%PDF-1.7\n5 0 obj << /Type /Sig /ByteRange [0 10 20 30] /Contents <00> >> endobj\n%%EOF");
    const r = await inspectPdf({ name: "s.pdf", bytes: fake });
    expect(r.hasDigitalSignatures).toBe(true);
    expect(r.signatureCount).toBe(1);
  });
});

describe("reconhecimento de dados pessoais", () => {
  it("valida CPF e CNPJ pelos dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });
  it("encontra CPF, CNPJ, e-mail, telefone, data e valores sem confundir uns com outros", () => {
    const text = "CPF 529.982.247-25, empresa 11.222.333/0001-81, contato teste@exemplo.com.br, fone (98) 99876-5432, em 05/10/2026, líquido R$ 1.234,56";
    const kinds = findPatterns(text).map(f => f.kind);
    expect(kinds).toEqual(["cpf", "cnpj", "email", "telefone", "data", "valor"]);
  });
  it("mascara valores em relatórios", () => {
    expect(maskValue("cpf", "529.982.247-25")).toBe("529.***.***-25");
  });
  it("busca sem diferenciar acentos", () => {
    const r = searchText("Recibo de Férias do funcionário", "ferias");
    expect(r).toHaveLength(1);
    expect(r[0].snippet).toContain("Férias");
  });
});
