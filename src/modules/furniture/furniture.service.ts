import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { PrismaService } from "../../database/prisma.service";
import { CreateFurnitureDto } from "./dto/create-furniture.dto";
import { UpdateFurnitureDto } from "./dto/update-furniture.dto";

@Injectable()
export class FurnitureService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PaginationQueryDto & { order_id?: string }) {
    const where: Prisma.FurnitureWhereInput = {
      deleted_at: null,
      ...(query.order_id ? { order_id: query.order_id } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { furniture_type: { contains: query.search, mode: "insensitive" } },
              { orders: { code: { contains: query.search, mode: "insensitive" } } },
              { orders: { clients: { name: { contains: query.search, mode: "insensitive" } } } }
            ]
          }
        : {})
    };

    return this.prisma.furniture.findMany({
      where,
      include: { orders: { include: { clients: true } } },
      orderBy: { [query.sortBy ?? "created_at"]: query.sortOrder ?? "desc" },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 50),
      take: query.limit ?? 50
    });
  }

  findOne(id: string) {
    return this.prisma.furniture.findFirstOrThrow({
      where: { id, deleted_at: null },
      include: {
        orders: { include: { clients: true } },
        parts: { where: { deleted_at: null }, orderBy: { created_at: "desc" } }
      }
    });
  }

  create(dto: CreateFurnitureDto) {
    return this.prisma.furniture.create({
      data: {
        ...dto,
        estimated_lead_time_hours: dto.estimated_lead_time_hours ?? 0
      },
      include: { orders: { include: { clients: true } } }
    });
  }

  update(id: string, dto: UpdateFurnitureDto) {
    return this.prisma.furniture.update({
      where: { id },
      data: dto,
      include: { orders: { include: { clients: true } } }
    });
  }

  async remove(id: string) {
    await this.prisma.furniture.update({
      where: { id },
      data: { deleted_at: new Date() }
    });
    return { message: "Furniture removed" };
  }
}
