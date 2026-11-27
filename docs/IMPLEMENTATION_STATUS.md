# Status de implementação

Legenda: **Testada** (motor com testes automatizados + verificada na interface) · **Implementada** (funciona, sem teste automatizado próprio) · **Em desenvolvimento** · **Planejada** · **Bloqueada** (depende de decisão técnica/licença).

Última revisão: 27/11/2026 — v2.0.0 (não publicada).

## Fundação
| Item | Status | Observações |
|---|---|---|
| Arquitetura modular, core independente da UI | Testada | `src/core`, 68 testes |
| Registro central de ferramentas | Implementada | início, busca, menu, categorias, favoritos, recentes, rotas |
| Identidade visual, tema claro/escuro, responsivo | Implementada | verificado em 375 px sem rolagem horizontal |
| Upload com arrastar e soltar, lista reordenável | Implementada | |
| Visualizador/miniaturas sob demanda | Implementada | IntersectionObserver; virtualização completa ainda não |
| Web Worker com progresso e cancelamento | Implementada | |
| Extensão MV3 (2.0.0) | Testada | teste estático do manifest; ZIP gerado com verificações. **Não carregada no Chrome nesta sessão** |
| PWA (service worker, manifest, ícones) | Implementada | `sw.js` gerado e válido; **registro não verificado** (o navegador embutido usado nos testes recusa service workers) |

## Organizar
| Ferramenta | Status | Observações |
|---|---|---|
| Juntar | Testada | |
| Dividir (intervalos, a cada N, cada página) | Testada | |
| Extrair páginas | Testada | um PDF ou um por página |
| Excluir páginas | Testada | |
| Duplicar páginas | Testada | |
| Girar | Testada | soma à rotação existente |
| Organizar páginas (arrastar e soltar, desfazer/refazer) | Implementada | motor `composePages` testado |
| Inverter ordem | Testada | |
| Intercalar | Testada | com opção de inverter o 2º |
| Pares e ímpares | Testada | |
| Inserir páginas em branco | Testada | tamanho da página vizinha |
| Alterar tamanho | Testada | vetorial, texto selecionável |
| Ordenar documentos A-Z | Implementada | ordenação natural testada |
| Recortar | Planejada | precisa remover conteúdo fora da área (não só CropBox) |
| Comprimir | Bloqueada | recompressão de imagens; MuPDF é AGPL. Avaliar QPDF + recompressão via canvas |

## Converter
| Ferramenta | Status | Observações |
|---|---|---|
| JPG/PNG → PDF | Testada | sem recompressão |
| WEBP → PDF | Implementada | decodificado pelo navegador para PNG (sem perda) |
| PDF → JPG/PNG/WEBP | Implementada | 96/150/300 DPI |
| PDF → TXT | Testada | |
| PDF → Markdown | Testada | heurística de títulos/listas; tabelas não |
| TXT → PDF | Testada | WinAnsi: emojis e alfabetos não latinos viram “?” |
| PDF ↔ Word, Excel, PowerPoint | Bloqueada | sem motor local viável no navegador |
| HTML → PDF | Planejada | |
| Imagens → PDF pesquisável | Planejada | depende do OCR |

## Editar
| Ferramenta | Status | Observações |
|---|---|---|
| Marca-d'água | Testada | centralizada/mosaico, páginas selecionadas, páginas rotacionadas |
| Numeração | Testada | |
| Cabeçalho e rodapé | Testada | |
| Editor visual (texto, imagem, formas, setas, desenho, camadas) | Planejada | fase 3 |
| Destaque, sublinhado, comentários, carimbos | Planejada | |
| Assinatura manuscrita (desenho/imagem) | Planejada | não será apresentada como assinatura digital |
| Editar texto existente | Planejada | viável só em casos simples |

## Segurança
| Ferramenta | Status | Observações |
|---|---|---|
| Inspecionar metadados / diagnóstico | Testada | integridade, %%EOF, criptografia, assinaturas, JS, anexos, edições incrementais |
| Remover metadados | Testada | Info, XMP, PieceInfo |
| Identificar CPF, CNPJ, e-mail, telefone | Testada | dígitos verificadores |
| Detectar PDFs corrompidos e criptografados | Testada | |
| Alerta de assinatura digital invalidada | Implementada | aviso antes de processar |
| Proteger com senha | Bloqueada | pdf-lib não criptografa; avaliar QPDF WASM |
| Remover senha | Planejada | |
| Ocultação permanente (tarja) | Planejada | base existente: `removeTextOutside` |

## OCR
| Item | Status |
|---|---|
| OCR local (por/eng), PDF pesquisável, campos, tabelas | Planejada (Tesseract.js) |

## Automações
| Item | Status | Observações |
|---|---|---|
| Contracheques A-Z (regras v1.2.0) | Testada | regressão + paridade |
| Separação de folhas com duas pessoas / duas vias | Testada | |
| Vários PDFs simultâneos | Testada | |
| Pré-visualização | Implementada | recorte da metade |
| Correção manual de nome | Testada | |
| Indicador de confiança | Implementada | código 95%, campo 80%, 1ª linha 30% |
| Ordem crescente/decrescente | Testada | |
| Exportação individual e ZIP por funcionário | Testada | |
| Renomeação por padrão | Testada | `{nome}`, `{codigo}`, `{n}`, `{arquivo}` |
| Relatório de inconsistências | Testada | código com nomes diferentes, páginas sem texto |
| Buscar em vários PDFs | Implementada | `searchText` testado |
| Identificar duplicados | Implementada | SHA-256 de bytes e de texto |
| OCR para contracheques digitalizados | Planejada | |
| Agrupar por CPF/CNPJ/empresa/data, recibos, notas, fichas | Planejada | |
| Comparar PDFs | Planejada | |
| Regras e fluxos reutilizáveis | Planejada | |

## Testes ainda não cobertos
- E2E automatizado (Playwright) — a verificação de interface desta versão foi manual, no navegador.
- PDFs reais digitalizados e protegidos com senha (os testes usam marcadores sintéticos).
- Medição de desempenho com documentos de centenas de MB.
