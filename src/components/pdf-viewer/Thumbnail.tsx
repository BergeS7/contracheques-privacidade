import { memo, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPage } from "@/services/pdfjs";
import { cx } from "@/components/ui";

/**
 * Miniatura renderizada sob demanda: só desenha quando entra na tela (IntersectionObserver)
 * e descarta o canvas ao sair do DOM.
 */
export const Thumbnail = memo(function Thumbnail({ doc, page, width = 140, rotation = 0, clip, className }: {
  doc: PDFDocumentProxy;
  page: number;
  width?: number;
  rotation?: number;
  /** Mostra só uma faixa da página (fração do topo, 0..1): usado nas metades de contracheques. */
  clip?: { from: number; to: number };
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let canvas: HTMLCanvasElement | null = null;
    renderPage(doc, page, width, rotation)
      .then(c => {
        if (cancelled || !box.current) { c.width = c.height = 0; return; }
        canvas = c;
        c.className = "block h-auto w-full";
        c.setAttribute("aria-hidden", "true");
        box.current.replaceChildren(c);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (canvas) canvas.width = canvas.height = 0;
    };
  }, [visible, doc, page, width, rotation]);

  // Recorte: a moldura mostra só a faixa pedida (a página inteira é deslocada para cima).
  const [aspect, setAspect] = useState<number | null>(null);
  useEffect(() => {
    if (!clip || !visible) return;
    let cancelled = false;
    doc.getPage(page).then(p => {
      const v = p.getViewport({ scale: 1, rotation: (p.rotate + rotation) % 360 });
      if (!cancelled) setAspect(v.height / v.width);
    });
    return () => { cancelled = true; };
  }, [clip, visible, doc, page, rotation]);
  const fullHeight = aspect ? width * aspect : null;
  const frameStyle = clip && fullHeight ? { width, height: fullHeight * (clip.to - clip.from) } : { width };
  const innerStyle = clip && fullHeight ? { marginTop: -fullHeight * clip.from } : undefined;

  return (
    <div className={cx("relative overflow-hidden bg-white", className)} style={frameStyle}>
      <div ref={box} style={innerStyle} className="min-h-24">
        {!failed && <div className="aspect-[1/1.414] w-full animate-pulse bg-surface-3" />}
      </div>
      {failed && <div className="flex aspect-[1/1.414] items-center justify-center text-xs text-muted">Sem prévia</div>}
    </div>
  );
});
