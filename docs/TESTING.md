# Testes

```bash
npm test          # 68 testes, ~3 s
npm run check     # lint + typecheck + testes + build
```

Todos os documentos de teste são **sintéticos**, gerados na hora com pdf-lib (`tests/helpers/fixtures.ts`).
Nomes e CPFs são fictícios. Nenhum arquivo real é usado ou guardado no repositório.

## Suítes

| Arquivo | Cobre |
|---|---|
| `payroll.regression.test.ts` | padrão código–nome, campos Nome/Funcionário/Colaborador, departamentos ignorados, ordenação com acentos, A-Z/Z-A, nomes repetidos, páginas sem texto no fim, folhas com duas pessoas (separação, remontagem, **ausência do texto removido no texto extraído e nos fluxos brutos**), duas vias da mesma pessoa, exportação por funcionário sem vazamento, integridade (página duplicada/perdida), vários PDFs, correção manual, inconsistências, renomeação |
| `contentFilter.parity.test.ts` | executa `extensao/pdf-halves.js` (v1.2.0) em sandbox e compara byte a byte com o port TypeScript |
| `core.organize.test.ts` | intervalos, validação (vazio, não-PDF, corrompido), juntar, extrair, excluir, inverter, duplicar, girar (incl. já rotacionadas), intercalar, pares/ímpares, dividir, páginas em branco, alterar tamanho (tamanhos mistos), **300 páginas**, cancelamento, nomes de arquivo com acentos |
| `core.convert-stamp.test.ts` | imagens → PDF, imagem inválida, TXT ↔ PDF com acentos, PDF → Markdown, numeração, marca-d'água (páginas selecionadas e rotacionadas), cabeçalho/rodapé, metadados (inspeção e remoção real), arquivo truncado, JavaScript embutido, assinatura digital, CPF/CNPJ, máscara, busca sem acentos |
| `extension.manifest.test.ts` | MV3, sem permissões, CSP sem origens remotas, versão, ausência de chamadas de rede/eval no código |

## Verificação manual (27/11/2026)

No navegador, com o build de produção (`vite preview`) e PDFs sintéticos: cada tela de ferramenta foi
executada até o resultado (as variações PNG/WEBP de “PDF para imagem” compartilham o componente de JPG e
não foram executadas separadamente; “imagem para PDF” foi testada com JPG, PNG e WEBP juntos); organizador de contracheques (reconhecimento, prévia,
PDF único, ZIP por funcionário); organizador de páginas (girar, excluir, inserir em branco, desfazer/refazer);
tema claro/escuro; largura de 375 px sem rolagem horizontal; **todas as requisições de rede foram para a própria origem**.

## Não coberto ainda

- E2E automatizado (Playwright).
- PDFs digitalizados reais, PDFs com senha reais e assinados reais (usamos estruturas sintéticas equivalentes).
- Registro do service worker / modo offline em navegador real.
- Carga da extensão empacotada no Chrome.
