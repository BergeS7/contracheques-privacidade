# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versionamento semântico.

## [2.0.0] — não publicada

Transformação do *Organizador de Contracheques* no **TudoPDF — by BergeS7**.

### Adicionado
- Nova base: React 19 + TypeScript + Vite 7 + Tailwind CSS 4, com builds separados para extensão (MV3) e web (PWA).
- Motor de processamento independente da interface (`src/core`) e Web Worker para operações do pdf-lib, com progresso real e cancelamento.
- Registro central de ferramentas que alimenta início, busca, menu, categorias, favoritos e recentes.
- Ferramentas de organização: juntar, dividir, organizar páginas (arrastar e soltar), extrair, excluir, girar, inverter, intercalar, pares/ímpares, duplicar, páginas em branco, alterar tamanho, ordenar documentos A-Z.
- Conversões: JPG/PNG/WEBP → PDF, PDF → JPG/PNG/WEBP, PDF → TXT, PDF → Markdown, TXT → PDF.
- Edição: marca-d'água, numeração, cabeçalho e rodapé (respeitando páginas rotacionadas).
- Segurança: diagnóstico (integridade, criptografia, assinaturas digitais, JavaScript, anexos), remoção de metadados (Info, XMP, PieceInfo), localização de dados pessoais com validação de CPF/CNPJ.
- Automações: busca em vários PDFs e identificação de duplicados (bytes e texto).
- Contracheques: vários PDFs de uma vez, revisão com prévia, correção manual de nomes, indicador de confiança, ordem A-Z e Z-A, filtro, exportação individual, ZIP por funcionário com renomeação por padrão, relatório CSV e lista de inconsistências.
- Tema claro/escuro, layout responsivo, PWA com service worker gerado no build, ícones próprios.
- Página de configurações com exclusão das preferências locais.
- 68 testes automatizados com documentos sintéticos (inclui paridade byte a byte com o filtro da v1.2.0).

### Alterado
- PDF.js 3.11.174 → 6.5.438 (corrige execução de código via PDF malicioso: CVE-2024-4367 e GHSA-hq66-cqwq-w95j).
- O ícone da extensão abre `index.html` (TudoPDF). `app.html` redireciona para o organizador de contracheques.
- Manifest: nome “TudoPDF — Ferramentas PDF e Organizador de Contracheques”, CSP explícita.
- Política de privacidade atualizada (uso de localStorage só para preferências; sem afirmação de conformidade integral com a LGPD).

### Preservado
- Todas as regras de reconhecimento e separação da v1.2.0 (portadas sem alteração e cobertas por testes de regressão).

## [1.2.0] — 2026-09-30
- Versão publicada na Chrome Web Store (Organizador de Contracheques — BergeS7).
