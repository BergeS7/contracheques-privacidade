# Privacidade (privacy by design)

Resumo técnico. A política para usuários está no app (`#/privacidade`) e em `index.html` (GitHub Pages,
URL usada na listagem da Chrome Web Store).

## Princípios aplicados

| Princípio | Como |
|---|---|
| Minimização | O app só lê o arquivo para a operação pedida; não há coleta |
| Processamento local | Core + Web Worker no navegador; CSP `connect-src 'self'` |
| Sem retenção | Documentos só em memória; “Nova operação” e fechar a aba descartam tudo |
| Transparência | Ferramentas não implementadas aparecem como “Em breve”; limitações informadas na tela |
| Controle do usuário | Configurações → apagar preferências e dados locais |
| Sem terceiros | Sem analytics, anúncios, fontes/CDNs remotos ou IA externa |

## O que é armazenado

| Dado | Onde | Conteúdo |
|---|---|---|
| Preferências | `localStorage` (`tudopdf:prefs:v1`) | tema, ids de ferramentas favoritas e recentes |
| Arquivos do app (só PWA) | Cache Storage (`tudopdf-<versão>`) | JS/CSS/fontes/ícones do próprio app |
| Documentos | — | **nunca** |

## LGPD

O TudoPDF não coleta, recebe ou transmite dados pessoais; o tratamento dos documentos permanece sob
responsabilidade de quem os utiliza. **Não afirmamos conformidade integral com a LGPD sem validação
jurídica**; a política publicada é informativa.

## Mudança de escopo na Chrome Web Store (1.2.0 → 2.0.0)

- Nome e descrição mudam para refletir o TudoPDF; o propósito único continua “manipulação local de PDFs”.
- Nenhuma permissão nova. Na aba “Privacidade” do painel do desenvolvedor, as declarações de uso de dados
  continuam “não coleta dados”. Vale citar o uso de localStorage para preferências, se perguntado.
- A política em `index.html` foi atualizada; publique-a (push para o GitHub Pages) **antes** de enviar a 2.0.0.
