export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Desenvolvido por <strong className="font-semibold text-ink-2">BergeS7</strong> · TudoPDF v{__APP_VERSION__}
        </p>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-5 gap-y-1">
          <a className="hover:text-ink" href="#/privacidade">Política de privacidade</a>
          <a className="hover:text-ink" href="#/sobre">Sobre o projeto</a>
          <a className="hover:text-ink" href="#/suporte">Suporte</a>
        </nav>
      </div>
    </footer>
  );
}
