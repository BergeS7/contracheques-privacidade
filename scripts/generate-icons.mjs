// Gera os ícones PNG do TudoPDF (extensão + PWA) sem dependências externas.
// Desenho: quadrado vermelho com cantos arredondados e uma folha branca com canto dobrado.
// Rasterização com supersampling 4x4 e compressão via zlib do Node.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "public/icons");
mkdirSync(out, { recursive: true });

const RED = [214, 40, 40];
const RED_DARK = [160, 24, 24];
const WHITE = [255, 255, 255];
const LINE = [214, 40, 40];

// Coordenadas no espaço 0..128 (mesmo do logo.svg).
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Folha: retângulo 34..94 x 22..106 com canto superior direito cortado (dobra de 18).
function inSheet(x, y) {
  if (!inRoundRect(x, y, 34, 22, 94, 106, 6)) return false;
  return !(x > 76 && y < 22 + (x - 76)); // diagonal do canto
}
function inFold(x, y) {
  return x >= 76 && x <= 94 && y >= 22 && y <= 40 && y >= 22 + (x - 76) - 0.0001 && x - 76 <= 18 && y <= 40;
}

function shade(x, y, maskable) {
  const inset = maskable ? 0 : 0;
  const bgRadius = maskable ? 0 : 28;
  if (!inRoundRect(x, y, inset, inset, 128 - inset, 128 - inset, bgRadius)) return null;
  // Em ícones maskable o desenho encolhe para a zona segura (80%).
  const s = maskable ? 0.78 : 1;
  const ux = (x - 64) / s + 64;
  const uy = (y - 64) / s + 64;
  if (inFold(ux, uy) && ux - 76 >= uy - 22) return RED_DARK.map(c => Math.min(255, c + 60));
  if (inSheet(ux, uy)) {
    // Linhas de texto (barras vermelhas)
    const bars = [[46, 54, 76], [46, 66, 82], [46, 78, 70], [46, 90, 62]];
    for (const [bx, by, bw] of bars) {
      if (inRoundRect(ux, uy, bx, by - 3, bw, by + 3, 3)) return LINE;
    }
    return WHITE;
  }
  return RED;
}

function render(size, maskable = false) {
  const SS = 4;
  const px = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const x = ((i + (si + 0.5) / SS) / size) * 128;
          const y = ((j + (sj + 0.5) / SS) / size) * 128;
          const c = shade(x, y, maskable);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
        }
      }
      const o = (j * size + i) * 4;
      const n = SS * SS;
      if (a) { px[o] = r / a; px[o + 1] = g / a; px[o + 2] = b / a; }
      px[o + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const size of [16, 32, 48, 128, 192, 512]) {
  writeFileSync(resolve(out, `icon-${size}.png`), render(size));
}
writeFileSync(resolve(out, "maskable-512.png"), render(512, true));

writeFileSync(resolve(out, "logo.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="TudoPDF">
  <rect width="128" height="128" rx="28" fill="#d62828"/>
  <path d="M40 22h36l18 18v60a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6z" fill="#fff"/>
  <path d="M76 22v18h18z" fill="#f2a8a8"/>
  <rect x="46" y="51" width="30" height="6" rx="3" fill="#d62828"/>
  <rect x="46" y="63" width="36" height="6" rx="3" fill="#d62828"/>
  <rect x="46" y="75" width="24" height="6" rx="3" fill="#d62828"/>
  <rect x="46" y="87" width="16" height="6" rx="3" fill="#d62828"/>
</svg>
`);
console.log("Ícones gerados em public/icons/");
