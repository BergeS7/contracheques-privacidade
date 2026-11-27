# TudoPDF — by BergeS7

**Tudo em PDF. Tudo em um só lugar.**

Plataforma de ferramentas PDF com **processamento 100% local**, privacidade e funcionamento offline.
Evolução da extensão *Organizador de Contracheques — BergeS7* (v1.2.0, Chrome Web Store), que continua
disponível dentro do TudoPDF com melhorias.

- Extensão Chrome (Manifest V3): o ícone abre o app completo em uma nova aba.
- Aplicação web instalável (PWA) a partir do mesmo código.
- Nenhum documento sai do dispositivo. Sem cadastro, sem analytics, sem anúncios.

## Ferramentas disponíveis (v2.0.0)

| Categoria | Ferramentas |
|---|---|
| Automações | Organizar contracheques (A-Z, separação de folhas com duas pessoas, revisão manual, ZIP por funcionário, relatório), Buscar em vários PDFs, Identificar duplicados |
| Organizar | Juntar, Dividir, Organizar páginas (miniaturas com arrastar e soltar), Extrair, Excluir, Girar, Inverter, Intercalar, Pares/ímpares, Duplicar, Páginas em branco, Alterar tamanho, Ordenar documentos A-Z |
| Converter | JPG/PNG/WEBP → PDF, PDF → JPG/PNG/WEBP, PDF → TXT, PDF → Markdown, TXT → PDF |
| Editar | Marca-d'água, Numerar páginas, Cabeçalho e rodapé |
| Segurança | Diagnóstico e metadados (integridade, criptografia, assinaturas, scripts), Remover metadados, Localizar dados pessoais (CPF/CNPJ com dígito verificador, e-mail, telefone, datas, valores) |

O que ainda não existe aparece no app como **“Em breve”** e está em [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

## Desenvolvimento

Requisitos: Node.js 22.13+ (testado com Node 26).

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # testes unitários e de integração (Vitest)
npm run lint
npm run typecheck
npm run build          # dist/web e dist/extension
npm run zip:extension  # dist/tudopdf-extensao-<versão>.zip (com verificações MV3)
npm run check          # lint + typecheck + testes + build
```

### Carregar a extensão localmente

1. `npm run build:extension`
2. Abra `chrome://extensions`, ative o **Modo do desenvolvedor**.
3. **Carregar sem compactação** → selecione `dist/extension`.

### Publicar a versão web

`npm run build:web` gera `dist/web`, um site estático (rotas por hash, sem configuração de servidor).
Funciona em Vercel, Cloudflare Pages ou GitHub Pages. O service worker só é registrado em HTTPS/localhost.

## Estrutura

```
app/            entrada do Vite (index.html, main.ts, modelo do service worker)
src/core/       motor de processamento, sem interface (pdf, payroll, conversion, recognition, validation)
src/workers/    Web Worker que executa as operações do pdf-lib
src/services/   PDF.js no navegador, jobs (worker), downloads/ZIP, imagens
src/features/   registro de ferramentas e telas (organize, convert, edit, security, automations)
src/components/ interface compartilhada (ui, layout, upload, pdf-viewer)
extension/      manifest.json e background.js da extensão MV3
extensao/       código da v1.2.0 publicada (referência; usado nos testes de paridade)
tests/          testes com documentos sintéticos
docs/           arquitetura, roadmap, status, testes, privacidade, licenças
index.html      política de privacidade publicada no GitHub Pages
```

Mais detalhes: [ARCHITECTURE](docs/ARCHITECTURE.md) · [ROADMAP](docs/ROADMAP.md) · [TESTING](docs/TESTING.md) ·
[SECURITY](SECURITY.md) · [PRIVACY](docs/PRIVACY.md) · [CHANGELOG](CHANGELOG.md) · [CONTRIBUTING](CONTRIBUTING.md) ·
[Licenças de terceiros](docs/THIRD_PARTY_LICENSES.md)

## Licença

Código proprietário da BergeS7 (todos os direitos reservados). Bibliotecas de terceiros mantêm suas licenças.
