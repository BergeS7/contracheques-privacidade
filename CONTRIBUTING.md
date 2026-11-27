# Contribuindo

## Regras do projeto

- **Processamento local sempre.** Nenhuma ferramenta pode enviar documentos para servidores ou APIs externas.
- **Sem simulação.** Uma ferramenta só entra como `available` no registro quando o motor está implementado e testado.
  O que não existe fica como `planned` (aparece como “Em breve”, sem ação).
- **Sem dados reais em testes.** Use apenas documentos sintéticos (`tests/helpers/fixtures.ts`).
- **Não altere as regras do organizador de contracheques** sem rodar os testes de regressão e paridade.

## Adicionar uma ferramenta

1. Motor em `src/core/...` (função pura, recebe bytes e `OpContext` com `signal`/`onProgress`).
2. Se usar pdf-lib e for pesada, registre em `src/workers/operations.ts`.
3. Testes em `tests/` com PDFs sintéticos.
4. Tela em `src/features/<categoria>/` usando `ToolShell`.
5. Entrada em `src/features/registry.ts` (id, nome, descrição, categoria, ícone, `accept`, `status`).
6. Atualize `docs/IMPLEMENTATION_STATUS.md` e `CHANGELOG.md`.

## Antes de enviar

```bash
npm run check   # lint + typecheck + testes + build
```

## Estilo

- TypeScript estrito, sem `any` implícito.
- Textos da interface em português brasileiro.
- Ícones do Lucide; nada de emojis como ícones.
- Cores apenas pelos tokens de `src/styles/global.css`.
