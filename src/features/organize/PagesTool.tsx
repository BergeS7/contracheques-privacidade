/**
 * Organizar páginas: grade de miniaturas com arrastar e soltar. Gira, duplica, exclui e insere
 * páginas em branco; aceita vários PDFs (as páginas podem ser misturadas).
 */
import { useEffect, useMemo, useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, FilePlus2, RotateCcw, RotateCw, Trash2, Undo2, Redo2, ArrowDownUp } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { Button, IconButton, cx } from "@/components/ui";
import { Thumbnail } from "@/components/pdf-viewer/Thumbnail";
import { usePdfDocuments } from "@/components/pdf-viewer/usePdfDocuments";
import type { LoadedFile } from "@/components/upload/loadedFile";
import { runJob } from "@/services/jobs";
import { pdfInput } from "@/features/shared/usePageCounts";
import type { PageSpec } from "@/core/pdf/organize";

interface Card {
  key: string;
  fileId: string | null; // null = página em branco
  page: number;
  rotate: number;
  size?: [number, number];
}

let seq = 0;
const newKey = () => `c${(seq++).toString(36)}`;

export default function PagesTool({ tool }: ToolComponentProps) {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const docs = usePdfDocuments(files);
  const [history, setHistory] = useState<{ stack: Card[][]; index: number }>({ stack: [[]], index: 0 });
  const cards = history.stack[history.index];

  const commit = (next: Card[] | ((prev: Card[]) => Card[])) =>
    setHistory(h => {
      const value = typeof next === "function" ? next(h.stack[h.index]) : next;
      const stack = [...h.stack.slice(0, h.index + 1), value].slice(-100);
      return { stack, index: stack.length - 1 };
    });

  // Novos arquivos: páginas adicionadas ao fim; arquivos removidos: páginas retiradas.
  const fileIds = files.map(f => f.id).join("|");
  useEffect(() => {
    const ids = new Set(files.map(f => f.id));
    const present = new Set(cards.filter(c => c.fileId).map(c => c.fileId));
    let next = cards.filter(c => c.fileId === null || ids.has(c.fileId));
    const additions: Card[] = [];
    for (const file of files) {
      const doc = docs[file.id];
      if (present.has(file.id) || !doc || doc === "erro") continue;
      for (let p = 1; p <= doc.numPages; p++) additions.push({ key: newKey(), fileId: file.id, page: p, rotate: 0 });
    }
    if (additions.length || next.length !== cards.length) {
      next = [...next, ...additions];
      setHistory({ stack: [next], index: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileIds, docs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    commit(arrayMove(cards, cards.findIndex(c => c.key === active.id), cards.findIndex(c => c.key === over.id)));
  };

  const update = (key: string, fn: (c: Card) => Card[]) =>
    commit(prev => prev.flatMap(c => (c.key === key ? fn(c) : [c])));

  // Página em branco com o tamanho da página vizinha (lido do PDF.js; A4 se indisponível).
  const insertBlankAfter = async (c: Card) => {
    let size: [number, number] = c.size ?? [595.28, 841.89];
    const doc = c.fileId ? docs[c.fileId] : null;
    if (doc && doc !== "erro") {
      const page = await doc.getPage(c.page);
      const [x0, y0, x1, y1] = page.view;
      size = page.rotate % 180 === 0 ? [x1 - x0, y1 - y0] : [y1 - y0, x1 - x0];
    }
    update(c.key, card => [card, { key: newKey(), fileId: null, page: 0, rotate: 0, size }]);
  };

  const fileIndex = useMemo(() => new Map(files.map((f, i) => [f.id, i])), [files]);
  const multi = files.length > 1;

  return (
    <ToolShell
      tool={tool}
      onFilesChange={setFiles}
      actionLabel="Aplicar alterações"
      validate={() => (cards.length === 0 ? "Nenhuma página no resultado." : Object.values(docs).includes("erro") ? "Há um PDF que não pôde ser lido." : null)}
      options={() => (
        <>
          <p className="text-sm text-muted">
            <strong className="text-ink">{cards.length}</strong> página(s) no resultado.
            Arraste as miniaturas para reordenar. Atalhos: Ctrl+Z / Ctrl+Y.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={Undo2} disabled={history.index === 0} onClick={() => setHistory(h => ({ ...h, index: h.index - 1 }))}>Desfazer</Button>
            <Button size="sm" icon={Redo2} disabled={history.index >= history.stack.length - 1} onClick={() => setHistory(h => ({ ...h, index: h.index + 1 }))}>Refazer</Button>
            <Button size="sm" icon={ArrowDownUp} disabled={!cards.length} onClick={() => commit([...cards].reverse())}>Inverter</Button>
          </div>
        </>
      )}
      body={() => (
        <div
          className="rounded-lg border border-line bg-surface-2 p-3"
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); setHistory(h => ({ ...h, index: Math.max(0, h.index - 1) })); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); setHistory(h => ({ ...h, index: Math.min(h.stack.length - 1, h.index + 1) })); }
          }}
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={cards.map(c => c.key)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3">
                {cards.map((card, i) => {
                  const doc = card.fileId ? docs[card.fileId] : null;
                  return (
                    <PageCard
                      key={card.key}
                      card={card}
                      index={i}
                      doc={doc && doc !== "erro" ? doc : null}
                      label={card.fileId ? `${multi ? `${String.fromCharCode(65 + (fileIndex.get(card.fileId) ?? 0))}·` : ""}p.${card.page}` : "Em branco"}
                      onRotate={d => update(card.key, c => [{ ...c, rotate: (c.rotate + d + 360) % 360 }])}
                      onDuplicate={() => update(card.key, c => [c, { ...c, key: newKey() }])}
                      onDelete={() => update(card.key, () => [])}
                      onBlank={() => void insertBlankAfter(card)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
          {multi && <p className="mt-3 text-xs text-muted">Letras indicam o arquivo de origem: A = 1º arquivo, B = 2º...</p>}
        </div>
      )}
      run={async (fs, ctx) => {
        const index = new Map(fs.map((f, i) => [f.id, i]));
        const specs: PageSpec[] = [];
        for (const c of cards) {
          if (c.fileId === null) {
            specs.push({ kind: "blank", width: c.size?.[0] ?? 595.28, height: c.size?.[1] ?? 841.89 });
          } else {
            specs.push({ kind: "page", doc: index.get(c.fileId)!, page: c.page, rotate: c.rotate });
          }
        }
        const bytes = await runJob("composePages", [fs.map(pdfInput), specs], ctx);
        return [{ name: `${baseName(fs[0].name)} - organizado.pdf`, blob: pdfBlob(bytes), note: `${specs.length} páginas` }];
      }}
    />
  );
}

function PageCard({ card, index, doc, label, onRotate, onDuplicate, onDelete, onBlank }: {
  card: Card; index: number; doc: PDFDocumentProxy | null; label: string;
  onRotate: (deg: number) => void; onDuplicate: () => void; onDelete: () => void; onBlank: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.key });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx("group flex flex-col rounded-md border border-line bg-surface p-2 shadow-sm", isDragging && "z-10 ring-2 ring-brand")}
    >
      <div
        className="flex h-40 cursor-grab touch-none items-center justify-center overflow-hidden rounded bg-surface-3"
        aria-label={`Página ${index + 1}: ${label}. Arraste para mover.`}
        {...attributes}
        {...listeners}
      >
        <div style={{ transform: `rotate(${card.rotate}deg)`, transition: "transform 150ms" }} className="max-h-full">
          {card.fileId === null
            ? <div className="flex aspect-[1/1.414] w-24 items-center justify-center bg-white text-[11px] text-zinc-400 shadow-sm">em branco</div>
            : doc ? <Thumbnail doc={doc} page={card.page} width={96} className="shadow-sm" /> : <div className="aspect-[1/1.414] w-24 animate-pulse bg-surface" />}
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs font-medium tabular-nums text-ink-2">{index + 1} <span className="font-normal text-muted">· {label}</span></span>
      </div>
      <div className="mt-1 flex justify-between opacity-80 group-hover:opacity-100 group-focus-within:opacity-100">
        <IconButton icon={RotateCcw} label="Girar à esquerda" className="size-7" onClick={() => onRotate(-90)} />
        <IconButton icon={RotateCw} label="Girar à direita" className="size-7" onClick={() => onRotate(90)} />
        <IconButton icon={Copy} label="Duplicar" className="size-7" onClick={onDuplicate} />
        <IconButton icon={FilePlus2} label="Inserir página em branco depois" className="size-7" onClick={onBlank} />
        <IconButton icon={Trash2} label="Excluir" className="size-7 hover:text-err" onClick={onDelete} />
      </div>
    </li>
  );
}
