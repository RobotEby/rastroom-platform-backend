import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.notification.findMany({
      include: { orders: { include: { clients: true } } },
      orderBy: { created_at: "desc" }
    });
  }

  findOne(id: string) {
    return this.prisma.notification.findUniqueOrThrow({
      where: { id },
      include: { orders: { include: { clients: true } } }
    });
  }
}
