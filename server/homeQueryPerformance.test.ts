import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Home.tsx"), "utf8");

describe("consultas da tela principal", () => {
  it("mantém configurações estáveis em cache e reduz o polling de fallback das chamadas", () => {
    expect(source).toContain("staleTime: 5 * 60_000");
    expect(source).toContain("staleTime: 30_000");
    expect(source.match(/refetchInterval: 8_000/g)).toHaveLength(2);
  });
});
