# Licenças de terceiros

Componentes distribuídos com o TudoPDF (extensão e web). Todos permitem uso comercial em software
proprietário, desde que os avisos de licença sejam mantidos.

## Dependências de execução

| Pacote | Versão | Licença | Observação |
|---|---|---|---|
| pdfjs-dist (PDF.js, Mozilla) | 6.5.438 | Apache-2.0 | inclui CMaps e fontes padrão |
| ↳ OpenJPEG (WASM) | — | BSD-2-Clause | decodificação JPEG 2000 |
| ↳ JBIG2 (PDFium, WASM) | — | BSD-3-Clause | decodificação JBIG2 |
| ↳ qcms (WASM) | — | MIT | gerenciamento de cor |
| ↳ QuickJS | — | MIT | **não empacotado** (execução de scripts de PDF, não usada) |
| pdf-lib | 1.17.1 | MIT | |
| @pdf-lib/standard-fonts, @pdf-lib/upng | 1.0.x | MIT | |
| pako | 1.0.11 | MIT AND Zlib | via pdf-lib/JSZip |
| jszip | 3.10.2 | MIT OR GPL-3.0-or-later | usado sob **MIT** |
| react, react-dom, scheduler | 19.3.1 | MIT | |
| lucide-react | 0.577.0 | ISC | ícones |
| @dnd-kit/core, sortable, utilities, accessibility | 6.3 / 10.0 / 3.2 / 3.1 | MIT | |
| @fontsource-variable/inter (Inter) | 5.3.0 | OFL-1.1 | fonte empacotada |
| tslib | 2.9.1 | 0BSD | |
| lie, immediate, setimmediate, readable-stream, safe-buffer, string_decoder, core-util-is, isarray, process-nextick-args, util-deprecate | — | MIT | dependências do JSZip |
| inherits | 2.0.4 | ISC | |

Os textos completos das licenças acompanham cada pacote em `node_modules/<pacote>/LICENSE` e, para o
PDF.js/WASM, em `public/pdfjs/wasm/LICENSE_*` (copiados para o build).

## Ferramentas de desenvolvimento (não distribuídas)

Vite, Vitest, TypeScript, ESLint, Tailwind CSS (MIT) e plugins.

## Avaliadas e não adotadas

| Biblioteca | Licença | Motivo |
|---|---|---|
| MuPDF.js | AGPL-3.0 / comercial | exigiria abrir o código ou comprar licença |
| LibreOffice WASM | MPL-2.0 | tamanho (dezenas de MB) inviável para extensão |

Verificação feita em 27/11/2026 a partir dos `package.json` instalados.
