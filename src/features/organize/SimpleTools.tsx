/** Ferramentas de organização com poucas opções (inverter, intercalar, pares/ímpares, duplicar, em branco, A-Z). */
import { useState } from "react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolShell, baseName, pdfBlob, type ToolOutput } from "@/features/shared/ToolShell";
import { Checkbox, NumberInput, Segmented, Select, TextInput } from "@/components/ui";
import { runJob } from "@/services/jobs";
import { parsePageList } from "@/core/pdf/pageRanges";
import { PAPER_SIZES } from "@/core/pdf/organize";
import { compareFilenames } from "@/utils/sort";
import { describeError } from "@/core/errors";
import { useToolFiles, pdfInput } from "@/features/shared/usePageCounts";
import { PageCountNote, pageCountValidation } from "./common";

export default function SimpleTools({ tool }: ToolComponentProps) {
  switch (tool.preset?.mode) {
    case "reverse": return <Reverse tool={tool} />;
    case "interleave": return <Interleave tool={tool} />;
    case "oddeven": return <OddEven tool={tool} />;
    case "duplicate": return <Duplicate tool={tool} />;
    case "blank": return <Blank tool={tool} />;
    case "sortfiles": return <SortFiles tool={tool} />;
    default: return null;
  }
}

function Reverse({ tool }: ToolComponentProps) {
  return (
    <ToolShell tool={tool} actionLabel="Inverter ordem" run={async (fs, ctx) => {
      const bytes = await runJob("reversePages", [pdfInput(fs[0])], ctx);
      return [{ name: `${baseName(fs[0].name)} - invertido.pdf`, blob: pdfBlob(bytes) }];
    }} />
  );
}

function Interleave({ tool }: ToolComponentProps) {
  const [reverse, setReverse] = useState(false);
  return (
    <ToolShell
      tool={tool}
      minFiles={2}
      sortable
      actionLabel="Intercalar"
      options={() => (
        <>
          <p className="text-sm text-muted">Resultado: 1ª página do 1º arquivo, 1ª do 2º, 2ª do 1º...</p>
          <Checkbox label="Inverter o segundo arquivo" hint="Para versos digitalizados da última para a primeira página." checked={reverse} onChange={setReverse} />
        </>
      )}
      run={async (fs, ctx) => {
        const bytes = await runJob("interleave", [fs.map(pdfInput), reverse], ctx);
        return [{ name: `${baseName(fs[0].name)} - intercalado.pdf`, blob: pdfBlob(bytes) }];
      }}
    />
  );
}

function OddEven({ tool }: ToolComponentProps) {
  return (
    <ToolShell tool={tool} actionLabel="Separar" zipName={f => `${baseName(f[0].name)} - pares e ímpares.zip`} run={async (fs, ctx) => {
      const parts = await runJob("splitOddEven", [pdfInput(fs[0])], ctx);
      return parts.map(p => ({ name: `${baseName(fs[0].name)} - ${p.label === "pares" ? "páginas pares" : "páginas ímpares"}.pdf`, blob: pdfBlob(p.bytes) }));
    }} />
  );
}

function Duplicate({ tool }: ToolComponentProps) {
  const [pages, setPages] = useState("1");
  const [copies, setCopies] = useState(1);
  const tf = useToolFiles();
  return (
    <ToolShell
      tool={tool}
      actionLabel="Duplicar páginas"
      onFilesChange={tf.setFiles}
      validate={fs => {
        const pending = pageCountValidation(tf, fs[0]);
        if (pending) return pending;
        if (!Number.isInteger(copies) || copies < 1 || copies > 50) return "Cópias: de 1 a 50.";
        try { parsePageList(pages, tf.total(fs[0])!); return null; } catch (e) { return describeError(e); }
      }}
      options={fs => (
        <>
          <PageCountNote total={tf.total(fs[0])} />
          <TextInput label="Páginas" value={pages} onChange={e => setPages(e.target.value)} hint="Ex.: 1, 3-4 ou todas" />
          <NumberInput label="Cópias de cada página" value={copies} min={1} max={50} onChange={setCopies} />
        </>
      )}
      run={async (fs, ctx) => {
        const list = parsePageList(pages, tf.total(fs[0])!);
        const bytes = await runJob("duplicatePages", [pdfInput(fs[0]), list, copies], ctx);
        return [{ name: `${baseName(fs[0].name)} - com cópias.pdf`, blob: pdfBlob(bytes) }];
      }}
    />
  );
}

