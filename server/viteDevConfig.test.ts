import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "_core/vite.ts"), "utf8");

describe("configuração da prévia Vite", () => {
  it("resolve a fábrica de configuração no modo de desenvolvimento antes de criar o middleware", () => {
    expect(source).toContain('typeof viteConfig === "function"');
    expect(source).toContain('command: "serve", mode: "development"');
    expect(source).toContain("...resolvedViteConfig");
  });
});
