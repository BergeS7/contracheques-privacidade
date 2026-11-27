# Arquitetura

## Diagnóstico da v1.2.0 (ponto de partida)

| Item | Situação encontrada |
|---|---|
| Estrutura | JavaScript puro sem build (`extensao/app.js` 589 linhas, `pdf-halves.js` 158), uma única tela |
| Manifest | MV3 correto, `permissions: []`, ícone abre `app.html` em aba |
| Bibliotecas | pdf-lib 1.17.1 (MIT), PDF.js 3.11.174 (Apache 2.0) empacotados |
| Segurança | **PDF.js 3.11.174 é vulnerável a CVE-2024-4367** (execução de JS via fonte maliciosa, com `isEvalSupported` padrão). Mitigado na extensão pela CSP do MV3, mas exposto em qualquer uso web |
| Qualidade | Algoritmos sólidos e bem comentados (separação de metades, remoção real de texto, integridade). Sem testes automatizados, sem lint, sem tipagem |
| Desempenho | Tudo na thread principal; leitura página a página com status textual |
| Reaproveitável | Todo o reconhecimento de nomes, `findSplit`, `buildUnits`, `buildGroups`, `validateOutputOrder`, `buildPdf` e o tokenizador de fluxo de conteúdo |

Decisão: **migrar para React + TypeScript + Vite** (o app passa de 1 para 30+ telas) **portando a lógica sem reescrever**:
as funções foram convertidas para TypeScript com as mesmas regras, e a paridade é verificada por testes
(`tests/contentFilter.parity.test.ts` executa o `pdf-halves.js` original e compara byte a byte).

## Camadas

```
┌──────────────────────── app/ (entrada Vite) ─────────────────────────┐
│ src/app        bootstrap, roteador por hash, layout, ErrorBoundary    │
│ src/features   registry.ts → telas (ToolShell + opções específicas)   │
│ src/components ui · layout · upload · pdf-viewer (miniaturas lazy)    │
├──────────────────────────── serviços ────────────────────────────────┤
│ services/pdfjs.ts   PDF.js (worker próprio): texto e renderização     │
│ services/jobs.ts    runJob(op, args) → Web Worker descartável         │
│ services/download   Blob/ZIP/CSV, URLs revogadas                      │
├──────────────────── src/core (sem DOM, testável no Node) ────────────┤
│ pdf/        document, organize, stamp, metadata, pageRanges,         │
│             contentFilter                                            │
│ payroll/    text, recognize, build, naming (contracheques)           │
│ conversion/ images, text          recognition/ patterns (CPF…)       │
│ validation/ file                  errors.ts                          │
└───────────────────────────────────────────────────────────────────────┘
```

- **Core** não importa React nem DOM. PDF.js é **injetado** (`OpenTextDoc`), então o mesmo código roda no
  navegador e nos testes (build *legacy* do PDF.js no Node).
- **Worker** (`src/workers/pdf.worker.ts`) expõe as funções do core listadas em `operations.ts`. Um worker
  por tarefa: cancelar é `worker.terminate()`, o que libera toda a memória da operação. Resultados voltam
  como *transferables* (sem cópia).
- **PDF.js** já roda o parsing no worker dele; renderização (miniaturas, PDF→imagem) usa canvas na thread
  principal, página a página, com o canvas zerado logo após o uso.

## Registro de ferramentas

`src/features/registry.ts` define cada ferramenta (id, nome, descrição, categoria, ícone, formatos aceitos,
offline, lote, motor, status, observação, componente *lazy*). Ele alimenta início, busca (sem acentos),
menu, categorias, favoritos, recentes e rotas (`#/ferramenta/<id>`). Ferramentas `planned` aparecem como
“Em breve” e a rota mostra apenas o aviso de roadmap.

## Contracheques

1. `analyzePayroll` lê cada documento (PDF.js), `analyzePage` detecta folhas com dois contracheques
   (`findSplit`: ≥3 textos repetidos exatamente 2× com o mesmo passo vertical + faixa em branco ≥10 pt).
2. `buildUnits` decide metade/folha inteira; `makeChooser` ignora cabeçalhos presentes em >50% das páginas.
3. Interface aplica correções manuais (`applyOverrides`, por unidade), agrupa e ordena (`buildGroups`, pt-BR sem acentos).
4. `validateOutputOrder` garante que cada página/metade entra exatamente uma vez (vários documentos).
5. `buildPayrollPdf` copia folhas inteiras sem alteração; metades viram Form XObjects com o texto da outra
   metade **removido do fluxo** (`removeTextOutside`) e a página original é apagada do arquivo.

## Builds

| | Web (PWA) | Extensão |
|---|---|---|
| Comando | `npm run build:web` | `npm run build:extension` |
| Saída | `dist/web` | `dist/extension` |
| Extras | `manifest.webmanifest`, `sw.js` gerado com a lista exata de arquivos | `manifest.json` (versão do package.json), `background.js`, `app.html` (compatibilidade 1.x) |
| CSP | `<meta>` injetada no build | `content_security_policy.extension_pages` + `<meta>` |

Divisão de código: React, pdf-lib, PDF.js e JSZip em chunks próprios; cada ferramenta é carregada sob demanda.
A página inicial não carrega pdf-lib nem PDF.js.

## Decisões e avaliações

- **pdf-lib 1.17.1**: sem manutenção desde 2021, mas estável e MIT. Não criptografa PDFs. Para senha/AES
  avaliar `@cantoo/pdf-lib` (fork com criptografia) ou **QPDF em WASM** (Apache 2.0, ~1,5 MB).
- **MuPDF (WASM)**: excelente para compressão, redação real e renderização, porém **AGPL-3.0** (ou licença
  comercial paga). Incompatível com distribuição proprietária sem licença: não adotado.
- **Office ↔ PDF**: não há motor local confiável no navegador; LibreOffice WASM tem dezenas de MB. Mantido como `planned`.
- **Tesseract.js** (Apache 2.0) para OCR na fase 5, com modelos `por`/`eng` empacotados (exige `wasm-unsafe-eval`, já permitido na CSP).
- **Estado**: `useSyncExternalStore` para preferências; Zustand não foi necessário.
