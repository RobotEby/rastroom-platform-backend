import { Injectable } from "@nestjs/common";
import { RequestUser } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser) {
    return this.prisma.notification.findMany({
      where: {
        ...(user.organization_id ? { organization_id: user.organization_id } : {}),
        OR: [{ recipient_id: user.id }, { recipient_id: null }]
      },
      include: { orders: { include: { clients: true } } },
      orderBy: { created_at: "desc" }
    });
  }

  findOne(id: string, user: RequestUser) {
    return this.prisma.notification.findFirstOrThrow({
      where: { id, ...(user.organization_id ? { organization_id: user.organization_id } : {}) },
      include: { orders: { include: { clients: true } } }
    });
  }

  async markRead(id: string, user: RequestUser) {
    await this.findOne(id, user);
    return this.prisma.notification.update({
      where: { id },
      data: { status: "read", sent_at: new Date() }
    });
  }
}
