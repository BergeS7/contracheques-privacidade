// Testes de regressão do organizador de contracheques (comportamento da v1.2.0).
import { describe, it, expect } from "vitest";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import {
  analyzePayroll,
  organizeGroups,
  buildCombined,
  buildPerGroup,
  applyOverrides,
  findInconsistencies,
  validateOutputOrder,
  extractCandidates,
  normalizeForSort,
  type PayrollUnit
} from "../src/core/payroll";
import { fillPattern } from "../src/core/payroll/naming";
import { openTextDoc, pageTexts } from "./helpers/pdfjs-node";
import { singleSlipPdf, doubleSlipPdf, appendBlankPage, winAnsiHex } from "./helpers/fixtures";

const E = (code: string, name: string) => ({ code, name });

async function organize(files: Uint8Array[], direction: "asc" | "desc" = "asc") {
  const inputs = files.map((bytes, i) => ({ name: `doc${i}.pdf`, bytes }));
  const { units, pagesPerDoc } = await analyzePayroll(inputs, openTextDoc);
  const groups = organizeGroups(units, direction);
  const result = await buildCombined(inputs, groups, pagesPerDoc);
  return { inputs, units, groups, pagesPerDoc, result, texts: await pageTexts(result.pdfBytes) };
}

/** Todos os fluxos decodificados do PDF (para procurar texto escondido). */
async function allStreamsText(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  let out = "";
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      try {
        out += Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1") + "\n";
      } catch {
        out += Buffer.from(obj.contents).toString("latin1") + "\n";
      }
    }
  }
  return out;
}

describe("reconhecimento de nomes", () => {
  it("reconhece o padrão código – nome", () => {
    const c = extractCandidates("000578 - MARIA DA SILVA CPF: 000.000.000-00");
    expect(c[0]).toMatchObject({ code: "000578", name: "MARIA DA SILVA", source: "code" });
  });

  it("reconhece os campos Nome, Funcionário e Colaborador", () => {
    expect(extractCandidates("Nome: Joana Prado\nCargo: X")[0]?.name).toBe("Joana Prado");
    expect(extractCandidates("Funcionário: Pedro Alves\n")[0]?.name).toBe("Pedro Alves");
    expect(extractCandidates("Colaborador: Rita Nunes CPF 1")[0]?.name).toBe("Rita Nunes");
  });

  it("ignora departamentos com outro ' - ' no nome", () => {
    expect(extractCandidates("000034 - ZD - CONSORCIO\n")).toHaveLength(0);
  });

  it("normaliza acentos só para ordenar", () => {
    expect(normalizeForSort("Ávila  Conceição")).toBe("AVILA CONCEICAO");
  });
});

describe("organização (uma pessoa por folha)", () => {
  it("ordena de A a Z considerando acentos e preserva o texto selecionável", async () => {
    const pdf = await singleSlipPdf([
      E("000003", "BRUNO COSTA"),
      E("000001", "ÁVILA SOUZA"),
      E("000004", "CARLOS LIMA"),
      E("000002", "ÁLVARO DIAS")
    ]);
    const { groups, result, texts } = await organize([pdf]);
    expect(groups.map(g => g.name)).toEqual(["ÁLVARO DIAS", "ÁVILA SOUZA", "BRUNO COSTA", "CARLOS LIMA"]);
    expect(result.pageCount).toBe(4);
    expect(texts[0]).toContain("ÁLVARO DIAS");
    expect(texts[3]).toContain("CARLOS LIMA");
    expect(groups.every(g => g.units.every(u => u.confidence >= 0.9))).toBe(true);
  });

  it("ordena em ordem decrescente", async () => {
    const pdf = await singleSlipPdf([E("000001", "ANA MELO"), E("000002", "ZECA PAZ"), E("000003", "MARIA LUZ")]);
    const { groups } = await organize([pdf], "desc");
    expect(groups.map(g => g.name)).toEqual(["ZECA PAZ", "MARIA LUZ", "ANA MELO"]);
  });

  it("agrupa nomes repetidos mantendo a ordem original dentro do grupo", async () => {
    const pdf = await singleSlipPdf([E("000002", "BETO RAMOS"), E("000001", "ANA MELO"), E("000002", "BETO RAMOS")]);
    const { groups, result } = await organize([pdf]);
    expect(groups).toHaveLength(2);
    expect(groups[1].units.map(u => u.pageNumber)).toEqual([1, 3]);
    expect(result.pageCount).toBe(3);
  });

  it("preserva páginas não identificadas (sem texto) no final", async () => {
    const pdf = await appendBlankPage(await singleSlipPdf([E("000002", "BETO RAMOS"), E("000001", "ANA MELO")]));
    const { groups, result } = await organize([pdf]);
    expect(groups.at(-1)?.source).toBe("empty");
    expect(groups.at(-1)?.units[0].pageNumber).toBe(3);
    expect(result.pageCount).toBe(3);
  });
});

