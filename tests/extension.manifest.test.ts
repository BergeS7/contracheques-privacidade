// Compatibilidade com Manifest V3 e políticas da Chrome Web Store (verificações estáticas).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(__dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "extension/manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("extensão (Manifest V3)", () => {
  it("usa MV3, service worker e nenhuma permissão", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe("background.js");
    expect(manifest.permissions ?? []).toEqual([]);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
  });

  it("tem CSP restritiva sem origens remotas nem unsafe-eval", () => {
    const csp: string = manifest.content_security_policy.extension_pages;
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).not.toMatch(/(?<!wasm-)unsafe-eval|unsafe-inline|https?:/);
    expect(csp).toMatch(/object-src 'none'/);
  });

  it("mantém a versão sincronizada com o package.json e acima da publicada (1.2.0)", () => {
    expect(manifest.version).toBe(pkg.version);
    const [maj] = manifest.version.split(".").map(Number);
    expect(maj).toBeGreaterThanOrEqual(2);
    expect(manifest.name.length).toBeLessThanOrEqual(75);
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });

  it("o código-fonte não contém chamadas de rede nem eval", () => {
    const files = walk(resolve(root, "src")).filter(f => /\.(ts|tsx)$/.test(f));
    for (const f of files) {
      const code = readFileSync(f, "utf8");
      expect(code, f).not.toMatch(/\bfetch\s*\(\s*["'`]https?:/);
      expect(code, f).not.toMatch(/XMLHttpRequest|navigator\.sendBeacon|new WebSocket|\beval\s*\(|new Function\s*\(/);
      expect(code, f).not.toMatch(/https?:\/\/(?!www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}\/[^\s"'`]*\.(js|mjs|css|wasm)/i);
    }
  });
});
