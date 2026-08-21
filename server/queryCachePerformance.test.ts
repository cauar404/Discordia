import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/main.tsx"), "utf8");

describe("política de cache do cliente", () => {
  it("evita refetches automáticos frequentes sem desativar as invalidações em tempo real", () => {
    expect(source).toContain("staleTime: 15_000");
    expect(source).toContain("gcTime: 5 * 60_000");
    expect(source).toContain("refetchOnWindowFocus: false");
    expect(source).toContain("retry: 1");
  });
});
