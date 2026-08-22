import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const main = readFileSync(resolve(import.meta.dirname, "../client/src/main.tsx"), "utf8");
const home = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Home.tsx"), "utf8");
const styles = readFileSync(resolve(import.meta.dirname, "../client/src/workspace-refinement.css"), "utf8");

describe("refinamento da área de trabalho", () => {
  it("carrega painéis secundários sob demanda para reduzir o trabalho do primeiro acesso", () => {
    expect(home).toContain('lazy(() => import("@/components/DirectMessagesDialog")');
    expect(home).toContain('lazy(() => import("@/components/SocialHub")');
    expect(home).toContain('lazy(() => import("@/components/CommunityAdminDialog")');
  });

  it("aplica superfícies sólidas e disponibiliza a navegação de canais em telas pequenas", () => {
    expect(main).toContain('import "./workspace-refinement.css"');
    expect(styles).toContain("backdrop-filter:none");
    expect(styles).toContain(".mobile-nav-trigger");
    expect(styles).toContain(".app-shell>.channel-sidebar.is-mobile-open");
    expect(home).toContain("setMobileNavigationOpen(false)");
  });
});
