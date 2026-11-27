import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as { version: string };

/**
 * Builds separados (mesmo código):
 *  - web:       dist/web       → PWA com service worker gerado no build (lista de precache).
 *  - extension: dist/extension → Chrome MV3, manifest e background próprios, sem service worker de PWA.
 */
export default defineConfig(({ mode }) => {
  const target = mode === "extension" ? "extension" : "web";
  const outDir = resolve(ROOT, "dist", target);

  return {
    root: resolve(ROOT, "app"),
    publicDir: resolve(ROOT, "public"),
    base: "./",
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TARGET__: JSON.stringify(target)
    },
    resolve: { alias: { "@": resolve(ROOT, "src") } },
    plugins: [
      react(),
      tailwindcss(),
      securityHeaders(target),
      target === "extension" ? extensionFiles(outDir) : pwaServiceWorker()
    ],
    worker: { format: "es" },
    build: {
      outDir,
      emptyOutDir: true,
      target: "es2022",
      sourcemap: false,
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        input: { index: resolve(ROOT, "app/index.html") },
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/pdfjs-dist")) return "pdfjs";
            if (id.includes("node_modules/pdf-lib") || id.includes("node_modules/@pdf-lib")) return "pdf-lib";
            if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react";
            return undefined;
          }
        }
      }
    },
    server: { port: 5173, strictPort: true },
    test: {
      root: ROOT,
      include: ["tests/**/*.test.ts"],
      environment: "node",
      testTimeout: 60_000
    }
  };
});

/**
 * CSP restritiva no build (no dev o Vite precisa de scripts inline para o HMR).
 * connect-src 'self': nenhuma requisição para fora; documentos nunca saem do dispositivo.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-src 'none'"
].join("; ");

function securityHeaders(target: string): Plugin {
  return {
    name: "tudopdf-html",
    apply: "build",
    transformIndexHtml(html) {
      const tags = [`<meta http-equiv="Content-Security-Policy" content="${CSP}" />`];
      if (target === "web") tags.push('<link rel="manifest" href="./manifest.webmanifest" />');
      return html.replace("<!--tudopdf:pwa-->", tags.join("\n  "));
    }
  };
}

function listFiles(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? listFiles(resolve(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`]
  );
}

/** Copia manifest.json, background.js e ícones da extensão para dist/extension. */
function extensionFiles(outDir: string): Plugin {
  return {
    name: "tudopdf-extension-files",
    apply: "build",
    closeBundle() {
      const manifest = JSON.parse(readFileSync(resolve(ROOT, "extension/manifest.json"), "utf8"));
      manifest.version = pkg.version;
      writeFileSync(resolve(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
      copyFileSync(resolve(ROOT, "extension/background.js"), resolve(outDir, "background.js"));
      copyFileSync(resolve(ROOT, "extension/app.html"), resolve(outDir, "app.html"));
      // A PWA não faz sentido dentro da extensão.
      for (const f of ["manifest.webmanifest", "sw.js"]) {
        const p = resolve(outDir, f);
        if (existsSync(p)) rmSync(p);
      }
      mkdirSync(resolve(outDir, "icons"), { recursive: true });
    }
  };
}

/** Gera dist/web/sw.js com a lista exata de arquivos do build (cache offline). */
function pwaServiceWorker(): Plugin {
  return {
    name: "tudopdf-pwa-sw",
    apply: "build",
    generateBundle(_options, bundle) {
      // CMaps (~170 arquivos) entram no cache sob demanda; o resto é pré-carregado.
      const publicFiles = listFiles(resolve(ROOT, "public")).filter(f => !f.startsWith("pdfjs/cmaps/"));
      const files = ["./", ...Object.keys(bundle).filter(f => !f.endsWith(".map")), ...publicFiles];
      const template = readFileSync(resolve(ROOT, "app/sw-template.js"), "utf8");
      const source = template
        .replace("__CACHE_VERSION__", `tudopdf-${pkg.version}-${Date.now().toString(36)}`)
        .replace("const FILES = __BUILD_FILES__;", `const FILES = ${JSON.stringify(files)};`);
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    }
  };
}
