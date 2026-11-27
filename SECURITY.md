# Segurança

## Modelo de ameaças

O TudoPDF processa documentos sensíveis (contracheques, CPF, dados financeiros). Premissas:

1. **Documentos são entradas não confiáveis.** Podem ser malformados ou maliciosos.
2. **Nada sai do dispositivo.** Não existe backend; o app não faz requisições de rede com conteúdo do usuário.
3. **Nada é persistido.** Documentos vivem só na memória da aba.

## Controles implementados

| Controle | Onde |
|---|---|
| CSP restritiva: `script-src 'self' 'wasm-unsafe-eval'`, `object-src 'none'`, `connect-src 'self'` (web) | `vite.config.ts`, `extension/manifest.json` |
| Nenhum código remoto: bibliotecas, workers, fontes, CMaps e WASM empacotados | `scripts/prepare-assets.mjs`, teste `extension.manifest.test.ts` |
| Extensão sem permissões (`permissions: []`, sem `host_permissions`, sem content scripts) | `extension/manifest.json` |
| PDF.js 6.5.438 (corrige CVE-2024-4367 e GHSA-hq66-cqwq-w95j); sem XFA; motor QuickJS de scripts de PDF **não empacotado** | `src/services/pdfjs.ts`, `scripts/prepare-assets.mjs` |
| pdf-lib não executa JavaScript de PDFs | — |
| Validação de entrada: cabeçalho `%PDF-`, arquivo vazio, limites (500 MB/arquivo, 5.000 páginas, 80 MP por imagem), tipo de imagem pelo conteúdo | `src/core/validation/file.ts`, `src/core/pdf/document.ts` |
| Operações pesadas em Web Worker descartável (cancelar = encerrar o worker e liberar memória) | `src/services/jobs.ts` |
| Remoção real de dados ao separar contracheques (blocos de texto apagados do fluxo; página original excluída) | `src/core/pdf/contentFilter.ts`, `src/core/payroll/build.ts` |
| XSS: React escapa todo conteúdo; nenhum `dangerouslySetInnerHTML` | `src/` |
| CSV com proteção contra injeção de fórmulas | `src/services/download.ts` |
| Nomes de arquivo saneados | `safeFilename` |
| Logs sem conteúdo de documentos | `ToolShell`, `App` |
| URLs `blob:` revogadas após o download; canvases zerados após renderizar | `download.ts`, `pdfjs.ts`, `Thumbnail.tsx` |

## Limitações conhecidas

- A detecção de assinatura digital é estrutural (`/ByteRange`, `/FT /Sig`); **a validade do certificado não é verificada**.
- “Marca-d'água” e numeração são elementos sobrepostos; não impedem a cópia do conteúdo original.
- A ferramenta de ocultação permanente (tarja) ainda não existe; não use marca-d'água ou retângulos como forma de ocultar dados.
- `style-src 'unsafe-inline'` na versão web (estilos inline do React/PDF.js). Não afeta a execução de scripts.

## Auditoria de dependências

```bash
npm audit            # 0 vulnerabilidades em 27/11/2026
```

## Relatar uma vulnerabilidade

E-mail para **oigresyt7@gmail.com** com o assunto “Segurança TudoPDF”. Não anexe documentos reais.
