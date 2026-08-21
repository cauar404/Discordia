import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(import.meta.dirname, "_core", "vite.ts"),
  "utf8"
);

describe("cache de ativos do build", () => {
  it("mantém os ativos versionados em cache imutável", () => {
    expect(source).toContain('"/assets"');
    expect(source).toContain("immutable: true");
    expect(source).toContain('maxAge: "1y"');
  });

  it("não aplica cache de longo prazo ao HTML de entrada", () => {
    expect(source).toContain("express.static(distPath, { index: false, maxAge: 0 })");
    expect(source).toContain('res.sendFile(path.resolve(distPath, "index.html"))');
  });
});
