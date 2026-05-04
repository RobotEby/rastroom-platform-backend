import { Injectable } from "@nestjs/common";
import { Part, Prisma, ProcessType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { DEFAULT_PART_PROCESSES, PROCESS_ESTIMATED_MINUTES } from "../../common/utils/process-defaults";
import { PrismaService } from "../../database/prisma.service";
import { CreatePartDto, ImportPartsDto } from "./dto/create-part.dto";
import { UpdatePartDto } from "./dto/update-part.dto";

@Injectable()
export class PartsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly listInclude = {
    furniture: { include: { orders: { include: { clients: true } } } }
  } satisfies Prisma.PartInclude;

  private readonly detailInclude = {
    furniture: { include: { orders: { include: { clients: true } } } },
    parent_part: true,
    child_parts: { where: { deleted_at: null }, orderBy: { name: "asc" as const } },
    processes: {
      orderBy: { sequence_order: "asc" as const },
      include: {
        execution_logs: { orderBy: { started_at: "desc" as const }, include: { users: true } }
      }
    }
  } satisfies Prisma.PartInclude;

  findAll(query: PaginationQueryDto & { furniture_id?: string; current_process?: ProcessType }) {
    const where: Prisma.PartWhereInput = {
      deleted_at: null,
      ...(query.furniture_id ? { furniture_id: query.furniture_id } : {}),
      ...(query.current_process ? { current_process: query.current_process } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
              { finish_color: { contains: query.search, mode: "insensitive" } },
              { furniture: { name: { contains: query.search, mode: "insensitive" } } },
              { furniture: { orders: { code: { contains: query.search, mode: "insensitive" } } } }
            ]
          }
        : {})
    };

    return this.prisma.part.findMany({
      where,
      include: this.listInclude,
      orderBy: { [query.sortBy ?? "created_at"]: query.sortOrder ?? "desc" },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 50),
      take: query.limit ?? 50
    });
  }

  findOne(id: string) {
    return this.prisma.part.findFirstOrThrow({
      where: { id, deleted_at: null },
      include: this.detailInclude
    });
  }

  async findByCode(rawCode: string) {
    const code = this.extractCode(rawCode);
    return this.prisma.part.findFirstOrThrow({
      where: {
        deleted_at: null,
        OR: [{ code }, { qr_code_data: rawCode }]
      },
      include: this.detailInclude
    });
  }

  async create(dto: CreatePartDto) {
    return this.prisma.$transaction((tx) => this.createWithProcesses(tx, dto));
  }

  async update(id: string, dto: UpdatePartDto) {
    const { selected_processes, ...partDto } = dto;

    return this.prisma.$transaction(async (tx) => {
      const part = await tx.part.update({
        where: { id },
        data: {
          ...partDto,
          parent_part_id: partDto.parent_part_id || null
        },
        include: this.detailInclude
      });

      if (selected_processes?.length) {
        await tx.process.deleteMany({ where: { part_id: id } });
        await this.createProcessRows(tx, id, selected_processes);
        return tx.part.findUniqueOrThrow({ where: { id }, include: this.detailInclude });
      }

      return part;
    });
  }

  async importParts(dto: ImportPartsDto) {
    return this.prisma.$transaction(async (tx) => {
      const created: Part[] = [];
      for (const row of dto.parts) {
        created.push(
          await this.createWithProcesses(tx, {
            ...row,
            furniture_id: dto.furniture_id,
            selected_processes: row.selected_processes ?? dto.processes
          })
        );
      }
      return { count: created.length, parts: created };
    });
  }

  async remove(id: string) {
    await this.prisma.part.update({
      where: { id },
      data: { deleted_at: new Date() }
    });
    return { message: "Part removed" };
  }

  private async createWithProcesses(tx: Prisma.TransactionClient, dto: CreatePartDto) {
    const id = randomUUID();
    const code = dto.code?.trim() || this.generatePartCode();
    const processes = dto.selected_processes?.length ? dto.selected_processes : DEFAULT_PART_PROCESSES;
    const part = await tx.part.create({
      data: {
        id,
        furniture_id: dto.furniture_id,
        parent_part_id: dto.parent_part_id || null,
        code,
        name: dto.name,
        is_mother_part: dto.is_mother_part ?? false,
        width_mm: dto.width_mm,
        height_mm: dto.height_mm,
        depth_mm: dto.depth_mm,
        material: dto.material,
        finish_color: dto.finish_color,
        finish_color_hex: dto.finish_color_hex ?? "#ffffff",
        finish_type: dto.finish_type,
        paint_recipe: dto.paint_recipe,
        edge_banding_info: dto.edge_banding_info,
        current_process: processes[0],
        qr_code_data: JSON.stringify({ id, code })
      }
    });

    await this.createProcessRows(tx, part.id, processes);

    return tx.part.findUniqueOrThrow({
      where: { id: part.id },
      include: this.detailInclude
    });
  }

  private createProcessRows(tx: Prisma.TransactionClient, partId: string, processes: ProcessType[]) {
    return tx.process.createMany({
      data: processes.map((process_type, index) => ({
        part_id: partId,
        process_type,
        sequence_order: index + 1,
        estimated_time_minutes: PROCESS_ESTIMATED_MINUTES[process_type]
      }))
    });
  }

  private generatePartCode() {
    return `P-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
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
