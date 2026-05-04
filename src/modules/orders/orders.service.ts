import { Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { PrismaService } from "../../database/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PaginationQueryDto & { status?: OrderStatus }) {
    const where: Prisma.OrderWhereInput = {
      deleted_at: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { clients: { name: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    return this.prisma.order.findMany({
      where,
      include: { clients: true },
      orderBy: { [query.sortBy ?? "created_at"]: query.sortOrder ?? "desc" },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 50),
      take: query.limit ?? 50
    });
  }

  findOne(id: string) {
    return this.prisma.order.findFirstOrThrow({
      where: { id, deleted_at: null },
      include: {
        clients: true,
        furniture: {
          where: { deleted_at: null },
          include: { parts: { where: { deleted_at: null } } }
        },
        notifications: { orderBy: { created_at: "desc" } }
      }
    });
  }

  create(dto: CreateOrderDto, userId?: string) {
    return this.prisma.order.create({
      data: {
        client_id: dto.client_id,
        code: dto.code,
        description: dto.description,
        status: dto.status ?? "rascunho",
        estimated_delivery: dto.estimated_delivery ? new Date(dto.estimated_delivery) : undefined,
        created_by: userId
      },
      include: { clients: true }
    });
  }

  update(id: string, dto: UpdateOrderDto) {
    return this.prisma.order.update({
      where: { id },
      data: {
        client_id: dto.client_id,
        code: dto.code,
        description: dto.description,
        status: dto.status,
        estimated_delivery:
          dto.estimated_delivery === undefined
            ? undefined
            : dto.estimated_delivery
              ? new Date(dto.estimated_delivery)
              : null
      },
      include: { clients: true }
    });
  }

  updateStatus(id: string, dto: UpdateOrderStatusDto) {
    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: { clients: true }
    });
  }

  findReadyForExpedition() {
    return this.prisma.order.findMany({
      where: {
        deleted_at: null,
        status: { in: ["pronto", "montagem", "expedido"] }
      },
      include: { clients: true },
      orderBy: { estimated_delivery: "asc" }
    });
  }

  async remove(id: string) {
    await this.prisma.order.update({
      where: { id },
      data: { deleted_at: new Date() }
    });
    return { message: "Order removed" };
  }
}
