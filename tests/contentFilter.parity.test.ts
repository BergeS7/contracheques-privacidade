// Garante que o filtro de conteúdo portado produz exatamente o mesmo resultado da v1.2.0.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { removeTextOutside, tokenize } from "../src/core/pdf/contentFilter";

type Legacy = { removeTextOutside: (b: Uint8Array, k: (y: number) => boolean) => Uint8Array };

function loadLegacy(): Legacy {
  const code = readFileSync(resolve(__dirname, "../extensao/pdf-halves.js"), "utf8");
  const sandbox: Record<string, unknown> = { Uint8Array, String, Set, Math, parseFloat };
  sandbox.globalThis = sandbox;
  runInNewContext(code, sandbox);
  return sandbox.PdfHalves as Legacy;
}

const enc = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0) & 0xff);
const dec = (b: Uint8Array) => String.fromCharCode(...b);

const SAMPLES = [
  "BT /F1 12 Tf 1 0 0 1 40 800 Tm <414E41> Tj ET\nBT /F1 12 Tf 1 0 0 1 40 300 Tm <5A45> Tj ET",
  "q 1 0 0 1 0 -400 cm BT /F2 9 Tf 50 750 Td (Nome \\(teste\\)) Tj ET Q BT 10 TL 0 0 Td (fora) Tj ET",
  "% comentario\nBT /F1 10 Tf 2 Tc 100 500 TD [(A) -20 (B)] TJ ET 0 0 m 10 10 l S",
  "BI /W 2 /H 2 /BPC 8 /CS /G ID \u0001\u0002\u0003\u0004 EI BT 1 0 0 1 5 5 Tm (x) Tj ET",
  "BT /F1 12 Tf ET"
];

describe("filtro de conteúdo (paridade com extensao/pdf-halves.js)", () => {
  const legacy = loadLegacy();
  for (const [i, sample] of SAMPLES.entries()) {
    for (const cut of [450, 100, 900]) {
      it(`amostra ${i + 1}, corte em y=${cut}`, () => {
        const keep = (y: number) => y > cut;
        expect(dec(removeTextOutside(enc(sample), keep))).toBe(dec(legacy.removeTextOutside(enc(sample), keep)));
      });
    }
  }

  it("remove o bloco fora da faixa e mantém o estado de fonte", () => {
    const out = dec(removeTextOutside(enc(SAMPLES[0]), y => y > 450));
    expect(out).toContain("<414E41>");
    expect(out).not.toContain("<5A45>");
    expect(out).toContain("/F1 12 Tf");
  });

  it("não interpreta strings e comentários como operadores", () => {
    const ops = tokenize("(BT ET) % BT\n/Nome Tf").filter(t => t.kind === "op").map(t => t.value);
    expect(ops).toEqual(["Tf"]);
  });
});
