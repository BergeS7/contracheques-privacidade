/**
 * Organizador de contracheques (evolução da extensão v1.2.0).
 * Fluxo: importar PDFs → reconhecer funcionários → revisar (corrigir nomes, ordem, prévia)
 * → exportar PDF único em ordem alfabética, um PDF por funcionário (ZIP) e relatório.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpZA, Download, FileArchive, FileSpreadsheet, Pencil, Play, RotateCcw, Search, X, Eye, ScanText } from "lucide-react";
import type { ToolComponentProps } from "@/features/registry";
import { ToolHeader, LocalBadge, baseName, pdfBlob } from "@/features/shared/ToolShell";
import { Dropzone } from "@/components/upload/Dropzone";
import { FileList } from "@/components/upload/FileList";
import { loadFile, type LoadedFile } from "@/components/upload/loadedFile";
import { Alert, Badge, Button, IconButton, Panel, ProgressBar, Segmented, TextInput, cx } from "@/components/ui";
import { Thumbnail } from "@/components/pdf-viewer/Thumbnail";
import { usePdfDocuments } from "@/components/pdf-viewer/usePdfDocuments";
import {
  analyzePayroll, applyOverrides, organizeGroups, findInconsistencies, unitLabel,
  type PayrollAnalysis, type PayrollGroup, type PayrollUnit, type SortDirection
} from "@/core/payroll";
import { openTextDoc } from "@/services/pdfjs";
import { runJob } from "@/services/jobs";
import { downloadBlob, makeZip, toCsv, type ZipEntry } from "@/services/download";
import { describeError, isCancelError } from "@/core/errors";
import { fillPattern } from "@/core/payroll/naming";
import { takePendingFiles } from "@/stores/pendingFiles";
import { prefs } from "@/stores/prefs";

const SOURCE_LABEL: Record<PayrollUnit["source"], string> = {
  code: "Código e nome",
  label: "Campo de nome",
  line: "1ª linha da página",
  empty: "Sem texto"
};

const unitKey = (u: PayrollUnit) => `${u.docIndex}:${u.pageNumber}:${u.part}`;

function confidenceOf(group: PayrollGroup) {
  return Math.min(...group.units.map(u => u.confidence));
}

function ConfidenceBadge({ value, manual }: { value: number; manual?: boolean }) {
  if (manual) return <Badge tone="info">Corrigido</Badge>;
  if (value >= 0.9) return <Badge tone="ok">Alta</Badge>;
  if (value >= 0.7) return <Badge tone="ok">Boa</Badge>;
  if (value > 0) return <Badge tone="warn">Baixa</Badge>;
  return <Badge tone="err">Nenhuma</Badge>;
}

export default function PayrollTool({ tool }: ToolComponentProps) {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<PayrollAnalysis | null>(null);
  const [analyzedIds, setAnalyzedIds] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [busy, setBusy] = useState<{ value: number | null; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [pattern, setPattern] = useState("{nome}");
  const [selected, setSelected] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const addFiles = useCallback(async (incoming: File[]) => {
    const errors: string[] = [];
    const loaded: LoadedFile[] = [];
    for (const f of incoming) {
      try {
        const lf = await loadFile(f);
        if (!lf.isPdf) errors.push(`${f.name}: não é um PDF.`);
        else if (lf.encrypted) errors.push(`${f.name}: PDF protegido por senha. Remova a proteção antes.`);
        else loaded.push(lf);
      } catch (e) { errors.push(describeError(e)); }
    }
    setLoadErrors(errors);
    setFiles(prev => [...prev, ...loaded]);
  }, []);

  useEffect(() => {
    const pending = takePendingFiles();
    if (pending.length) void addFiles(pending);
    prefs.pushRecent(tool.id);
    return () => controller.current?.abort();
  }, [addFiles, tool.id]);

  const fileIds = files.map(f => f.id).join("|");
  const stale = analysis !== null && analyzedIds !== fileIds;

  const units = useMemo(() => (analysis ? applyOverrides(analysis.units, overrides) : []), [analysis, overrides]);
  const groups = useMemo(() => organizeGroups(units, direction), [units, direction]);
  const docNames = files.map(f => f.name);
  const issues = useMemo(() => findInconsistencies(groups, docNames), [groups, docNames.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = useMemo(() => {
    const q = filter.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (!q) return groups;
    return groups.filter(g => `${g.name ?? ""} ${g.code ?? ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q));
  }, [groups, filter]);

  const start = () => {
    const ac = new AbortController();
    controller.current = ac;
    setError(null);
    setNotice(null);
    return ac;
  };

  const analyze = async () => {
    const ac = start();
    setBusy({ value: 0, message: "Lendo páginas" });
    try {
      const result = await analyzePayroll(files.map(f => ({ name: f.name, bytes: f.bytes })), openTextDoc, {
        signal: ac.signal,
        onProgress: (value, message) => setBusy({ value, message })
      });
      setAnalysis(result);
      setAnalyzedIds(files.map(f => f.id).join("|"));
      setOverrides({});
      setSelected(null);
    } catch (e) {
      if (isCancelError(e)) setNotice("Leitura cancelada.");
      else setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const sources = () => files.map(f => f.bytes);

  const exportCombined = async () => {
    if (!analysis) return;
    const ac = start();
    setBusy({ value: null, message: "Gerando PDF organizado" });
    try {
      const order = groups.flatMap(g => g.units);
      const { pdfBytes, pageCount } = await runJob("payrollCombined", [sources(), order, analysis.pagesPerDoc], { signal: ac.signal, onProgress: (v, m) => setBusy({ value: v, message: m ?? "Gerando" }) });
      const name = files.length === 1 ? `${baseName(files[0].name)} - ordem alfabetica.pdf` : "contracheques - ordem alfabetica.pdf";
      downloadBlob(pdfBlob(pdfBytes), name);
      const total = analysis.pagesPerDoc.reduce((a, b) => a + b, 0);
      setNotice(`PDF gerado com ${pageCount} página(s). Todo o conteúdo das ${total} página(s) originais entrou exatamente uma vez.`);
    } catch (e) {
      if (!isCancelError(e)) setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const exportZip = async () => {
    const ac = start();
    setBusy({ value: 0, message: "Gerando PDFs individuais" });
    try {
      const parts = await runJob("payrollPerGroup", [sources(), groups.map(g => g.units)], { signal: ac.signal, onProgress: (v, m) => setBusy({ value: v * 0.85, message: m ?? "" }) });
      setBusy({ value: 0.9, message: "Compactando ZIP" });
      const entries: ZipEntry[] = parts.map((bytes, i) => ({ name: fillPattern(pattern, groups[i], i, groups.length, files[0].name), data: bytes }));
      entries.push({ name: "relatorio.csv", data: await reportCsv().text() });
      const zip = await makeZip(entries, p => setBusy({ value: 0.9 + p * 0.1, message: "Compactando ZIP" }));
      downloadBlob(zip, files.length === 1 ? `${baseName(files[0].name)} - por funcionario.zip` : "contracheques por funcionario.zip");
      setNotice(`${parts.length} PDF(s) individuais gerados.`);
    } catch (e) {
      if (!isCancelError(e)) setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const exportOne = async (group: PayrollGroup, index: number) => {
    const ac = start();
    setBusy({ value: null, message: `Gerando ${group.name ?? "PDF"}` });
    try {
      const [bytes] = await runJob("payrollPerGroup", [sources(), [group.units]], { signal: ac.signal });
      downloadBlob(pdfBlob(bytes), fillPattern(pattern, group, index, groups.length, files[0].name));
    } catch (e) {
      if (!isCancelError(e)) setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  function reportCsv() {
    const rows: unknown[][] = [["Ordem", "Nome", "Código", "Páginas originais", "Confiança", "Identificado por", "Corrigido manualmente"]];
    groups.forEach((g, i) => rows.push([
      i + 1, g.name ?? "(sem texto)", g.code ?? "", g.units.map(u => unitLabel(u, docNames)).join(", "),
      `${Math.round(confidenceOf(g) * 100)}%`, SOURCE_LABEL[g.source], g.units.some(u => u.manual) ? "sim" : "não"
    ]));
    if (issues.length) {
      rows.push([], ["Inconsistências"], ["Nível", "Descrição", "Páginas"]);
      for (const it of issues) rows.push([it.level, it.message, it.pages]);
    }
    return toCsv(rows);
  }

  const rename = (group: PayrollGroup, name: string) => {
    setOverrides(o => {
      const next = { ...o };
      for (const u of group.units) next[unitKey(u)] = name;
      return next;
    });
  };

  const reset = () => {
    controller.current?.abort();
    setFiles([]);
    setAnalysis(null);
    setOverrides({});
    setError(null);
    setNotice(null);
    setLoadErrors([]);
  };

  const selectedGroup = groups.find(g => g.key === selected) ?? null;
  const halves = units.filter(u => u.part !== "whole").length;
  const emptyCount = groups.find(g => g.source === "empty")?.units.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10 tp-fade-in">
      <ToolHeader tool={tool} />

      {!files.length && (
        <div className="mt-8 space-y-4">
          <Dropzone accept="application/pdf,.pdf" multiple onFiles={addFiles} label="Selecione ou arraste os PDFs de contracheques" />
          <div className="grid gap-3 text-sm text-muted sm:grid-cols-3">
            <p><strong className="text-ink">Reconhece</strong> “000123 - NOME”, “Nome:”, “Funcionário:” e “Colaborador:”.</p>
            <p><strong className="text-ink">Separa</strong> folhas com dois funcionários e mantém inteiras as duas vias da mesma pessoa.</p>
            <p><strong className="text-ink">Garante</strong> que nenhuma página se perde ou se repete; o texto continua selecionável.</p>
          </div>
        </div>
      )}

      {loadErrors.map((m, i) => <Alert key={i} tone="warn" className="mt-4">{m}</Alert>)}

      {files.length > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            {(!analysis || stale) && (
              <>
                <FileList files={files} onChange={setFiles} sortable />
                <Dropzone compact accept="application/pdf,.pdf" multiple onFiles={addFiles} label="Adicionar mais PDFs" />
              </>
            )}

            {analysis && !stale && (
              <Panel
                title={`${groups.filter(g => g.source !== "empty").length} funcionário(s) · ${units.length} contracheque(s)`}
                actions={<Button size="sm" variant="ghost" icon={Pencil} onClick={() => setAnalysis(null)}>Alterar arquivos</Button>}
              >
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  <div className="relative min-w-48 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                    <input
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                      placeholder="Filtrar por nome ou código"
                      aria-label="Filtrar por nome ou código"
                      className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-sm focus:border-brand focus:outline-none"
                    />
                  </div>
                  <Segmented label="Ordem" value={direction} onChange={setDirection} options={[
                    { value: "asc", label: "A → Z", icon: ArrowDownAZ },
                    { value: "desc", label: "Z → A", icon: ArrowUpZA }
                  ]} />
                </div>
                <div className="overflow-x-auto rounded border border-line">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-surface-2 text-left text-xs text-muted">
                      <tr>
                        <th className="w-10 px-3 py-2">#</th>
                        <th className="px-3 py-2">Nome (clique para corrigir)</th>
                        <th className="px-3 py-2">Código</th>
                        <th className="px-3 py-2">Páginas originais</th>
                        <th className="px-3 py-2">Confiança</th>
                        <th className="w-24 px-3 py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {visible.map(g => {
                        const index = groups.indexOf(g);
                        const manual = g.units.some(u => u.manual);
                        return (
                          <tr key={g.key} className={cx(selected === g.key && "bg-brand-soft/60")}>
                            <td className="px-3 py-1.5 tabular-nums text-muted">{index + 1}</td>
                            <td className="px-3 py-1.5">
                              <NameCell group={g} onRename={name => rename(g, name)} />
                              <p className="text-[11px] text-muted">{SOURCE_LABEL[g.source]}</p>
                            </td>
                            <td className="px-3 py-1.5 font-mono text-xs">{g.code ?? "—"}</td>
                            <td className="px-3 py-1.5 text-xs text-ink-2">{g.units.map(u => unitLabel(u, docNames)).join(", ")}</td>
                            <td className="px-3 py-1.5"><ConfidenceBadge value={confidenceOf(g)} manual={manual} /></td>
                            <td className="px-3 py-1.5">
                              <div className="flex justify-end">
                                <IconButton icon={Eye} label="Pré-visualizar" onClick={() => setSelected(selected === g.key ? null : g.key)} />
                                <IconButton icon={Download} label="Baixar só este" disabled={!!busy} onClick={() => exportOne(g, index)} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {visible.length === 0 && <p className="mt-3 text-sm text-muted">Nenhum nome corresponde ao filtro.</p>}
              </Panel>
            )}

            {selectedGroup && <Preview group={selectedGroup} files={files} onClose={() => setSelected(null)} />}

            {analysis && !stale && issues.length > 0 && (
              <Panel title={`Pontos para revisar (${issues.length})`}>
                <ul className="space-y-2 text-sm">
                  {issues.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <Badge tone={it.level === "erro" ? "err" : "warn"}>{it.level}</Badge>
                      <span className="text-ink-2">{it.message}{it.pages && <span className="text-muted"> · {it.pages}</span>}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {busy ? (
              <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
                <ProgressBar value={busy.value} label={busy.message} />
                <Button icon={X} className="w-full" onClick={() => controller.current?.abort()}>Cancelar</Button>
              </div>
            ) : !analysis || stale ? (
              <Button variant="primary" size="lg" icon={Play} className="w-full" onClick={analyze}>
                {stale ? "Reconhecer novamente" : "Reconhecer funcionários"}
              </Button>
            ) : (
              <Panel title="Exportar">
                <div className="space-y-3">
                  <Button variant="primary" icon={Download} className="w-full" onClick={exportCombined}>PDF único em ordem {direction === "asc" ? "A-Z" : "Z-A"}</Button>
                  <TextInput label="Nome dos arquivos individuais" value={pattern} onChange={e => setPattern(e.target.value)} hint="{nome}, {codigo}, {n} (posição), {arquivo}" />
                  <p className="truncate text-xs text-muted" title={groups[0] ? fillPattern(pattern, groups[0], 0, groups.length, files[0].name) : ""}>
                    Ex.: {groups[0] ? fillPattern(pattern, groups[0], 0, groups.length, files[0].name) : "—"}
                  </p>
                  <Button icon={FileArchive} className="w-full" onClick={exportZip}>Um PDF por funcionário (ZIP)</Button>
                  <Button icon={FileSpreadsheet} variant="ghost" className="w-full" onClick={() => downloadBlob(reportCsv(), "relatorio contracheques.csv")}>Relatório (CSV)</Button>
                </div>
              </Panel>
            )}

            {analysis && !stale && (
              <div className="space-y-1 rounded-lg border border-line bg-surface p-4 text-sm text-ink-2">
                <p>{analysis.pagesPerDoc.reduce((a, b) => a + b, 0)} página(s) em {files.length} arquivo(s)</p>
                {halves > 0 && <p>{halves} contracheque(s) separados de folhas com duas pessoas</p>}
                {emptyCount > 0 && <p className="text-warn">{emptyCount} trecho(s) sem texto ficam no final</p>}
              </div>
            )}

            {emptyCount > 0 && analysis && !stale && (
              <Alert tone="info" title="Páginas digitalizadas">
                <ScanText className="mr-1 inline size-3.5" />Páginas só com imagem não têm texto para reconhecer. Você pode digitar o nome na tabela; o OCR local está planejado.
              </Alert>
            )}
            {error && <Alert tone="err" title="Não foi possível concluir">{error}</Alert>}
            {notice && <Alert tone="ok">{notice}</Alert>}
            <Button variant="ghost" icon={RotateCcw} className="w-full" onClick={reset}>Recomeçar</Button>
            <LocalBadge />
          </aside>
        </div>
      )}
    </div>
  );
}

function NameCell({ group, onRename }: { group: PayrollGroup; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(group.name ?? "");
  if (editing) {
    const commit = () => {
      setEditing(false);
      if (value.trim() && value.trim() !== group.name) onRename(value.trim());
    };
    return (
      <input
        autoFocus
        value={value}
        maxLength={120}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        aria-label="Nome do funcionário"
        className="h-8 w-full rounded border border-brand bg-surface px-2 text-sm focus:outline-none"
      />
    );
  }
  return (
    <button type="button" className="text-left font-medium text-ink hover:text-brand" onClick={() => { setValue(group.name ?? ""); setEditing(true); }}>
      {group.name ?? <em className="font-normal text-muted">Página(s) sem texto: clique para nomear</em>}
    </button>
  );
}

function Preview({ group, files, onClose }: { group: PayrollGroup; files: LoadedFile[]; onClose: () => void }) {
  const needed = useMemo(() => files.filter((_, i) => group.units.some(u => u.docIndex === i)), [files, group]);
  const docs = usePdfDocuments(needed);
  return (
    <Panel title={`Prévia: ${group.name ?? "sem texto"}`} actions={<IconButton icon={X} label="Fechar prévia" onClick={onClose} />}>
      <div className="flex flex-wrap gap-4">
        {group.units.slice(0, 8).map(u => {
          const doc = docs[files[u.docIndex].id];
          return (
            <figure key={unitKey(u)} className="space-y-1">
              {doc && doc !== "erro" ? <UnitThumb doc={doc} unit={u} /> : <div className="aspect-[1/1.414] w-56 animate-pulse rounded bg-surface-3" />}
              <figcaption className="text-xs text-muted">{unitLabel(u, files.length > 1 ? files.map(f => f.name) : undefined)}</figcaption>
            </figure>
          );
        })}
      </div>
      {group.units.length > 8 && <p className="mt-2 text-xs text-muted">Mostrando 8 de {group.units.length}.</p>}
    </Panel>
  );
}

function UnitThumb({ doc, unit }: { doc: import("pdfjs-dist").PDFDocumentProxy; unit: PayrollUnit }) {
  const [clip, setClip] = useState<{ from: number; to: number } | undefined>(undefined);
  useEffect(() => {
    if (unit.part === "whole" || unit.split == null) return;
    let cancelled = false;
    doc.getPage(unit.pageNumber).then(page => {
      const [, y0, , y1] = page.view;
      const f = (y1 - unit.split!) / (y1 - y0); // fração a partir do topo
      if (!cancelled) setClip(unit.part === "top" ? { from: 0, to: f } : { from: f, to: 1 });
    });
    return () => { cancelled = true; };
  }, [doc, unit]);
  return <Thumbnail doc={doc} page={unit.pageNumber} width={224} clip={clip} className="rounded border border-line" />;
}
