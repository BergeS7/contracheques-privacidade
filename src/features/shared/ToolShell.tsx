/**
 * Estrutura comum das ferramentas: título, upload, lista de arquivos, opções, processamento com
 * progresso real e cancelamento, erros, resultado com download e "nova operação".
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Download, FileArchive, Lock, RotateCcw, ShieldCheck, Star, X, Play } from "lucide-react";
import type { ToolDef } from "@/features/registry";
import { Dropzone } from "@/components/upload/Dropzone";
import { FileList } from "@/components/upload/FileList";
import { loadFile, matchesAccept, type LoadedFile } from "@/components/upload/loadedFile";
import { Alert, Button, IconButton, Panel, ProgressBar, cx } from "@/components/ui";
import { describeError, isCancelError } from "@/core/errors";
import { formatBytes, LIMITS } from "@/core/validation/file";
import { downloadBlob, makeZip } from "@/services/download";
import { takePendingFiles } from "@/stores/pendingFiles";
import { prefs, usePrefs } from "@/stores/prefs";
import { navigate } from "@/app/router";

export interface ToolOutput {
  name: string;
  blob: Blob;
  note?: string;
}

export interface RunContext {
  signal: AbortSignal;
  onProgress: (fraction: number | null, message?: string) => void;
}

export interface ToolShellProps {
  tool: ToolDef;
  minFiles?: number;
  maxFiles?: number;
  sortable?: boolean;
  actionLabel: string;
  /** Opções específicas (renderizadas quando há arquivos). */
  options?: (files: LoadedFile[]) => ReactNode;
  /** Conteúdo adicional abaixo da lista (ex.: grade de páginas). */
  body?: (files: LoadedFile[]) => ReactNode;
  /** Mensagem de bloqueio quando a configuração é inválida; null = pode processar. */
  validate?: (files: LoadedFile[]) => string | null;
  run: (files: LoadedFile[], ctx: RunContext) => Promise<ToolOutput[]>;
  /** Aviso quando o resultado altera o documento (invalida assinaturas digitais). */
  modifiesDocument?: boolean;
  /** Nome do ZIP quando há vários resultados. */
  zipName?: (files: LoadedFile[]) => string;
  /** Conteúdo extra no resultado (ex.: relatório). */
  resultExtra?: ReactNode;
  onReset?: () => void;
  /** Esconde o botão principal (ferramentas que têm fluxo próprio). */
  hideRun?: boolean;
  /** Permite PDFs criptografados (ex.: diagnóstico). */
  allowEncrypted?: boolean;
  /** Notificado sempre que a lista de arquivos muda. */
  onFilesChange?: (files: LoadedFile[]) => void;
}

