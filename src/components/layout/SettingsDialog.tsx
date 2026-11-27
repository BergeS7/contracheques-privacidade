import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button, IconButton, Segmented } from "@/components/ui";
import { prefs, usePrefs, type ThemePref } from "@/stores/prefs";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { theme, favorites, recent } = usePrefs();
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); setCleared(false); }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose(); }}
      className="m-auto w-[min(92vw,460px)] rounded-lg border border-line bg-surface p-0 text-ink shadow-md backdrop:bg-black/40"
      aria-labelledby="settings-title"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 id="settings-title" className="font-semibold">Configurações</h2>
        <IconButton icon={X} label="Fechar" onClick={onClose} />
      </div>
      <div className="space-y-6 px-5 py-5">
        <Segmented<ThemePref> label="Tema" value={theme} onChange={t => prefs.setTheme(t)} options={[
          { value: "system", label: "Sistema" },
          { value: "light", label: "Claro" },
          { value: "dark", label: "Escuro" }
        ]} />
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium text-ink-2">Dados locais</h3>
          <p className="text-sm text-muted">
            O TudoPDF guarda neste navegador apenas preferências: tema, {favorites.length} favorito(s) e {recent.length} ferramenta(s) recente(s).
            Documentos nunca são armazenados.
          </p>
          <Button variant="danger" icon={Trash2} onClick={() => { prefs.clearAll(); setCleared(true); }}>Apagar preferências e dados locais</Button>
          {cleared && <p className="text-sm text-ok">Dados locais apagados.</p>}
        </div>
        <p className="text-xs text-muted">Versão {__APP_VERSION__} · {__BUILD_TARGET__ === "extension" ? "Extensão do Chrome" : "Aplicação web"}</p>
      </div>
    </dialog>
  );
}
