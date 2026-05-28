import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { normalizePagination } from "../../common/utils/pagination";
import { PrismaService } from "../../database/prisma.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PaginationQueryDto, organizationId?: string | null) {
    const pagination = normalizePagination(query, ["created_at", "updated_at", "name", "email", "phone"], { maxLimit: 500 });
    const where: Prisma.ClientWhereInput = {
      deleted_at: null,
      ...(organizationId ? { organization_id: organizationId } : {}),
      ...(pagination.search
        ? {
            OR: [
              { name: { contains: pagination.search, mode: "insensitive" } },
              { email: { contains: pagination.search, mode: "insensitive" } },
              { phone: { contains: pagination.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    return this.prisma.client.findMany({
      where,
      orderBy: { [pagination.sortBy]: pagination.sortOrder },
      skip: pagination.skip,
      take: pagination.limit
    });
  }

  findOne(id: string, organizationId?: string | null) {
    return this.prisma.client.findFirstOrThrow({
      where: { id, deleted_at: null, ...(organizationId ? { organization_id: organizationId } : {}) },
      include: { orders: { where: { deleted_at: null }, orderBy: { created_at: "desc" } } }
    });
  }

  create(dto: CreateClientDto, organizationId?: string | null) {
    return this.prisma.client.create({ data: { ...dto, organization_id: organizationId ?? undefined } });
  }

  async update(id: string, dto: UpdateClientDto, organizationId?: string | null) {
    await this.findOne(id, organizationId);
    return this.prisma.client.update({
      where: { id },
      data: dto
    });
  }

  async remove(id: string, organizationId?: string | null) {
    await this.findOne(id, organizationId);
    await this.prisma.client.update({
      where: { id },
      data: { deleted_at: new Date() }
    });
    return { message: "Client removed" };
  }
}
