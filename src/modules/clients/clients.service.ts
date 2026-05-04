import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { PrismaService } from "../../database/prisma.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PaginationQueryDto) {
    const where: Prisma.ClientWhereInput = {
      deleted_at: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    return this.prisma.client.findMany({
      where,
      orderBy: { [query.sortBy ?? "created_at"]: query.sortOrder ?? "desc" },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 50),
      take: query.limit ?? 50
    });
  }

  findOne(id: string) {
    return this.prisma.client.findFirstOrThrow({
      where: { id, deleted_at: null },
      include: { orders: { where: { deleted_at: null }, orderBy: { created_at: "desc" } } }
    });
  }

  create(dto: CreateClientDto) {
    return this.prisma.client.create({ data: dto });
  }

  update(id: string, dto: UpdateClientDto) {
    return this.prisma.client.update({
      where: { id },
      data: dto
    });
  }

  async remove(id: string) {
    await this.prisma.client.update({
      where: { id },
      data: { deleted_at: new Date() }
    });
    return { message: "Client removed" };
  }
}
