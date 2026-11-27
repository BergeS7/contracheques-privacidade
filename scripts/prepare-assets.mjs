// Copia os recursos estáticos do PDF.js (CMaps, fontes padrão, WASM, ICC) para public/pdfjs/.
// Tudo é empacotado localmente: nada é baixado de CDNs em tempo de execução.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "node_modules/pdfjs-dist");
const dest = resolve(root, "public/pdfjs");

if (!existsSync(src)) {
  console.error("pdfjs-dist não encontrado. Rode npm install.");
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
// QuickJS (quickjs-eval.*) só serve para executar JavaScript embutido em PDFs.
// O TudoPDF nunca executa esses scripts, então o motor não é empacotado.
const skip = name => /quickjs/i.test(name);
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  const from = resolve(src, dir);
  if (existsSync(from)) cpSync(from, resolve(dest, dir), { recursive: true, filter: p => !skip(p) });
}
console.log("Recursos do PDF.js copiados para public/pdfjs/");