export function ToolShell(props: ToolShellProps) {
  const { tool, minFiles = 1, maxFiles = tool.multiple ? LIMITS.maxFiles : 1 } = props;
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number | null; message?: string }>({ value: null });
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<ToolOutput[] | null>(null);
  const controller = useRef<AbortController | null>(null);

  const addFiles = useCallback(async (incoming: File[]) => {
    setError(null);
    setOutputs(null);
    const errors: string[] = [];
    const loaded: LoadedFile[] = [];
    for (const file of incoming) {
      try {
        const lf = await loadFile(file);
        if (!matchesAccept(lf, tool.accept)) {
          errors.push(`${file.name}: formato não aceito por esta ferramenta.`);
          continue;
        }
        loaded.push(lf);
      } catch (e) {
        errors.push(describeError(e));
      }
    }
    setLoadErrors(errors);
    setFiles(prev => {
      const next = tool.multiple ? [...prev, ...loaded] : loaded.slice(0, 1);
      if (next.length > maxFiles) {
        errors.push(`Máximo de ${maxFiles} arquivo(s). Os excedentes foram ignorados.`);
        setLoadErrors([...errors]);
      }
      return next.slice(0, maxFiles);
    });
  }, [tool.accept, tool.multiple, maxFiles]);

  // Arquivos soltos na página inicial.
  useEffect(() => {
    const pending = takePendingFiles();
    if (pending.length) void addFiles(pending);
    prefs.pushRecent(tool.id);
  }, [addFiles, tool.id]);

  const { onFilesChange } = props;
  useEffect(() => { onFilesChange?.(files); }, [files, onFilesChange]);

  // Cancela qualquer processamento ao sair da ferramenta.
  useEffect(() => () => controller.current?.abort(), []);

  const reset = () => {
    controller.current?.abort();
    setFiles([]);
    setOutputs(null);
    setError(null);
    setLoadErrors([]);
    props.onReset?.();
  };

  const encrypted = files.filter(f => f.encrypted);
  const signed = files.filter(f => f.signed);
  const validation = files.length < minFiles
    ? (minFiles > 1 ? `Selecione pelo menos ${minFiles} arquivos.` : null)
    : !props.allowEncrypted && encrypted.length
      ? "Há arquivo protegido por senha. Remova a proteção antes de continuar."
      : props.validate?.(files) ?? null;

  const execute = async () => {
    setError(null);
    setOutputs(null);
    setBusy(true);
    setProgress({ value: null, message: "Preparando" });
    const ac = new AbortController();
    controller.current = ac;
    try {
      const result = await props.run(files, {
        signal: ac.signal,
        onProgress: (value, message) => setProgress({ value, message })
      });
      if (!ac.signal.aborted) setOutputs(result);
    } catch (e) {
      setError(isCancelError(e) ? null : describeError(e));
      if (isCancelError(e)) setLoadErrors(["Operação cancelada. Nenhum arquivo foi gerado."]);
      else console.error("[TudoPDF] falha na operação", tool.id);
    } finally {
      setBusy(false);
      controller.current = null;
    }
  };

  const downloadAll = async () => {
    if (!outputs) return;
    const zip = await makeZip(outputs.map(o => ({ name: o.name, data: o.blob })));
    downloadBlob(zip, props.zipName?.(files) ?? `${tool.id}-tudopdf.zip`);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10 tp-fade-in">
      <ToolHeader tool={tool} />

      {!files.length && !outputs && (
        <div className="mt-8">
          <Dropzone accept={tool.accept} multiple={tool.multiple} onFiles={addFiles} />
        </div>
      )}

      {loadErrors.length > 0 && (
        <div className="mt-4 space-y-2">
          {loadErrors.map((m, i) => <Alert key={i} tone="warn">{m}</Alert>)}
        </div>
      )}

      {files.length > 0 && !outputs && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <FileList files={files} onChange={setFiles} sortable={props.sortable} />
            {tool.multiple && files.length < maxFiles && (
              <Dropzone compact accept={tool.accept} multiple onFiles={addFiles} label="Adicionar mais arquivos" />
            )}
            {props.body?.(files)}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {props.options && <Panel title="Opções">{<div className="space-y-4">{props.options(files)}</div>}</Panel>}

            {props.modifiesDocument !== false && signed.length > 0 && (
              <Alert tone="warn" title="Assinatura digital">
                {signed.length === 1 ? "Este PDF tem" : "Há PDFs com"} assinatura digital. Qualquer alteração gera um novo arquivo em que a assinatura deixa de ser válida.
              </Alert>
            )}
            {encrypted.length > 0 && !props.allowEncrypted && (
              <Alert tone="err" title="Arquivo protegido"><Lock className="mr-1 inline size-3.5" />{encrypted.map(f => f.name).join(", ")}</Alert>
            )}

            {!props.hideRun && (
              <div className="space-y-3">
                {busy ? (
                  <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
                    <ProgressBar value={progress.value} label={progress.message ?? "Processando"} />
                    <Button variant="secondary" icon={X} className="w-full" onClick={() => controller.current?.abort()}>Cancelar</Button>
                  </div>
                ) : (
                  <Button variant="primary" size="lg" icon={Play} className="w-full" disabled={!!validation || files.length === 0} onClick={execute}>
                    {props.actionLabel}
                  </Button>
                )}
                {validation && !busy && <p className="text-xs text-muted">{validation}</p>}
              </div>
            )}
            {error && <Alert tone="err" title="Não foi possível concluir">{error}</Alert>}
            <LocalBadge />
          </aside>
        </div>
      )}

      {outputs && (
        <div className="mt-8 space-y-4 tp-fade-in">
          <Panel
            title={outputs.length === 1 ? "Arquivo pronto" : `${outputs.length} arquivos prontos`}
            actions={<Button size="sm" variant="ghost" icon={RotateCcw} onClick={reset}>Nova operação</Button>}
          >
            <ul className="divide-y divide-line">
              {outputs.map((o, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={o.name}>{o.name}</p>
                    <p className="text-xs text-muted">{formatBytes(o.blob.size)}{o.note ? ` · ${o.note}` : ""}</p>
                  </div>
                  <Button size="sm" variant={outputs.length === 1 ? "primary" : "secondary"} icon={Download} onClick={() => downloadBlob(o.blob, o.name)}>Baixar</Button>
                </li>
              ))}
            </ul>
            {outputs.length > 1 && (
              <div className="mt-4 border-t border-line pt-4">
                <Button variant="primary" icon={FileArchive} onClick={downloadAll}>Baixar tudo (ZIP)</Button>
              </div>
            )}
          </Panel>
          {props.resultExtra}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setOutputs(null)}>Voltar às opções</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ToolHeader({ tool }: { tool: ToolDef }) {
  const { favorites } = usePrefs();
  const fav = favorites.includes(tool.id);
  const Icon = tool.icon;
  return (
    <div className="flex items-start gap-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{tool.name}</h1>
          <IconButton
            icon={Star}
            label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            onClick={() => prefs.toggleFavorite(tool.id)}
            className={cx(fav && "text-brand [&_svg]:fill-current")}
          />
        </div>
        <p className="mt-1 text-[15px] text-muted">{tool.description}</p>
        {tool.note && <p className="mt-2 text-xs text-muted">Observação: {tool.note}</p>}
      </div>
      <Button variant="ghost" size="sm" icon={ArrowLeft} className="hidden sm:inline-flex" onClick={() => navigate("/")}>Ferramentas</Button>
    </div>
  );
}

export function LocalBadge() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      <ShieldCheck className="size-3.5 text-ok" aria-hidden />
      Processado neste dispositivo. Nada é enviado pela internet.
    </p>
  );
}

/** Helpers para nomes de saída. */
export const baseName = (name: string) => name.replace(/\.[a-z0-9]{1,5}$/i, "");
export const pdfBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: "application/pdf" });
