/**
 * Imagens → PDF. JPEG e PNG são incorporados sem recompressão (qualidade original).
 * Outros formatos (WEBP, GIF, BMP) precisam ser decodificados antes pela camada do navegador
 * (ver src/services/imageDecode.ts), que os entrega como PNG ou JPEG.
 */
import { TudoPdfError, throwIfAborted } from "../errors";
import { newDocument, saveDocument, type OpContext } from "../pdf/document";
import { PAPER_SIZES } from "../pdf/organize";
import { detectImageKind } from "../validation/file";

export interface ImageInput {
  name: string;
  bytes: Uint8Array;
}

export interface ImagesToPdfOptions {
  /** "fit": página do tamanho da imagem; senão, tamanho de papel. */
  pageSize: "fit" | keyof typeof PAPER_SIZES;
  orientation: "auto" | "portrait" | "landscape";
  /** Margem em pontos (1 pt = 1/72 pol). */
  margin: number;
}

export async function imagesToPdf(images: ImageInput[], options: ImagesToPdfOptions, ctx: OpContext = {}): Promise<Uint8Array> {
  if (!images.length) throw new TudoPdfError("INVALID_INPUT", "Selecione pelo menos uma imagem.");
  const doc = await newDocument();
  for (const [i, image] of images.entries()) {
    throwIfAborted(ctx.signal);
    const kind = detectImageKind(image.bytes);
    let embedded;
    try {
      if (kind === "jpeg") embedded = await doc.embedJpg(image.bytes);
      else if (kind === "png") embedded = await doc.embedPng(image.bytes);
      else throw new TudoPdfError("UNSUPPORTED", `${image.name}: formato não suportado diretamente (${kind ?? "desconhecido"}).`);
    } catch (error) {
      if (error instanceof TudoPdfError) throw error;
      throw new TudoPdfError("CORRUPTED", `${image.name}: imagem inválida ou corrompida.`);
    }
    const { width: iw, height: ih } = embedded;
    let pw: number, ph: number;
    if (options.pageSize === "fit") {
      pw = iw + 2 * options.margin;
      ph = ih + 2 * options.margin;
    } else {
      [pw, ph] = PAPER_SIZES[options.pageSize];
      const landscape = options.orientation === "auto" ? iw > ih : options.orientation === "landscape";
      if (landscape !== pw > ph) [pw, ph] = [ph, pw];
    }
    const page = doc.addPage([pw, ph]);
    const scale = Math.min((pw - 2 * options.margin) / iw, (ph - 2 * options.margin) / ih, options.pageSize === "fit" ? 1 : Infinity);
    const w = iw * scale;
    const h = ih * scale;
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    ctx.onProgress?.((i + 1) / images.length, `Imagem ${i + 1} de ${images.length}`);
  }
  return saveDocument(doc);
}
