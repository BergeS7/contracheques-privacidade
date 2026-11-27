// Empacota dist/extension em um ZIP pronto para enviar à Chrome Web Store (envio manual).
// Também confere requisitos básicos de Manifest V3 antes de empacotar.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, "dist/extension");
if (!existsSync(dir)) {
  console.error("dist/extension não existe. Rode: npm run build:extension");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8"));
const problems = [];
if (manifest.manifest_version !== 3) problems.push("manifest_version deve ser 3");
if ((manifest.permissions ?? []).length) problems.push(`permissões declaradas: ${manifest.permissions.join(", ")}`);
if (manifest.host_permissions?.length) problems.push("host_permissions não deveriam existir");
if (!/script-src 'self'/.test(manifest.content_security_policy?.extension_pages ?? "")) problems.push("CSP sem script-src 'self'");
for (const size of Object.values(manifest.icons ?? {})) if (!existsSync(resolve(dir, size))) problems.push(`ícone ausente: ${size}`);

const files = [];
(function walk(d) {
  for (const name of readdirSync(d)) {
    const p = resolve(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(dir);

// Nenhum script remoto: procura URLs http(s) em <script src> nos HTML.
for (const f of files.filter(f => f.endsWith(".html"))) {
  const html = readFileSync(f, "utf8");
  if (/<script[^>]+src=["']https?:/i.test(html)) problems.push(`script remoto em ${relative(dir, f)}`);
  if (/<script(?![^>]*src=)[^>]*>[^<]+<\/script>/i.test(html)) problems.push(`script inline em ${relative(dir, f)} (bloqueado pela CSP do MV3)`);
}

if (problems.length) {
  console.error("Problemas encontrados:\n- " + problems.join("\n- "));
  process.exit(1);
}

const zip = new JSZip();
for (const f of files) zip.file(relative(dir, f).replaceAll("\\", "/"), readFileSync(f));
const out = resolve(root, `dist/tudopdf-extensao-${manifest.version}.zip`);
writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } }));
console.log(`OK: ${relative(root, out)} (${files.length} arquivos, MV3, sem permissões, sem scripts remotos)`);
