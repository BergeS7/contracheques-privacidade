# Organizador de Contracheques — BergeS7

Extensão Chrome/Edge Manifest V3 para reorganizar PDFs de contracheques por nome de funcionário.

## O que ela faz

Organiza qualquer PDF com nomes em ordem alfabética, localmente, sem enviar nada para a internet.

1. Lê o texto de cada página com PDF.js.
2. Encontra o nome de cada página (ou de cada metade), nesta ordem:
   - `000578 - NOME COMPLETO` (código de 6 dígitos + nome);
   - campos como `Nome:`, `Funcionário:`, `Colaborador:`;
   - se nada for encontrado, a primeira linha de texto da página.
3. Um "nome" presente na maioria das páginas é tratado como cabeçalho (empresa, departamento) e
   ignorado. Candidatos com outro ` - ` no nome (ex.: `000034 - ZD - CONSORCIO`) também.
4. **Folhas com duas pessoas** (um contracheque em cima, outro embaixo): cada contracheque é separado e
   ordenado; eles são remontados dois por folha. O texto que não entra é **apagado do arquivo** (não
   fica escondido), e o conteúdo continua vetorial e selecionável.
   **Proteção do corte:** a folha só é separada quando o cabeçalho se repete duas vezes (pelo menos 3
   textos iguais à mesma distância) e há uma faixa em branco de 10 pt ou mais exatamente onde começa
   o segundo contracheque. O corte vai no meio dessa faixa. Sem isso, a folha fica inteira. Ao juntar
   duas metades de folhas diferentes, só ficam na mesma folha se os textos não se sobrepuserem.
5. Folhas com a mesma pessoa em cima e embaixo (duas vias) continuam inteiras.
6. Ordena de A a Z, desconsiderando acentos. Páginas sem texto (escaneadas) vão para o final.
7. Garante que todo o conteúdo original entra exatamente uma vez.
8. Folhas inteiras são copiadas sem recortar, redimensionar ou redesenhar.

## Bibliotecas necessárias

Coloque estes arquivos dentro da pasta `libs/`:

- `pdf-lib.min.js` — versão 1.17.1
- `pdf.min.js` — versão 3.11.174
- `pdf.worker.min.js` — versão 3.11.174

Esses arquivos não foram incluídos neste pacote para evitar redistribuir dependências de terceiros.

Estrutura final:

```text
contracheques-ordem-alfabetica/
├── manifest.json
├── background.js
├── app.html
├── app.js
├── pdf-halves.js
├── styles.css
├── privacidade.html
├── cookies.html
├── icons/
│   ├── logo.svg
│   └── icon-16/32/48/128.png
└── libs/
    ├── pdf-lib.min.js
    ├── pdf.min.js
    └── pdf.worker.min.js
```

## Instalar no Chrome

1. Abra `chrome://extensions`.
2. Ative `Modo do desenvolvedor`.
3. Clique em `Carregar sem compactação`.
4. Escolha a pasta da extensão.

## Instalar no Edge

1. Abra `edge://extensions`.
2. Ative `Modo de desenvolvedor`.
3. Clique em `Carregar descompactado`.
4. Escolha a pasta da extensão.

## Como a tabela mostra cada nome

- **Código e nome** / **Campo de nome**: nome encontrado com segurança.
- **1ª linha da página**: nenhum nome encontrado; a página foi ordenada pela primeira linha de texto.
- **Sem texto · no final**: página sem texto (imagem); fica no final, na ordem original.
- Nas páginas originais, `(cima)` e `(baixo)` indicam contracheques separados de folhas com duas pessoas.

O PDF é sempre gerado; não há bloqueios nem confirmação manual.

## Observação importante

A identificação usa o texto do PDF. PDFs escaneados (só imagem) não têm texto e ficam no final.
Para um novo padrão de nome, ajuste `extractCandidates()` em `app.js`.

## Teste recomendado

Validado em 30/09/2026 com:

- `CONTRA VENDEDORES 09-2026.pdf`: 41 páginas, 39 funcionários, duas vias por folha → 41 páginas, inteiras.
- `Demonstrativo(s) de Pagamento.pdf`: 48 folhas com duas pessoas por folha (96 contracheques,
  90 funcionários) → 48 páginas em ordem alfabética, sem texto a mais nem a menos.
