import { PrismaClient, ProcessType } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const ids = {
  org: "01000000-0000-4000-8000-000000000001",
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
  readyPart: "40000000-0000-4000-8000-000000000005",
  clientTeste: "10000000-0000-4000-8000-000000000005",
  orderTeste: "20000000-0000-4000-8000-000000000005",
  furnitureTeste: "30000000-0000-4000-8000-000000000005",
  partTeste: "40000000-0000-4000-8000-000000000006"
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
  await prisma.offlineSyncEvent.deleteMany();
  await prisma.document.deleteMany();
  await prisma.checklistRunItem.deleteMany();
  await prisma.checklistRun.deleteMany();
  await prisma.checklistTemplateItem.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.defectReport.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.processTemplateStep.deleteMany();
  await prisma.processTemplate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
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
  width_mm?: number;
  height_mm?: number;
  depth_mm?: number;
  material?: string;
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
      width_mm: params.width_mm ?? 600,
      height_mm: params.height_mm ?? 450,
      depth_mm: params.depth_mm ?? 18,
      material: params.material ?? "MDF 18mm",
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

  await prisma.organization.create({ data: { id: ids.org, name: "Rastroom Demo Factory", slug: "rastroom-demo" } });

  await prisma.user.createMany({
    data: [
      {
        id: ids.admin,
        email: "admin@rastroom.local",
        full_name: "Admin Rastroom",
        password_hash,
        organization_id: ids.org, roles: ["owner", "admin", "operator", "montagem", "supervisor", "engineer", "seller"]
      },
      {
        id: ids.operator,
        email: "operador@rastroom.local",
        full_name: "Operador de Fabrica",
        password_hash,
        organization_id: ids.org, roles: ["operator", "operador", "maker"]
      },
      {
        id: ids.montagem,
        email: "montagem@rastroom.local",
        full_name: "Equipe de Montagem",
        password_hash,
        organization_id: ids.org, roles: ["montagem"]
      },
      {
        id: ids.supervisor,
        email: "supervisor@rastroom.local",
        full_name: "Supervisor de Producao",
        password_hash,
        organization_id: ids.org, roles: ["supervisor"]
      }
    ]
  });

  await prisma.client.createMany({
    data: [
      {
        id: ids.clientA,
        organization_id: ids.org,
        name: "Cliente A",
        email: "a@a.com",
        phone: "11999999999",
        address: "Rua A, 100",
        notes: "Cliente usado nos mocks originais do frontend."
      },
      {
        id: ids.clientB,
        organization_id: ids.org,
        name: "Cliente B",
        email: "b@b.com",
        phone: "11888888888",
        address: "Rua B, 200",
        notes: "Pedido com montagem pronta para expedir."
      },
      {
        id: ids.clientTeste,
        organization_id: ids.org,
        name: "TESTE LTDA",
        email: "compras@teste-ltda.local",
        phone: "31982044380",
        address: "Vespasiano, MG",
        notes: "Cliente de homologação usado para validar etiqueta real P-000-1."
      }
    ]
  });

  await prisma.order.createMany({
    data: [
      {
        id: ids.order1,
        organization_id: ids.org,
        client_id: ids.clientA,
        code: "PED-001",
        description: "Cozinha planejada",
        status: "em_producao",
        estimated_delivery: new Date("2026-05-20T00:00:00.000Z"),
        created_by: ids.admin
      },
      {
        id: ids.order2,
        organization_id: ids.org,
        client_id: ids.clientB,
        code: "PED-002",
        description: "Guarda-roupa casal",
        status: "montagem",
        estimated_delivery: new Date("2026-05-22T00:00:00.000Z"),
        created_by: ids.admin
      },
      {
        id: ids.order3,
        organization_id: ids.org,
        client_id: ids.clientA,
        code: "PED-003",
        description: "Balcao gourmet",
        status: "pronto",
        estimated_delivery: new Date("2026-05-25T00:00:00.000Z"),
        created_by: ids.admin
      },
      {
        id: ids.orderTeste,
        organization_id: ids.org,
        client_id: ids.clientTeste,
        code: "PED-005",
        description: "Armário quarto",
        status: "em_producao",
        estimated_delivery: new Date("2026-05-28T00:00:00.000Z"),
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
      },
      {
        id: ids.furnitureTeste,
        order_id: ids.orderTeste,
        name: "Armário quarto",
        description: "Móvel usado na validação de etiqueta, QR Code e fluxo de expedição.",
        furniture_type: "Dormitório",
        estimated_lead_time_hours: 10
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

  await createPartWithProcesses({
    id: ids.partTeste,
    furniture_id: ids.furnitureTeste,
    code: "P-000-1",
    name: "esquerda lateral armário",
    finish_color: "Branco",
    finish_color_hex: "#ffffff",
    finish_type: "MDF",
    material: "18mm",
    width_mm: 2000,
    height_mm: 1000,
    depth_mm: 60,
    current_process: "expedicao",
    completedUntil: 4
  });

  await prisma.defectReport.create({
    data: {
      organization_id: ids.org,
      part_id: ids.pendingPart,
      reported_by: ids.supervisor,
      title: "Risco leve na pintura",
      description: "Ocorrência demo para validar o módulo de qualidade.",
      severity: "medium",
      status: "open"
    }
  });

  const checklistTemplate = await prisma.checklistTemplate.create({
    data: {
      organization_id: ids.org,
      name: "Checklist de expedição demo",
      description: "Checklist usado na homologação final do MVP.",
      items: {
        create: [
          { label: "Etiqueta impressa e colada", required: true, sort_order: 1 },
          { label: "Peça conferida visualmente", required: true, sort_order: 2 },
          { label: "Medidas conferidas", required: true, sort_order: 3 }
        ]
      }
    }
  });

  await prisma.document.create({
    data: {
      organization_id: ids.org,
      order_id: ids.orderTeste,
      type: "part_label",
      status: "generated",
      title: "Etiqueta P-000-1",
      generated_by: ids.admin,
      content: {
        part_id: ids.partTeste,
        part_code: "P-000-1",
        part_name: "esquerda lateral armário",
        furniture_name: "Armário quarto",
        order_code: "PED-005",
        client_name: "TESTE LTDA",
        process: "Expedição",
        material: "18mm",
        finish_type: "MDF",
        finish_color: "Branco",
        measures: "2000 × 1000 × 60 mm"
      }
    }
  });

  await prisma.notification.create({
    data: {
      organization_id: ids.org,
      order_id: ids.order3,
      recipient_id: ids.admin,
      recipient_email: "admin@rastroom.local",
      type: "order_expedited",
      status: "pending",
      message: "Pedido PED-003 está pronto para expedição."
    }
  });

  await prisma.auditLog.create({
    data: {
      organization_id: ids.org,
      actor_id: ids.admin,
      action: "seed",
      entity: "database",
      metadata: { source: "prisma/seed.ts", scenario: "homologacao-final", checklist_template_id: checklistTemplate.id }
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