function Blank({ tool }: ToolComponentProps) {
  const [where, setWhere] = useState<"start" | "end" | "after-each" | "after">("end");
  const [after, setAfter] = useState("1");
  const [size, setSize] = useState<"match" | keyof typeof PAPER_SIZES>("match");
  const tf = useToolFiles();
  return (
    <ToolShell
      tool={tool}
      actionLabel="Inserir páginas"
      onFilesChange={tf.setFiles}
      validate={fs => {
        const pending = pageCountValidation(tf, fs[0]);
        if (pending) return pending;
        if (where !== "after") return null;
        try { parsePageList(after, tf.total(fs[0])!); return null; } catch (e) { return describeError(e); }
      }}
      options={fs => (
        <>
          <PageCountNote total={tf.total(fs[0])} />
          <Select label="Onde inserir" value={where} onChange={setWhere} options={[
            { value: "start", label: "No início" },
            { value: "end", label: "No fim" },
            { value: "after-each", label: "Após cada página" },
            { value: "after", label: "Após páginas específicas" }
          ]} />
          {where === "after" && <TextInput label="Após as páginas" value={after} onChange={e => setAfter(e.target.value)} hint="Ex.: 2, 5" />}
          <Select label="Tamanho" value={size} onChange={setSize} options={[
            { value: "match", label: "Igual à página vizinha" },
            ...Object.keys(PAPER_SIZES).map(k => ({ value: k as keyof typeof PAPER_SIZES, label: k }))
          ]} />
        </>
      )}
      run={async (fs, ctx) => {
        const position = where === "after" ? parsePageList(after, tf.total(fs[0])!) : where;
        const bytes = await runJob("insertBlankPages", [pdfInput(fs[0]), position, size], ctx);
        return [{ name: `${baseName(fs[0].name)} - com páginas em branco.pdf`, blob: pdfBlob(bytes) }];
      }}
    />
  );
}

function SortFiles({ tool }: ToolComponentProps) {
  const [mode, setMode] = useState<"merge" | "zip">("merge");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  return (
    <ToolShell
      tool={tool}
      minFiles={2}
      actionLabel="Ordenar documentos"
      zipName={() => "documentos em ordem alfabética.zip"}
      options={fs => {
        const sorted = [...fs].sort((a, b) => compareFilenames(a.name, b.name) * (direction === "asc" ? 1 : -1));
        return (
          <>
            <Segmented label="Ordem" value={direction} onChange={setDirection} options={[
              { value: "asc", label: "A → Z" },
              { value: "desc", label: "Z → A" }
            ]} />
            <Segmented label="Resultado" value={mode} onChange={setMode} options={[
              { value: "merge", label: "Um PDF" },
              { value: "zip", label: "ZIP numerado" }
            ]} />
            <div>
              <p className="mb-1 text-[13px] font-medium text-ink-2">Prévia da ordem</p>
              <ol className="max-h-48 list-decimal overflow-auto pl-5 text-xs text-muted">
                {sorted.map(f => <li key={f.id} className="truncate">{f.name}</li>)}
              </ol>
            </div>
          </>
        );
      }}
      run={async (fs, ctx) => {
        const sorted = [...fs].sort((a, b) => compareFilenames(a.name, b.name) * (direction === "asc" ? 1 : -1));
        if (mode === "merge") {
          const bytes = await runJob("merge", [sorted.map(pdfInput)], ctx);
          return [{ name: "documentos em ordem alfabética.pdf", blob: pdfBlob(bytes) }];
        }
        const width = String(sorted.length).length;
        const out: ToolOutput[] = sorted.map((f, i) => ({
          name: `${String(i + 1).padStart(width, "0")} - ${f.name}`,
          blob: pdfBlob(f.bytes)
        }));
        ctx.onProgress(1);
        return out;
      }}
    />
  );
}
