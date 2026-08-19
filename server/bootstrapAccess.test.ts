import { describe, expect, it } from "vitest";
import { isBootstrapAdminAvailable } from "@shared/bootstrapAccess";

describe("inicialização do administrador", () => {
  it("só fica disponível com segredo configurado e sem administrador existente", () => {
    expect(isBootstrapAdminAvailable(true, false)).toBe(true);
    expect(isBootstrapAdminAvailable(false, false)).toBe(false);
    expect(isBootstrapAdminAvailable(true, true)).toBe(false);
  });
});
