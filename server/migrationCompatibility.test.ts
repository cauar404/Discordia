import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = (filename: string) =>
  resolve(process.cwd(), "drizzle", filename);

describe("compatibilidade das migrações MySQL/TiDB", () => {
  it("mantém a migração histórica 0002 segura em um banco novo", () => {
    const priorMigration = readFileSync(
      migrationPath("0001_productive_microbe.sql"),
      "utf8",
    );
    const historicMigration = readFileSync(
      migrationPath("0002_outgoing_cardiac.sql"),
      "utf8",
    );

    expect(priorMigration).toContain(
      "ADD CONSTRAINT `dcm_conversation_fk` FOREIGN KEY (`conversationId`)",
    );
    expect(historicMigration).toContain("SELECT 1;");
    expect(historicMigration).not.toMatch(/DROP FOREIGN KEY/i);
    expect(historicMigration).not.toMatch(/ADD CONSTRAINT/i);
  });
});
