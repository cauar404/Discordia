import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const viteConfig = readFileSync(resolve(projectRoot, "vite.config.ts"), "utf8");

describe("instrumentação de build", () => {
  it("mantém os coletores Manus apenas no servidor de desenvolvimento", () => {
    expect(viteConfig).toContain('plugins: createPlugins(command === "serve")');
    expect(viteConfig).toContain("...(isDevelopment ? [jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()] : [])");
  });

  it("continua usando React e Tailwind tanto no desenvolvimento quanto no build", () => {
    expect(viteConfig).toContain("react(),");
    expect(viteConfig).toContain("tailwindcss(),");
  });
});
