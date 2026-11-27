import { Suspense, Component, type ReactNode } from "react";
import { useRoute, navigate } from "./router";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HomePage } from "@/features/home/HomePage";
import { CategoryPage } from "@/features/home/CategoryPage";
import { InfoPage } from "@/features/home/InfoPages";
import { toolById, CATEGORIES, type CategoryId } from "@/features/registry";
import { Alert, Button } from "@/components/ui";
import { ToolHeader } from "@/features/shared/ToolShell";

export function App() {
  const route = useRoute();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">Pular para o conteúdo</a>
      <Header route={route} />
      <main id="conteudo" className="flex-1">
        <ErrorBoundary key={route}>
          <Suspense fallback={<Loading />}>
            <Routed route={route} />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

function Routed({ route }: { route: string }) {
  const [, section, id] = route.split("/");
  if (section === "ferramenta" && id) {
    const tool = toolById(id);
    if (!tool) return <NotFound />;
    if (tool.status !== "available" || !tool.component) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <ToolHeader tool={tool} />
          <Alert tone="info" title="Ferramenta em desenvolvimento" className="mt-8">
            Esta ferramenta está no roadmap e ainda não está disponível. {tool.note}
          </Alert>
          <Button className="mt-4" onClick={() => navigate("/")}>Ver ferramentas disponíveis</Button>
        </div>
      );
    }
    const Tool = tool.component;
    return <Tool key={tool.id} tool={tool} />;
  }
  if (section === "categoria" && CATEGORIES.some(c => c.id === id)) return <CategoryPage id={id as CategoryId} />;
  if (section === "privacidade" || section === "sobre" || section === "suporte") return <InfoPage page={section} />;
  if (!section) return <HomePage />;
  return <NotFound />;
}

function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16" aria-busy="true">
      <div className="h-8 w-64 animate-pulse rounded bg-surface-3" />
      <div className="mt-4 h-4 w-96 max-w-full animate-pulse rounded bg-surface-3" />
      <div className="mt-8 h-48 animate-pulse rounded-lg bg-surface-3" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Button className="mt-6" variant="primary" onClick={() => navigate("/")}>Ir para o início</Button>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch() {
    // Nenhum conteúdo de documento é registrado.
    console.error("[TudoPDF] erro de interface");
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-16">
          <Alert tone="err" title="Algo deu errado nesta tela">
            {this.state.error.message || "Erro inesperado."} Seus arquivos não foram enviados a lugar nenhum.
          </Alert>
          <Button className="mt-4" onClick={() => { this.setState({ error: null }); navigate("/"); }}>Voltar ao início</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
