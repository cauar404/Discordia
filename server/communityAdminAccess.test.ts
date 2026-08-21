import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const homeSource = readFileSync(resolve(projectRoot, "client/src/pages/Home.tsx"), "utf8");
const dialogSource = readFileSync(resolve(projectRoot, "client/src/components/CommunityAdminDialog.tsx"), "utf8");

describe("acesso visível à gestão pelo criador", () => {
  it("mostra o atalho de gerenciar apenas para o criador ou administrador", () => {
    expect(homeSource).toContain('const canManageCurrentCommunity = Boolean(currentCommunity && (currentCommunity.ownerUserId === user?.id || user?.role === "admin"));');
    expect(homeSource).toContain('triggerLabel="Gerenciar"');
    expect(homeSource).toContain('triggerClassName="community-admin-access"');
  });

  it("mantém o diálogo com gatilho configurável sem alterar os controles de remoção e exclusão", () => {
    expect(dialogSource).toContain("triggerLabel?: string; triggerClassName?: string");
    expect(dialogSource).toContain("Remover");
    expect(dialogSource).toContain("Excluir comunidade");
  });
});