describe("folhas com duas pessoas", () => {
  it("separa pessoas diferentes, remonta duas por folha e remove o texto da outra metade", async () => {
    const pdf = await doubleSlipPdf([
      [E("000010", "ZÉLIA MOURA"), E("000011", "ANA PRADO")],
      [E("000012", "MARCOS REIS"), E("000013", "BEATRIZ LOPES")]
    ]);
    const { units, groups, result, texts } = await organize([pdf]);
    expect(units.filter(u => u.part !== "whole")).toHaveLength(4);
    expect(groups.map(g => g.name)).toEqual(["ANA PRADO", "BEATRIZ LOPES", "MARCOS REIS", "ZÉLIA MOURA"]);
    expect(result.pageCount).toBe(2);
    expect(texts[0]).toContain("ANA PRADO");
    expect(texts[0]).toContain("BEATRIZ LOPES");
    expect(texts[0]).not.toContain("ZÉLIA");
    expect(texts[1]).toContain("MARCOS REIS");
    expect(texts[1]).toContain("ZÉLIA MOURA");

    // Cada nome aparece exatamente uma vez no texto final...
    const all = texts.join("\n");
    for (const n of ["ANA PRADO", "BEATRIZ LOPES", "MARCOS REIS", "ZÉLIA MOURA"]) {
      expect(all.split(n).length - 1).toBe(1);
    }
    // ...e também nos dados brutos do arquivo (nada escondido fora da área visível).
    const raw = await allStreamsText(result.pdfBytes);
    for (const n of ["ANA PRADO", "BEATRIZ LOPES", "MARCOS REIS", "ZÉLIA MOURA"]) {
      expect(raw.split(winAnsiHex(n)).length - 1).toBe(1);
    }
  });

  it("mantém inteira a folha com duas vias da mesma pessoa", async () => {
    const pdf = await doubleSlipPdf([
      [E("000020", "PAULO GOMES"), E("000020", "PAULO GOMES")],
      [E("000021", "ALICE NERY"), E("000021", "ALICE NERY")]
    ]);
    const { units, groups, result } = await organize([pdf]);
    expect(units.every(u => u.part === "whole")).toBe(true);
    expect(groups.map(g => g.name)).toEqual(["ALICE NERY", "PAULO GOMES"]);
    expect(result.pageCount).toBe(2);
  });

  it("exporta um PDF por funcionário sem vazar dados de outra pessoa", async () => {
    const pdf = await doubleSlipPdf([[E("000030", "CAIO BRAGA"), E("000031", "DORA VIANA")]]);
    const inputs = [{ name: "a.pdf", bytes: pdf }];
    const { units } = await analyzePayroll(inputs, openTextDoc);
    const groups = organizeGroups(units);
    const parts = await buildPerGroup(inputs, groups);
    expect(parts).toHaveLength(2);
    const caio = (await pageTexts(parts[0].pdfBytes)).join(" ");
    expect(caio).toContain("CAIO BRAGA");
    expect(caio).not.toContain("DORA");
    const raw = await allStreamsText(parts[0].pdfBytes);
    expect(raw).not.toContain(winAnsiHex("DORA VIANA"));
  });
});

describe("integridade", () => {
  const u = (pageNumber: number, part: PayrollUnit["part"] = "whole"): PayrollUnit =>
    ({ docIndex: 0, pageNumber, part, source: "code", code: null, name: "X Y", confidence: 1 });

  it("acusa página duplicada", () => {
    expect(() => validateOutputOrder([u(1), u(1)], [1])).toThrow(/duas vezes/);
  });
  it("acusa página perdida", () => {
    expect(() => validateOutputOrder([u(1)], [2])).toThrow(/não entrou/);
  });
  it("aceita metades complementares", () => {
    expect(() => validateOutputOrder([u(1, "top"), u(1, "bottom")], [1])).not.toThrow();
  });
});

describe("melhorias da v2", () => {
  it("renomeia arquivos individuais por padrão", () => {
    expect(fillPattern("{n} - {nome}", { name: "JOÃO DA SILVA", code: "000123" }, 4, 120, "folha.pdf")).toBe("005 - JOÃO DA SILVA.pdf");
    expect(fillPattern("{codigo} - {nome}", { name: "ANA MELO", code: null }, 0, 1, "x.pdf")).toBe("ANA MELO.pdf");
    expect(fillPattern("{arquivo} {nome}", { name: "A/B: C", code: null }, 0, 1, "Folha 10-2026.pdf")).toBe("Folha 10-2026 A B C.pdf");
  });

  it("processa vários PDFs juntos e agrupa o mesmo funcionário", async () => {
    const a = await singleSlipPdf([E("000002", "BETO RAMOS"), E("000003", "CELIA DIAS")]);
    const b = await singleSlipPdf([E("000001", "ANA MELO"), E("000002", "BETO RAMOS")]);
    const { groups, result } = await organize([a, b]);
    expect(groups.map(g => g.name)).toEqual(["ANA MELO", "BETO RAMOS", "CELIA DIAS"]);
    expect(groups[1].units.map(x => `${x.docIndex}:${x.pageNumber}`)).toEqual(["0:1", "1:2"]);
    expect(result.pageCount).toBe(4);
  });

  it("aplica correção manual de nome e reagrupa", async () => {
    const pdf = await singleSlipPdf([E("000001", "ANA MELO"), E("000002", "ZE CARLOS SILVA")]);
    const { units } = await analyzePayroll([{ name: "a.pdf", bytes: pdf }], openTextDoc);
    const key = "000002|ZE CARLOS SILVA";
    const groups = organizeGroups(applyOverrides(units, { [key]: "AAA PRIMEIRO" }));
    expect(groups[0].name).toBe("AAA PRIMEIRO");
    expect(groups[0].units[0].manual).toBe(true);
    expect(groups[0].code).toBeNull();
  });

  it("relata inconsistências (código com nomes diferentes, páginas sem texto)", async () => {
    const pdf = await appendBlankPage(await singleSlipPdf([E("000001", "ANA MELO"), E("000001", "ANA MELLO")]));
    const { units } = await analyzePayroll([{ name: "a.pdf", bytes: pdf }], openTextDoc);
    const issues = findInconsistencies(organizeGroups(units), ["a.pdf"]);
    expect(issues.some(i => i.level === "erro" && i.message.includes("000001"))).toBe(true);
    expect(issues.some(i => i.message.includes("sem texto"))).toBe(true);
  });
});
