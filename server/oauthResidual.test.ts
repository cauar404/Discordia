import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const indexSource = readFileSync(resolve(projectRoot, "server/_core/index.ts"), "utf8");
const sdkSource = readFileSync(resolve(projectRoot, "server/_core/sdk.ts"), "utf8");

describe("inicialização de autenticação local", () => {
  it("não registra a rota OAuth legada no serviço local", () => {
    expect(indexSource).not.toContain('registerOAuthRoutes(app)');
    expect(indexSource).not.toContain('from "./oauth"');
  });

  it("adianta a dependência OAuth somente para chamadas externas explícitas", () => {
    expect(sdkSource).toContain("private getOAuthService()");
    expect(sdkSource).toContain("OAuth não está habilitado neste serviço.");
    expect(sdkSource).not.toContain("[OAuth] ERROR: OAUTH_SERVER_URL is not configured!");
  });
});
