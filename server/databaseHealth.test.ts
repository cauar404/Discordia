import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const indexSource = readFileSync(resolve(projectRoot, "server/_core/index.ts"), "utf8");
const dbSource = readFileSync(resolve(projectRoot, "server/db.ts"), "utf8");
const platformSource = readFileSync(resolve(projectRoot, "server/routers/platform.ts"), "utf8");

describe("diagnóstico seguro de banco", () => {
  it("expõe somente o estado de disponibilidade na rota de saúde", () => {
    expect(indexSource).toContain('app.get("/api/health"');
    expect(indexSource).toContain('database: databaseAvailable ? "available" : "unavailable"');
    expect(indexSource).not.toContain("error: error");
  });

  it("verifica a conexão sem devolver detalhes internos ao cliente", () => {
    expect(dbSource).toContain("export async function checkDatabaseAvailability()");
    expect(dbSource).toContain("await db.execute(sql`SELECT 1`)");
    expect(dbSource).toContain('console.warn("[Database] Availability check failed")');
    expect(platformSource).toContain('message: "Banco de dados indisponível."');
  });
});
