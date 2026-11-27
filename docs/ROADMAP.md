# Roadmap

## Fase 1 — Fundação ✅
Auditoria, arquitetura modular, identidade visual, dashboard, registro de ferramentas, visualizador,
upload, preservação do organizador de contracheques.

## Fase 2 — Ferramentas essenciais ✅
Juntar, dividir, reorganizar, girar, extrair, excluir, duplicar, PDF ↔ imagens, marca-d'água, numeração.
Extras entregues: intercalar, pares/ímpares, páginas em branco, tamanho, TXT/Markdown, metadados,
dados pessoais, busca, duplicados.

## Fase 3 — Editor profissional
- Editor com barra de ferramentas, miniaturas, visualizador central, painel de propriedades, zoom.
- Texto, imagem, formas, linhas/setas, desenho livre, destaque, comentários, carimbos.
- Assinatura manuscrita (desenho/imagem), sem confundir com assinatura digital.
- Camadas, posicionamento preciso, atalhos, desfazer/refazer (histórico já existe no organizador de páginas).
- Recorte com remoção real do conteúdo fora da área.

## Fase 4 — Automações
- Agrupar por CPF/CNPJ/empresa/data com revisão antes de confirmar.
- Recibos, comprovantes, notas fiscais e fichas cadastrais.
- Regras personalizadas e fluxos reutilizáveis (ex.: importar → identificar → separar → renomear → ZIP).

## Fase 5 — Recursos avançados
- OCR local com Tesseract.js (por/eng) e PDF pesquisável; OCR no organizador de contracheques.
- Ocultação permanente (texto + imagens sob a tarja), com verificação pós-processamento.
- Proteção/remoção de senha (avaliar QPDF WASM ou `@cantoo/pdf-lib`).
- Compressão (recompressão de imagens).
- Comparação de PDFs e extração de tabelas.

## Fase 6 — Produção
- Testes E2E com Playwright (incluindo modo offline e ausência de requisições externas).
- Medição de desempenho (1, 100, 500+ páginas; 100 MB+).
- Revisão jurídica da política de privacidade.
- Publicação 2.0.0 na Chrome Web Store (manual, pelo responsável) e hospedagem da versão web.

## Monetização futura (sem implementar agora)
O registro de ferramentas já tem um campo de status; um campo `tier` (gratuita/pro) pode ser adicionado sem
reestruturar telas. Recursos pagos devem continuar locais (licença verificada offline).
