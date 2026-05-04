import { PrismaClient, ProcessType } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  operator: "00000000-0000-4000-8000-000000000002",
  montagem: "00000000-0000-4000-8000-000000000003",
  supervisor: "00000000-0000-4000-8000-000000000004",
  clientA: "10000000-0000-4000-8000-000000000001",
  clientB: "10000000-0000-4000-8000-000000000002",
  order1: "20000000-0000-4000-8000-000000000001",
  order2: "20000000-0000-4000-8000-000000000002",
  order3: "20000000-0000-4000-8000-000000000003",
  furniture1: "30000000-0000-4000-8000-000000000001",
  furniture2: "30000000-0000-4000-8000-000000000002",
  furniture3: "30000000-0000-4000-8000-000000000003",
  mother1: "40000000-0000-4000-8000-000000000001",
  child1: "40000000-0000-4000-8000-000000000002",
  child2: "40000000-0000-4000-8000-000000000003",
  pendingPart: "40000000-0000-4000-8000-000000000004",
  readyPart: "40000000-0000-4000-8000-000000000005"
};

const processDefaults: ProcessType[] = ["corte", "lixamento", "pintura", "borda"];
const estimatedTimes: Record<ProcessType, number> = {
  corte: 10,
  lixamento: 15,
  pintura: 30,
  borda: 12,
  montagem: 20,
  expedicao: 10
};

function qr(id: string, code: string) {
  return JSON.stringify({ id, code });
}

async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.executionLog.deleteMany();
  await prisma.process.deleteMany();
  await prisma.part.deleteMany();
  await prisma.furniture.deleteMany();
  await prisma.order.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
}

async function createPartWithProcesses(params: {
  id: string;
  furniture_id: string;
  parent_part_id?: string;
  code: string;
  name: string;
  is_mother_part?: boolean;
  current_process?: ProcessType;
  finish_color?: string;
  finish_color_hex?: string;
  finish_type?: string;
  paint_recipe?: string;
  completedUntil?: number;
  runningAt?: number;
}) {
  const part = await prisma.part.create({
    data: {
      id: params.id,
      furniture_id: params.furniture_id,
      parent_part_id: params.parent_part_id,
      code: params.code,
      name: params.name,
      is_mother_part: params.is_mother_part ?? false,
      width_mm: 600,
      height_mm: 450,
      depth_mm: 18,
      material: "MDF 18mm",
      finish_color: params.finish_color ?? "Branco Neve",
      finish_color_hex: params.finish_color_hex ?? "#ffffff",
      finish_type: params.finish_type ?? "Laca",
      paint_recipe: params.paint_recipe ?? "Base PU + pigmento branco",
      edge_banding_info: "Fita PVC 1mm",
      current_process: params.current_process ?? "corte",
      qr_code_data: qr(params.id, params.code)
    }
  });

  for (const [index, process_type] of processDefaults.entries()) {
    const process = await prisma.process.create({
      data: {
        part_id: part.id,
        process_type,
        sequence_order: index + 1,
        estimated_time_minutes: estimatedTimes[process_type]
      }
    });

    if (params.completedUntil && index + 1 <= params.completedUntil) {
      const startedAt = new Date(Date.now() - (index + 2) * 60 * 60 * 1000);
      const elapsed = estimatedTimes[process_type] * 60;
      await prisma.executionLog.create({
        data: {
          process_id: process.id,
          operator_id: ids.operator,
          status: "concluido",
          started_at: startedAt,
          finished_at: new Date(startedAt.getTime() + elapsed * 1000),
          elapsed_seconds: elapsed
        }
      });
    }

    if (params.runningAt && index + 1 === params.runningAt) {
      await prisma.executionLog.create({
        data: {
          process_id: process.id,
          operator_id: ids.operator,
          status: "em_execucao",
          started_at: new Date(Date.now() - 45 * 60 * 1000)
        }
      });
    }
  }

  return part;
}

