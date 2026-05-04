import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class AssemblyService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly partInclude = {
    furniture: { include: { orders: { include: { clients: true } } } },
    processes: {
      orderBy: { sequence_order: "asc" as const },
      include: { execution_logs: { orderBy: { started_at: "desc" as const } } }
    }
  } satisfies Prisma.PartInclude;

  async lookupKit(rawCode: string) {
    const code = this.extractCode(rawCode);
    const mother = await this.prisma.part.findFirst({
      where: {
        deleted_at: null,
        is_mother_part: true,
        OR: [{ code }, { qr_code_data: rawCode }]
      },
      include: this.partInclude
    });

    if (!mother) throw new NotFoundException("Mother part not found");

    const children = await this.prisma.part.findMany({
      where: { parent_part_id: mother.id, deleted_at: null },
      include: this.partInclude,
      orderBy: { name: "asc" }
    });

    return {
      motherPart: mother,
      childParts: children,
      allReady: this.isPartReady(mother) && children.length > 0 && children.every((part) => this.isPartReady(part))
    };
  }

  async finalizeKit(motherPartId: string) {
    const kit = await this.lookupKitById(motherPartId);
    const allReady =
      this.isPartReady(kit.motherPart) &&
      kit.childParts.length > 0 &&
      kit.childParts.every((part) => this.isPartReady(part));

    if (!allReady) {
      throw new BadRequestException("Not all kit parts are ready");
    }

    const orderId = kit.motherPart.furniture?.order_id;
    if (!orderId) throw new BadRequestException("Mother part has no order");

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: "montagem" },
      include: { clients: true }
    });

    await this.prisma.notification.create({
      data: {
        order_id: order.id,
        recipient_email: order.clients.email,
        type: "kit_completed",
        status: "pending",
        message: `Kit do pedido ${order.code} validado para montagem.`
      }
    });

    return { ...kit, order };
  }

  private async lookupKitById(motherPartId: string) {
    const mother = await this.prisma.part.findFirstOrThrow({
      where: { id: motherPartId, deleted_at: null, is_mother_part: true },
      include: this.partInclude
    });
    const children = await this.prisma.part.findMany({
      where: { parent_part_id: mother.id, deleted_at: null },
      include: this.partInclude,
      orderBy: { name: "asc" }
    });
    return { motherPart: mother, childParts: children };
  }

  private isPartReady(part: { processes?: Array<{ execution_logs?: Array<{ status: string }> }> }) {
    const processes = part.processes ?? [];
    return (
      processes.length > 0 &&
      processes.every((process) =>
        (process.execution_logs ?? []).some((log) => log.status === "concluido")
      )
    );
  }

  private extractCode(rawData: string) {
    try {
      const parsed = JSON.parse(rawData) as { code?: string };
      return parsed.code || rawData;
    } catch {
      return rawData;
    }
  }
}
