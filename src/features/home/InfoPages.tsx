import type { ReactNode } from "react";

/** Páginas institucionais dentro do app (funcionam offline e na extensão). */
export function InfoPage({ page }: { page: "privacidade" | "sobre" | "suporte" }) {
  if (page === "privacidade") return <Privacy />;
  if (page === "sobre") return <About />;
  return <Support />;
}

function Article({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 tp-fade-in">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {updated && <p className="mt-1 text-sm text-muted">Última atualização: {updated}</p>}
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-2 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}

function Privacy() {
  return (
    <Article title="Política de Privacidade" updated="27 de novembro de 2026">
      <section>
        <h2>Resumo</h2>
        <ul>
          <li>Todo o processamento de documentos acontece no seu dispositivo, dentro do navegador.</li>
          <li>Nenhum arquivo, nome, valor ou outro conteúdo é enviado para a internet, para a BergeS7 ou para terceiros.</li>
          <li>Os documentos não são armazenados: ficam na memória da aba e são descartados ao fechá-la ou ao iniciar uma nova operação.</li>
          <li>Não há cookies de rastreamento, publicidade, analytics ou serviços de IA externos.</li>
        </ul>
      </section>
      <section>
        <h2>O que fica guardado no navegador</h2>
        <p>Apenas preferências da interface: tema, ferramentas favoritas e usadas recentemente. Elas podem ser apagadas a qualquer momento em Configurações → Apagar preferências e dados locais.</p>
        <p>Na versão web instalável (PWA), os arquivos do próprio aplicativo ficam em cache para funcionar offline. Esse cache nunca contém documentos do usuário.</p>
      </section>
      <section>
        <h2>Dados tratados</h2>
        <p>Os documentos podem conter dados pessoais (nomes, CPF, salários, endereços). Eles são lidos somente para executar a operação escolhida por você, localmente. O arquivo resultante é salvo apenas quando você clica em baixar, no local que escolher.</p>
      </section>
      <section>
        <h2>Permissões da extensão</h2>
        <p>A extensão do Chrome não solicita permissões especiais. O ícone apenas abre o aplicativo em uma nova aba. Todo o código e as bibliotecas são empacotados na extensão; nenhum código é carregado de servidores.</p>
      </section>
      <section>
        <h2>Segurança</h2>
        <p>Scripts embutidos em PDFs nunca são executados. Arquivos importados são tratados como não confiáveis e validados antes do processamento. Recomendamos guardar os arquivos gerados em local protegido.</p>
      </section>
      <section>
        <h2>LGPD</h2>
        <p>O TudoPDF foi projetado segundo o princípio de privacidade desde a concepção (privacy by design). Como não há coleta nem transmissão de dados, a ferramenta não atua como operadora de dados pessoais. A responsabilidade pelo tratamento dos documentos continua sendo de quem os utiliza. Esta descrição não constitui parecer jurídico.</p>
      </section>
      <section>
        <h2>Contato</h2>
        <p>Dúvidas sobre esta política: <a className="text-brand underline" href="mailto:oigresyt7@gmail.com">oigresyt7@gmail.com</a>.</p>
      </section>
    </Article>
  );
}

function About() {
  return (
    <Article title="Sobre o TudoPDF">
      <p><strong className="text-ink">Tudo em PDF. Tudo em um só lugar.</strong> O TudoPDF reúne ferramentas para organizar, converter, editar e automatizar documentos PDF, com um diferencial: tudo é processado no seu dispositivo.</p>
      <section>
        <h2>Origem</h2>
        <p>O projeto nasceu como o <em>Organizador de Contracheques — BergeS7</em>, extensão que ordena contracheques de A a Z e separa folhas com dois funcionários. Essa função continua disponível, agora com revisão manual, exportação por funcionário e relatório.</p>
      </section>
      <section>
        <h2>Tecnologia</h2>
        <ul>
          <li>PDF.js (Mozilla, Apache 2.0) para leitura e renderização.</li>
          <li>pdf-lib (MIT) para montar e modificar PDFs.</li>
          <li>JSZip (MIT/GPLv3, usado sob MIT) para pacotes ZIP.</li>
          <li>React, Tailwind CSS e Lucide (MIT/ISC) na interface.</li>
        </ul>
      </section>
      <section>
        <h2>Transparência</h2>
        <p>Ferramentas marcadas como “Em breve” ainda não estão implementadas. Nenhuma ferramenta finge processar: quando algo não é possível localmente, isso é informado.</p>
      </section>
      <p className="text-sm text-muted">Versão {__APP_VERSION__}.</p>
    </Article>
  );
}

function Support() {
  return (
    <Article title="Suporte">
      <section>
        <h2>Fale com a BergeS7</h2>
        <p>E-mail: <a className="text-brand underline" href="mailto:oigresyt7@gmail.com">oigresyt7@gmail.com</a>. Descreva a ferramenta usada e o que aconteceu. <strong className="text-ink">Não envie documentos com dados pessoais</strong>; se precisar de um exemplo, use um arquivo fictício.</p>
      </section>
      <section>
        <h2>Problemas comuns</h2>
        <ul>
          <li><strong className="text-ink">“PDF protegido por senha”</strong>: remova a proteção no programa de origem antes de usar.</li>
          <li><strong className="text-ink">Nenhum texto encontrado</strong>: o PDF é uma digitalização (imagem). O OCR local está no roadmap.</li>
          <li><strong className="text-ink">Arquivo muito grande</strong>: o limite é 500 MB por arquivo, por causa da memória do navegador.</li>
          <li><strong className="text-ink">Assinatura digital</strong>: qualquer alteração gera um novo arquivo, e a assinatura original deixa de valer.</li>
        </ul>
      </section>
    </Article>
  );
}
