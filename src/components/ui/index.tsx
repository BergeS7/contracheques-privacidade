/** Componentes básicos de interface (botões, campos, avisos, progresso). */
import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-strong shadow-sm disabled:opacity-50",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-3 disabled:opacity-50",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-40",
  danger: "bg-surface text-err border border-line-strong hover:bg-err-soft disabled:opacity-50"
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2"
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon: Icon, className, children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors select-none whitespace-nowrap disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {Icon && <Icon className={size === "sm" ? "size-4" : "size-[18px]"} aria-hidden />}
      {children}
    </button>
  );
});

export function IconButton({ icon: Icon, label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx("inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink transition-colors disabled:opacity-40", className)}
      {...rest}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const inputBase = "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function TextInput({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input id={id} className={cx(inputBase, className)} {...rest} />
    </Field>
  );
}

export function NumberInput({ label, hint, value, onChange, min, max, step = 1 }: {
  label: string; hint?: ReactNode; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={inputBase}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      />
    </Field>
  );
}

export function Select<T extends string>({ label, hint, value, onChange, options, ...rest }: Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  label: string; hint?: ReactNode; value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} className={cx(inputBase, "pr-8")} value={value} onChange={e => onChange(e.target.value as T)} {...rest}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Segmented<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: LucideIcon }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-md border border-line-strong bg-surface-2 p-0.5">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[13px] font-medium transition-colors",
              value === o.value ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
            )}
          >
            {o.icon && <o.icon className="size-4" aria-hidden />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Checkbox({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={value} onChange={e => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-line-strong bg-surface p-1" />
        <span className="font-mono text-xs text-muted uppercase">{value}</span>
      </div>
    </Field>
  );
}

type Tone = "info" | "ok" | "warn" | "err";
const TONE: Record<Tone, { cls: string; icon: LucideIcon }> = {
  info: { cls: "bg-info-soft text-info border-info/20", icon: Info },
  ok: { cls: "bg-ok-soft text-ok border-ok/20", icon: CheckCircle2 },
  warn: { cls: "bg-warn-soft text-warn border-warn/25", icon: AlertTriangle },
  err: { cls: "bg-err-soft text-err border-err/20", icon: XCircle }
};

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  const { cls, icon: Icon } = TONE[tone];
  return (
    <div role={tone === "err" ? "alert" : "status"} className={cx("flex gap-3 rounded-md border px-3.5 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-2 [&_a]:underline">{children}</div>}
      </div>
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone | "neutral" | "brand"; children: ReactNode }) {
  const cls = {
    neutral: "bg-surface-3 text-ink-2",
    brand: "bg-brand-soft text-brand",
    info: "bg-info-soft text-info",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    err: "bg-err-soft text-err"
  }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", cls)}>{children}</span>;
}

export function ProgressBar({ value, label }: { value: number | null; label?: string }) {
  const pct = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted">
        <span className="truncate">{label}</span>
        {pct !== null && <span className="tabular-nums">{pct}%</span>}
      </div>
      <div
        className="relative h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-label={label}
      >
        {pct === null
          ? <div className="tp-indeterminate absolute inset-y-0 w-2/5 rounded-full bg-brand" />
          : <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg border border-line bg-surface", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <div className="flex items-center gap-1">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
