export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" className={className} aria-hidden>
      <rect width="128" height="128" rx="28" fill="var(--brand)" />
      <path d="M40 22h36l18 18v60a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6z" fill="#fff" />
      <path d="M76 22v18h18z" fill="#f2a8a8" />
      <rect x="46" y="51" width="30" height="6" rx="3" fill="var(--brand)" />
      <rect x="46" y="63" width="36" height="6" rx="3" fill="var(--brand)" />
      <rect x="46" y="75" width="24" height="6" rx="3" fill="var(--brand)" />
      <rect x="46" y="87" width="16" height="6" rx="3" fill="var(--brand)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-none">
        <span className="block text-[17px] font-bold tracking-tight text-ink">Tudo<span className="text-brand">PDF</span></span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-muted">by BergeS7</span>
      </span>
    </span>
  );
}
