import { CATEGORIES, TOOLS, type CategoryId } from "@/features/registry";
import { ToolCard } from "./ToolCard";

export function CategoryPage({ id }: { id: CategoryId }) {
  const cat = CATEGORIES.find(c => c.id === id)!;
  const tools = TOOLS.filter(t => t.category === id);
  const available = tools.filter(t => t.status === "available");
  const planned = tools.filter(t => t.status !== "available");
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 tp-fade-in">
      <h1 className="text-3xl font-bold tracking-tight">{cat.name}</h1>
      <p className="mt-2 text-muted">{cat.description}</p>
      {available.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{available.map(t => <ToolCard key={t.id} tool={t} />)}</div>
      )}
      {planned.length > 0 && (
        <>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">No roadmap</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{planned.map(t => <ToolCard key={t.id} tool={t} />)}</div>
        </>
      )}
    </div>
  );
}
