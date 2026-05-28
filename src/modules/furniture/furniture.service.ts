import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { normalizePagination } from "../../common/utils/pagination";
import { PrismaService } from "../../database/prisma.service";
import { CreateFurnitureDto } from "./dto/create-furniture.dto";
import { UpdateFurnitureDto } from "./dto/update-furniture.dto";

@Injectable()
export class FurnitureService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PaginationQueryDto & { order_id?: string }, organizationId?: string | null) {
    const pagination = normalizePagination(query, ["created_at", "updated_at", "name", "furniture_type", "estimated_lead_time_hours"], { maxLimit: 500 });
    const where: Prisma.FurnitureWhereInput = {
      deleted_at: null,
      ...(organizationId ? { orders: { organization_id: organizationId } } : {}),
      ...(query.order_id ? { order_id: query.order_id } : {}),
      ...(pagination.search
        ? {
            OR: [
              { name: { contains: pagination.search, mode: "insensitive" } },
              { furniture_type: { contains: pagination.search, mode: "insensitive" } },
              { orders: { code: { contains: pagination.search, mode: "insensitive" } } },
              { orders: { clients: { name: { contains: pagination.search, mode: "insensitive" } } } }
            ]
          }
        : {})
    };

    return this.prisma.furniture.findMany({
      where,
      include: { orders: { include: { clients: true } } },
      orderBy: { [pagination.sortBy]: pagination.sortOrder },
      skip: pagination.skip,
      take: pagination.limit
    });
  }

  findOne(id: string, organizationId?: string | null) {
    return this.prisma.furniture.findFirstOrThrow({
      where: { id, deleted_at: null, ...(organizationId ? { orders: { organization_id: organizationId } } : {}) },
      include: {
        orders: { include: { clients: true } },
        parts: { where: { deleted_at: null }, orderBy: { created_at: "desc" } }
      }
    });
  }

  create(dto: CreateFurnitureDto, organizationId?: string | null) {
    return this.prisma.furniture.create({
      data: {
        ...dto,
        estimated_lead_time_hours: dto.estimated_lead_time_hours ?? 0
      },
      include: { orders: { include: { clients: true } } }
    });
  }

  async update(id: string, dto: UpdateFurnitureDto, organizationId?: string | null) {
    await this.findOne(id, organizationId);
    return this.prisma.furniture.update({
      where: { id },
      data: dto,
      include: { orders: { include: { clients: true } } }
    });
  }

  async remove(id: string, organizationId?: string | null) {
    await this.findOne(id, organizationId);
    await this.prisma.furniture.update({
      where: { id },
      data: { deleted_at: new Date() }
    });
    return { message: "Furniture removed" };
  }
}
