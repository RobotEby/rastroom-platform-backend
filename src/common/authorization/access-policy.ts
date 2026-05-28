export const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  supervisor: "Supervisor",
  engineer: "Engenharia",
  seller: "Comercial",
  maker: "Produção",
  operator: "Operador",
  operador: "Operador",
  montagem: "Montagem",
  developer: "Desenvolvedor"
};

export const ROLE_ALIASES: Record<string, string[]> = {
  operator: ["operator", "operador", "maker"],
  operador: ["operator", "operador", "maker"],
  maker: ["maker", "operator", "operador"],
  owner: ["owner", "admin"],
  admin: ["admin", "owner"],
};

export const ROLE_PROFILES = [
  {
    role: "owner",
    label: ROLE_LABELS.owner,
    description: "Acesso total à empresa, usuários, templates, documentos, dashboard e operação.",
    permissions: ["workspace:manage", "users:manage", "dashboard:view", "factory:operate", "quality:manage", "documents:manage", "audit:view"]
  },
  {
    role: "admin",
    label: ROLE_LABELS.admin,
    description: "Administra a operação e configurações principais da empresa.",
    permissions: ["workspace:manage", "users:manage", "dashboard:view", "factory:operate", "quality:manage", "documents:manage", "audit:view"]
  },
  {
    role: "supervisor",
    label: ROLE_LABELS.supervisor,
    description: "Acompanha produção, qualidade, documentos, auditoria e indicadores.",
    permissions: ["dashboard:view", "factory:view", "quality:manage", "documents:manage", "audit:view"]
  },
  {
    role: "engineer",
    label: ROLE_LABELS.engineer,
    description: "Configura rotas, templates técnicos, documentos e acompanha indicadores.",
    permissions: ["dashboard:view", "templates:manage", "documents:manage", "factory:view"]
  },
  {
    role: "seller",
    label: ROLE_LABELS.seller,
    description: "Acompanha pedidos, clientes e documentos comerciais.",
    permissions: ["orders:manage", "clients:manage", "documents:view"]
  },
  {
    role: "maker",
    label: ROLE_LABELS.maker,
    description: "Opera peças no chão de fábrica e registra apontamentos.",
    permissions: ["factory:operate", "quality:create", "checklist:run", "attachments:create"]
  },
  {
    role: "operator",
    label: ROLE_LABELS.operator,
    description: "Usa o modo operador para iniciar/finalizar processos e consultar peças.",
    permissions: ["factory:operate", "checklist:run", "attachments:create"]
  },
  {
    role: "montagem",
    label: ROLE_LABELS.montagem,
    description: "Acompanha montagem, expedição, documentos e operação de peças.",
    permissions: ["factory:operate", "assembly:manage", "expedition:manage", "documents:view"]
  },
  {
    role: "developer",
    label: ROLE_LABELS.developer,
    description: "Papel técnico com acesso amplo para suporte e manutenção controlada.",
    permissions: ["workspace:manage", "users:manage", "dashboard:view", "factory:operate", "quality:manage", "documents:manage", "audit:view"]
  }
];

export function expandRoles(roles: string[] = []) {
  return Array.from(new Set(roles.flatMap((role) => ROLE_ALIASES[role] ?? [role])));
}

export function hasRequiredRole(userRoles: string[] = [], requiredRoles: string[] = []) {
  if (!requiredRoles.length) return true;
  const expanded = expandRoles(userRoles);
  return requiredRoles.some((role) => expanded.includes(role));
}
