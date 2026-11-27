import { useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cx } from "@/components/ui";

export function Dropzone({ accept, multiple, onFiles, compact, label, hint }: {
  accept: string;
  multiple: boolean;
  onFiles: (files: File[]) => void;
  compact?: boolean;
  label?: string;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = [...e.dataTransfer.files];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cx(
        "group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors",
        compact ? "gap-2 px-4 py-5" : "gap-3 px-6 py-12",
        over ? "border-brand bg-brand-soft" : "border-line-strong bg-surface hover:border-brand/60"
      )}
    >
      <div className={cx("flex items-center justify-center rounded-full bg-brand-soft text-brand", compact ? "size-9" : "size-12")}>
        <Upload className={compact ? "size-4" : "size-5"} aria-hidden />
      </div>
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cx("font-semibold text-ink after:absolute after:inset-0 after:content-['']", compact ? "text-sm" : "text-base")}
        >
          {label ?? (multiple ? "Selecione ou arraste os arquivos" : "Selecione ou arraste o arquivo")}
        </button>
        <p className="text-xs text-muted">{hint ?? "Os arquivos são processados no seu dispositivo e não são enviados."}</p>
      </div>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        onChange={e => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