async function main() {
  await resetDatabase();

  const password_hash = await argon2.hash("Rastroom@123");

  await prisma.user.createMany({
    data: [
      {
        id: ids.admin,
        email: "admin@rastroom.local",
        full_name: "Admin Rastroom",
        password_hash,
        roles: ["admin", "operator", "montagem", "supervisor"]
      },
      {
        id: ids.operator,
        email: "operador@rastroom.local",
        full_name: "Operador de Fabrica",
        password_hash,
        roles: ["operator", "operador"]
      },
      {
        id: ids.montagem,
        email: "montagem@rastroom.local",
        full_name: "Equipe de Montagem",
        password_hash,
        roles: ["montagem"]
      },
      {
        id: ids.supervisor,
        email: "supervisor@rastroom.local",
        full_name: "Supervisor de Producao",
        password_hash,
        roles: ["supervisor"]
      }
    ]
  });

  await prisma.client.createMany({
    data: [
      {
        id: ids.clientA,
        name: "Cliente A",
        email: "a@a.com",
        phone: "11999999999",
        address: "Rua A, 100",
        notes: "Cliente usado nos mocks originais do frontend."
      },
      {
        id: ids.clientB,
        name: "Cliente B",
        email: "b@b.com",
        phone: "11888888888",
        address: "Rua B, 200",
        notes: "Pedido com montagem pronta para expedir."
      }
    ]
  });

  await prisma.order.createMany({
    data: [
      {
        id: ids.order1,
        client_id: ids.clientA,
        code: "PED-001",
        description: "Cozinha planejada",
        status: "em_producao",
        estimated_delivery: new Date("2026-05-20T00:00:00.000Z"),
        created_by: ids.admin
      },
      {
        id: ids.order2,
        client_id: ids.clientB,
        code: "PED-002",
        description: "Guarda-roupa casal",
        status: "montagem",
        estimated_delivery: new Date("2026-05-22T00:00:00.000Z"),
        created_by: ids.admin
      },
      {
        id: ids.order3,
        client_id: ids.clientA,
        code: "PED-003",
        description: "Balcao gourmet",
        status: "pronto",
        estimated_delivery: new Date("2026-05-25T00:00:00.000Z"),
        created_by: ids.admin
      }
    ]
  });

  await prisma.furniture.createMany({
    data: [
      {
        id: ids.furniture1,
        order_id: ids.order1,
        name: "Armario Base",
        description: "Modulo inferior da cozinha",
        furniture_type: "Armario",
        estimated_lead_time_hours: 12
      },
      {
        id: ids.furniture2,
        order_id: ids.order2,
        name: "Guarda-Roupa",
        description: "Kit completo com portas de correr",
        furniture_type: "Dormitorio",
        estimated_lead_time_hours: 18
      },
      {
        id: ids.furniture3,
        order_id: ids.order3,
        name: "Balcao Gourmet",
        description: "Pedido pronto para expedir",
        furniture_type: "Balcao",
        estimated_lead_time_hours: 8
      }
    ]
  });

  await createPartWithProcesses({
    id: ids.mother1,
    furniture_id: ids.furniture1,
    code: "M-100",
    name: "Kit Armario Base",
    is_mother_part: true,
    current_process: "expedicao",
    completedUntil: 4
  });

  await createPartWithProcesses({
    id: ids.child1,
    furniture_id: ids.furniture1,
    parent_part_id: ids.mother1,
    code: "P-101",
    name: "Lateral Esquerda",
    finish_color: "Cinza Cristal",
    finish_color_hex: "#cccccc",
    current_process: "borda",
    completedUntil: 4
  });

  await createPartWithProcesses({
    id: ids.child2,
    furniture_id: ids.furniture1,
    parent_part_id: ids.mother1,
    code: "P-102",
    name: "Lateral Direita",
    finish_color: "Cinza Cristal",
    finish_color_hex: "#cccccc",
    current_process: "pintura",
    completedUntil: 2,
    runningAt: 3
  });

  await createPartWithProcesses({
    id: ids.pendingPart,
    furniture_id: ids.furniture2,
    code: "P-999",
    name: "Porta Central",
    finish_color: "Azul Profundo",
    finish_color_hex: "#1246a3",
    current_process: "pintura",
    completedUntil: 2,
    runningAt: 3
  });

  await createPartWithProcesses({
    id: ids.readyPart,
    furniture_id: ids.furniture3,
    code: "P-456",
    name: "Frente Gaveta",
    finish_color: "Verde Oliva",
    finish_color_hex: "#6f8f3d",
    current_process: "expedicao",
    completedUntil: 4
  });

  await prisma.notification.create({
    data: {
      order_id: ids.order3,
      recipient_email: "a@a.com",
      type: "order_expedited",
      status: "pending",
      message: "Pedido PED-003 esta pronto para expedicao."
    }
  });

  await prisma.auditLog.create({
    data: {
      actor_id: ids.admin,
      action: "seed",
      entity: "database",
      metadata: { source: "prisma/seed.ts" }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
