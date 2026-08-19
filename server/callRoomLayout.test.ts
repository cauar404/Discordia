import { describe, expect, it } from "vitest";
import { getCallGridSummary, shouldShowFocusedScreenStage } from "@shared/callRoomLayout";

describe("layout da sala de chamadas", () => {
  it("inclui participantes e transmissões na mesma contagem da grade", () => {
    expect(getCallGridSummary(3, 2)).toMatchObject({ itemCount: 5, hasScreenShares: true, screenShareLabel: "2 transmissões" });
  });

  it("mantém uma transmissão como cartão sem abrir o palco até uma escolha explícita", () => {
    expect(getCallGridSummary(2, 1)).toMatchObject({ itemCount: 3, hasScreenShares: true, screenShareLabel: "1 transmissão" });
    expect(shouldShowFocusedScreenStage(null)).toBe(false);
  });

  it("libera o palco expansível somente para uma transmissão selecionada", () => {
    expect(shouldShowFocusedScreenStage("screen-share-abc")).toBe(true);
  });
});
