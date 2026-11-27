import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  mergePdfs, selectPages, deletePages, rotatePages, reversePages, duplicatePages,
  interleavePdfs, splitOddEven, splitEvery, splitByGroups, insertBlankPages, resizePages, compareFilenames
} from "../src/core/pdf/organize";
import { parsePageList, parseRangeGroups, formatPageList } from "../src/core/pdf/pageRanges";
import { loadPdf } from "../src/core/pdf/document";
import { validatePdfBytes, detectImageKind, safeFilename } from "../src/core/validation/file";
import { TudoPdfError } from "../src/core/errors";
import { numberedPdf, rotatedPdf } from "./helpers/fixtures";
import { pageTexts } from "./helpers/pdfjs-node";

const input = async (n: number, name = "doc.pdf") => ({ name, bytes: await numberedPdf(n) });
const labels = async (bytes: Uint8Array) => (await pageTexts(bytes)).map(t => t.trim());

describe("intervalos de páginas", () => {
  it("interpreta listas, intervalos abertos e invertidos", () => {
    expect(parsePageList("1-3, 5, 8-", 9)).toEqual([1, 2, 3, 5, 8, 9]);
    expect(parsePageList("-2", 5)).toEqual([1, 2]);
    expect(parsePageList("3-1", 5)).toEqual([3, 2, 1]);
    expect(parsePageList("todas", 3)).toEqual([1, 2, 3]);
    expect(parseRangeGroups("1-2; 3\n4-5", 5)).toEqual([[1, 2], [3], [4, 5]]);
    expect(formatPageList([1, 2, 3, 5, 7, 8])).toBe("1-3, 5, 7-8");
  });
  it("rejeita páginas inexistentes e texto inválido", () => {
    expect(() => parsePageList("0", 3)).toThrow(TudoPdfError);
    expect(() => parsePageList("4", 3)).toThrow(/não existe/);
    expect(() => parsePageList("a-b", 3)).toThrow(/inválido/);
  });
});

describe("validação de arquivos", () => {
  it("rejeita arquivo vazio, não-PDF e PDF corrompido", async () => {
    expect(() => validatePdfBytes(new Uint8Array())).toThrow(/vazio/);
    expect(() => validatePdfBytes(new TextEncoder().encode("ola mundo"))).toThrow(/não é um arquivo PDF/);
    const broken = new TextEncoder().encode("%PDF-1.7\n1 0 obj << /Type /Catalog >>\ntrailer garbage");
    await expect(loadPdf(broken)).rejects.toMatchObject({ code: "CORRUPTED" });
  });
  it("identifica imagens pelo conteúdo", () => {
    expect(detectImageKind(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("jpeg");
    expect(detectImageKind(new TextEncoder().encode("RIFF0000WEBPVP8 "))).toBe("webp");
    expect(detectImageKind(new TextEncoder().encode("texto qualquer"))).toBeNull();
  });
  it("gera nomes de arquivo seguros mantendo acentos", () => {
    expect(safeFilename('João: "Recibo" <01/2026>?')).toBe("João Recibo 01 2026");
  });
});

describe("organização de páginas", () => {
  it("junta vários PDFs na ordem", async () => {
    const out = await mergePdfs([await input(2, "a.pdf"), await input(3, "b.pdf")]);
    expect(await labels(out)).toEqual(["Pagina 1", "Pagina 2", "Pagina 1", "Pagina 2", "Pagina 3"]);
  });
  it("extrai, exclui, inverte e duplica", async () => {
    const doc = await input(5);
    expect(await labels(await selectPages(doc, [4, 2]))).toEqual(["Pagina 4", "Pagina 2"]);
    expect(await labels(await deletePages(doc, [1, 5]))).toEqual(["Pagina 2", "Pagina 3", "Pagina 4"]);
    expect(await labels(await reversePages(await input(3)))).toEqual(["Pagina 3", "Pagina 2", "Pagina 1"]);
    expect(await labels(await duplicatePages(await input(2), [1], 2))).toEqual(["Pagina 1", "Pagina 1", "Pagina 1", "Pagina 2"]);
    await expect(deletePages(await input(2), [1, 2])).rejects.toThrow(/todas/);
  });
  it("gira somente as páginas pedidas, somando à rotação existente", async () => {
    const out = await rotatePages(await input(3), [2], 90);
    const doc = await PDFDocument.load(out);
    expect(doc.getPages().map(p => p.getRotation().angle)).toEqual([0, 90, 0]);
    const again = await PDFDocument.load(await rotatePages({ name: "r.pdf", bytes: await rotatedPdf() }, "all", 270));
    expect(again.getPage(0).getRotation().angle).toBe(0);
  });
  it("intercala frente e verso (com verso invertido)", async () => {
    const out = await interleavePdfs([await input(2, "frente.pdf"), await input(2, "verso.pdf")], true);
    expect(await labels(out)).toEqual(["Pagina 1", "Pagina 2", "Pagina 2", "Pagina 1"]);
  });
  it("separa pares e ímpares e divide em partes", async () => {
    const [odd, even] = await splitOddEven(await input(5));
    expect(await labels(odd.bytes)).toEqual(["Pagina 1", "Pagina 3", "Pagina 5"]);
    expect(await labels(even.bytes)).toEqual(["Pagina 2", "Pagina 4"]);
    const parts = await splitEvery(await input(5), 2);
    expect(parts).toHaveLength(3);
    expect(await labels(parts[2])).toEqual(["Pagina 5"]);
    const groups = await splitByGroups(await input(4), [[1, 4], [2]]);
    expect(await labels(groups[0])).toEqual(["Pagina 1", "Pagina 4"]);
  });
  it("insere páginas em branco do mesmo tamanho da vizinha", async () => {
    const src = { name: "x.pdf", bytes: await numberedPdf(2, [[595, 842], [842, 595]]) };
    const out = await PDFDocument.load(await insertBlankPages(src, "after-each"));
    expect(out.getPageCount()).toBe(4);
    expect(out.getPage(3).getSize()).toEqual({ width: 842, height: 595 });
  });
  it("altera o tamanho das páginas mantendo o texto selecionável", async () => {
    const src = { name: "x.pdf", bytes: await numberedPdf(2, [[300, 300], [842, 595]]) };
    const out = await resizePages(src, "A4");
    const doc = await PDFDocument.load(out);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
    expect(Math.round(doc.getPage(1).getWidth())).toBe(842); // paisagem preservada
    expect(await labels(out)).toEqual(["Pagina 1", "Pagina 2"]);
  });
  it("lida com PDF de centenas de páginas", async () => {
    const big = await input(300);
    const out = await reversePages(big);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(300);
  });
  it("cancela operações", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(mergePdfs([await input(2), await input(2)], { signal: controller.signal })).rejects.toMatchObject({ code: "CANCELLED" });
  });
  it("ordena nomes de arquivo naturalmente", () => {
    expect(["b10.pdf", "Árvore.pdf", "b2.pdf", "abacate.pdf"].sort(compareFilenames)).toEqual(["abacate.pdf", "Árvore.pdf", "b2.pdf", "b10.pdf"]);
  });
});
