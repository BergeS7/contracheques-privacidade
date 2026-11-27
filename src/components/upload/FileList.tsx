import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, GripVertical, Image as ImageIcon, Lock, ShieldAlert, X, ArrowDownAZ } from "lucide-react";
import { formatBytes } from "@/core/validation/file";
import { compareFilenames } from "@/utils/sort";
import { Badge, Button, IconButton, cx } from "@/components/ui";
import type { LoadedFile } from "./loadedFile";

export function FileList({ files, onChange, sortable, extra }: {
  files: LoadedFile[];
  onChange: (files: LoadedFile[]) => void;
  sortable?: boolean;
  extra?: (file: LoadedFile) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = files.findIndex(f => f.id === active.id);
    const to = files.findIndex(f => f.id === over.id);
    onChange(arrayMove(files, from, to));
  };

  return (
    <div className="space-y-2">
      {sortable && files.length > 1 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Arraste para mudar a ordem.</span>
          <Button size="sm" variant="ghost" icon={ArrowDownAZ} onClick={() => onChange([...files].sort((a, b) => compareFilenames(a.name, b.name)))}>
            Ordenar A-Z
          </Button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={files.map(f => f.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {files.map((file, i) => (
              <Row key={file.id} file={file} index={i} sortable={!!sortable && files.length > 1} onRemove={() => onChange(files.filter(f => f.id !== file.id))} extra={extra?.(file)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Row({ file, index, sortable, onRemove, extra }: { file: LoadedFile; index: number; sortable: boolean; onRemove: () => void; extra?: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: file.id, disabled: !sortable });
  const Icon = file.isPdf ? FileText : ImageIcon;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx("flex items-center gap-3 bg-surface px-3 py-2.5", isDragging && "relative z-10 shadow-md")}
    >
      {sortable && (
        <button type="button" className="cursor-grab touch-none text-muted hover:text-ink" aria-label={`Mover ${file.name}`} {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
      )}
      <span className="w-5 text-right text-xs tabular-nums text-muted">{index + 1}</span>
      <Icon className="size-5 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink" title={file.name}>{file.name}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>{formatBytes(file.size)}</span>
          {file.encrypted && <Badge tone="warn"><Lock className="size-3" />Protegido</Badge>}
          {file.signed && <Badge tone="info"><ShieldAlert className="size-3" />Assinatura digital</Badge>}
          {extra}
        </div>
      </div>
      <IconButton icon={X} label={`Remover ${file.name}`} onClick={onRemove} />
    </li>
  );
}
