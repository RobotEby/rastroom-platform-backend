const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.findUnique({ where: { slug: 'rastroom-demo' } });
  if (!organization) throw new Error('Organização rastroom-demo não encontrada. Rode npm run seed:demo.');

  const [users, clients, orders, furniture, parts, processes, documents] = await Promise.all([
    prisma.user.count({ where: { organization_id: organization.id } }),
    prisma.client.count({ where: { organization_id: organization.id } }),
    prisma.order.count({ where: { organization_id: organization.id } }),
    prisma.furniture.count({ where: { orders: { organization_id: organization.id } } }),
    prisma.part.count({ where: { furniture: { orders: { organization_id: organization.id } } } }),
    prisma.process.count({ where: { parts: { furniture: { orders: { organization_id: organization.id } } } } }),
    prisma.document.count({ where: { organization_id: organization.id } })
  ]);

  const required = { users: 4, clients: 3, orders: 4, furniture: 4, parts: 6, processes: 20, documents: 1 };
  const found = { users, clients, orders, furniture, parts, processes, documents };

  for (const [key, min] of Object.entries(required)) {
    if (found[key] < min) throw new Error(`Seed demo incompleto: ${key}=${found[key]}, esperado >= ${min}`);
  }

  const labelPart = await prisma.part.findFirst({
    where: { code: 'P-000-1', furniture: { orders: { code: 'PED-005', clients: { name: 'TESTE LTDA' } } } },
    include: { furniture: { include: { orders: { include: { clients: true } } } } }
  });

  if (!labelPart) throw new Error('Peça P-000-1 vinculada a PED-005 / TESTE LTDA não encontrada.');

  console.log('Seed demo validado:');
  console.log(JSON.stringify({ organization: organization.slug, ...found, etiqueta: `${labelPart.code} / ${labelPart.furniture.name} / ${labelPart.furniture.orders.code} / ${labelPart.furniture.orders.clients.name}` }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
