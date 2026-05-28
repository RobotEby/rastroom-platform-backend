import { expandRoles, hasRequiredRole } from "./access-policy";

describe("access policy", () => {
  it("expande aliases de operador", () => {
    expect(expandRoles(["operador"])).toEqual(expect.arrayContaining(["operador", "operator", "maker"]));
  });

  it("permite operador em rotas maker/operator/operador", () => {
    expect(hasRequiredRole(["operador"], ["maker"])).toBe(true);
    expect(hasRequiredRole(["operator"], ["operador"])).toBe(true);
  });

  it("não permite vendedor acessar rotas administrativas", () => {
    expect(hasRequiredRole(["seller"], ["owner", "admin"])).toBe(false);
  });
});
