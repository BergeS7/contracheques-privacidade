/**
 * Converte imagens que o pdf-lib não incorpora diretamente (WEBP, GIF, BMP) em PNG,
 * usando o decodificador do próprio navegador. JPEG e PNG passam sem alteração.
 */
import { detectImageKind, LIMITS } from "@/core/validation/file";
import { TudoPdfError } from "@/core/errors";

export async function normalizeImage(name: string, bytes: Uint8Array): Promise<Uint8Array> {
  const kind = detectImageKind(bytes);
  if (kind === "jpeg" || kind === "png") return bytes;
  if (!kind) throw new TudoPdfError("UNSUPPORTED", `${name}: formato de imagem não reconhecido.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
  } catch {
    throw new TudoPdfError("CORRUPTED", `${name}: não foi possível decodificar a imagem.`);
  }
  if (bitmap.width * bitmap.height > LIMITS.maxImagePixels) {
    bitmap.close();
    throw new TudoPdfError("LIMIT", `${name}: imagem grande demais.`);
  }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/png"));
  canvas.width = canvas.height = 0;
  if (!blob) throw new TudoPdfError("UNSUPPORTED", `${name}: falha ao converter a imagem.`);
  return new Uint8Array(await blob.arrayBuffer());
}
