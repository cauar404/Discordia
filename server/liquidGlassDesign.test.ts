import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync("client/src/index.css", "utf8");
const callStyles = readFileSync("client/src/components/CallRoom.css", "utf8");
const buttonSource = readFileSync("client/src/components/ui/button.tsx", "utf8");
const directMessagesSource = readFileSync("client/src/components/DirectMessagesDialog.tsx", "utf8");
const communityAdminSource = readFileSync("client/src/components/CommunityAdminDialog.tsx", "utf8");
const homeSource = readFileSync("client/src/pages/Home.tsx", "utf8");
const socialHubSource = readFileSync("client/src/components/SocialHub.tsx", "utf8");

describe("sistema visual Liquid Glass", () => {
  it("define tokens e superfícies translúcidas para o shell, navegação e composição", () => {
    expect(globalStyles).toContain("/* Liquid Glass — superfícies translúcidas");
    expect(globalStyles).toContain("--glass-bg:");
    expect(globalStyles).toContain("--glass-blur:blur(22px)");
    expect(globalStyles).toContain(".workspace-rail,.channel-sidebar,.context-panel");
    expect(globalStyles).toContain(".composer{border-color:var(--glass-border)");
  });

  it("estende o acabamento às superfícies de acesso e aos diálogos", () => {
    expect(globalStyles).toContain(".login-card{border-color:rgba(231,237,255,.19)");
    expect(globalStyles).toContain('[data-slot="dialog-content"]');
    expect(globalStyles).toContain('[data-slot="alert-dialog-content"]');
    expect(globalStyles).toContain("backdrop-filter:blur(26px) saturate(145%)");
    expect(globalStyles).toContain(".liquid-dialog{background:linear-gradient");
    expect(globalStyles).toContain(".community-admin-dialog [data-slot=\"tabs-list\"]");
  });

  it("mantém mensagens diretas e administração no mesmo acabamento translúcido", () => {
    expect(directMessagesSource).toContain('className="liquid-dialog border-white/10 bg-[#121722]');
    expect(directMessagesSource).toContain('className="liquid-dialog-aside border-r');
    expect(directMessagesSource).toContain('className="liquid-dialog-composer border-t');
    expect(communityAdminSource).toContain('className="liquid-dialog community-admin-dialog');
  });

  it("neutraliza os acentos quentes residuais em mensagens diretas", () => {
    expect(directMessagesSource).toContain('data-liquid-surface="direct-messages"');
    expect(directMessagesSource).toContain("data-liquid-dm-trigger");
    expect(globalStyles).toContain('[data-liquid-surface="direct-messages"]');
    expect(globalStyles).toContain("luz azul-violeta do Liquid Glass");
  });

  it("mantém botões globais com bordas, profundidade e feedback tátil", () => {
    expect(buttonSource).toContain("rounded-xl border text-sm");
    expect(buttonSource).toContain("backdrop-blur-xl");
    expect(buttonSource).toContain("active:scale-[0.97]");
  });

  it("mantém a sala de chamada no mesmo sistema sem reduzir a legibilidade da mídia", () => {
    expect(callStyles).toContain("/* Liquid Glass — comunicação ao vivo");
    expect(callStyles).toContain(".call-room{background:radial-gradient");
    expect(callStyles).toContain(".call-participant-area-modern{border-color:rgba(226,233,255,.12)");
    expect(callStyles).toContain(".call-dock{border-color:rgba(226,233,255,.15)");
    expect(callStyles).toContain(".call-stage-modern{border-color:rgba(190,201,255,.52)");
  });

  it("aplica o acabamento de forma explícita às superfícies autenticadas", () => {
    expect(homeSource).toContain('data-liquid-surface="workspace"');
    expect(globalStyles).toContain('Liquid Glass explícito na sessão autenticada');
    expect(globalStyles).toContain('.app-shell[data-liquid-surface="workspace"]:not(.call-active)>.chat-panel');
    expect(globalStyles).toContain('.app-shell[data-liquid-surface="workspace"] .message-row:hover');
    expect(globalStyles).toContain('.app-shell[data-liquid-surface="workspace"] .composer{');
  });

  it("mantém o hub social e o perfil no mesmo sistema translúcido", () => {
    expect(socialHubSource).toContain('data-liquid-surface="social-hub"');
    expect(socialHubSource).toContain('className="social-hub-dialog liquid-dialog');
    expect(socialHubSource).toContain('className="social-hub-profile');
    expect(globalStyles).toContain('.social-hub-dialog{overflow:hidden');
    expect(globalStyles).toContain('.social-hub-tabs [data-state="active"]');
  });
});
