import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class ExpeditionService {
  constructor(private readonly prisma: PrismaService) {}

  findReadyOrders() {
    return this.prisma.order.findMany({
      where: {
        deleted_at: null,
        status: { in: ["pronto", "montagem", "expedido"] }
      },
      include: { clients: true },
      orderBy: { estimated_delivery: "asc" }
    });
  }

  async expedite(orderId: string) {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: "expedido" },
      include: { clients: true }
    });

    await this.prisma.notification.create({
      data: {
        order_id: order.id,
        recipient_email: order.clients.email,
        type: "order_expedited",
        status: "sent",
        sent_at: new Date(),
        message: `Pedido ${order.code} expedido.`
      }
    });

    return order;
  }
}
