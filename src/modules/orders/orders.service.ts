import { ConflictException, Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { normalizePagination } from "../../common/utils/pagination";
import { PrismaService } from "../../database/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PaginationQueryDto & { status?: OrderStatus }, organizationId?: string | null) {
    const pagination = normalizePagination(query, ["created_at", "updated_at", "code", "status", "estimated_delivery"], { maxLimit: 500 });
    const where: Prisma.OrderWhereInput = {
      deleted_at: null,
      ...(organizationId ? { organization_id: organizationId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(pagination.search
        ? {
            OR: [
              { code: { contains: pagination.search, mode: "insensitive" } },
              { description: { contains: pagination.search, mode: "insensitive" } },
              { clients: { name: { contains: pagination.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    return this.prisma.order.findMany({
      where,
      include: { clients: true },
      orderBy: { [pagination.sortBy]: pagination.sortOrder },
      skip: pagination.skip,
      take: pagination.limit
    });
  }

  findOne(id: string, organizationId?: string | null) {
    return this.prisma.order.findFirstOrThrow({
      where: { id, deleted_at: null, ...(organizationId ? { organization_id: organizationId } : {}) },
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

  async create(dto: CreateOrderDto, userId?: string, organizationId?: string | null) {
    if (organizationId) {
      await this.prisma.client.findFirstOrThrow({ where: { id: dto.client_id, organization_id: organizationId, deleted_at: null } });
      const existing = await this.prisma.order.findFirst({
        where: { organization_id: organizationId, code: dto.code, deleted_at: null }
      });
      if (existing) throw new ConflictException("Order code already exists in this workspace");
    }

    return this.prisma.order.create({
      data: {
        organization_id: organizationId ?? undefined,
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

  async update(id: string, dto: UpdateOrderDto, organizationId?: string | null) {
    const current = await this.findOne(id, organizationId);
    if (organizationId && dto.client_id) {
      await this.prisma.client.findFirstOrThrow({ where: { id: dto.client_id, organization_id: organizationId, deleted_at: null } });
    }
    if (organizationId && dto.code && dto.code !== current.code) {
      const existing = await this.prisma.order.findFirst({ where: { organization_id: organizationId, code: dto.code, deleted_at: null, id: { not: id } } });
      if (existing) throw new ConflictException("Order code already exists in this workspace");
    }
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

  async updateStatus(id: string, dto: UpdateOrderStatusDto, organizationId?: string | null) {
    await this.findOne(id, organizationId);
    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: { clients: true }
    });
  }

  findReadyForExpedition(organizationId?: string | null) {
    return this.prisma.order.findMany({
      where: {
        deleted_at: null,
        ...(organizationId ? { organization_id: organizationId } : {}),
        status: { in: ["pronto", "montagem", "expedido"] }
      },
      include: { clients: true },
      orderBy: { estimated_delivery: "asc" }
    });
  }

  async remove(id: string, organizationId?: string | null) {
    await this.findOne(id, organizationId);
    await this.prisma.order.update({
      where: { id },
      data: { deleted_at: new Date() }
    });
    return { message: "Order removed" };
  }
}
