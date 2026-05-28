import { ConflictException, Injectable } from "@nestjs/common";
import { Part, Prisma, ProcessType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { normalizePagination } from "../../common/utils/pagination";
import { DEFAULT_PART_PROCESSES, PROCESS_ESTIMATED_MINUTES } from "../../common/utils/process-defaults";

type ProcessRouteStep = {
  process_type: ProcessType;
  sequence_order: number;
  estimated_time_minutes?: number | null;
};
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

  findAll(query: PaginationQueryDto & { furniture_id?: string; current_process?: ProcessType }, organizationId?: string | null) {
    const pagination = normalizePagination(query, ["created_at", "updated_at", "code", "name", "current_process", "finish_color"], { maxLimit: 500 });
    const where: Prisma.PartWhereInput = {
      deleted_at: null,
      ...(organizationId ? { furniture: { orders: { organization_id: organizationId } } } : {}),
      ...(query.furniture_id ? { furniture_id: query.furniture_id } : {}),
      ...(query.current_process ? { current_process: query.current_process } : {}),
      ...(pagination.search
        ? {
            OR: [
              { code: { contains: pagination.search, mode: "insensitive" } },
              { name: { contains: pagination.search, mode: "insensitive" } },
              { finish_color: { contains: pagination.search, mode: "insensitive" } },
              { furniture: { name: { contains: pagination.search, mode: "insensitive" } } },
              { furniture: { orders: { code: { contains: pagination.search, mode: "insensitive" } } } }
            ]
          }
        : {})
    };

    return this.prisma.part.findMany({
      where,
      include: this.listInclude,
      orderBy: { [pagination.sortBy]: pagination.sortOrder },
      skip: pagination.skip,
      take: pagination.limit
    });
  }


  findProductionBoard(organizationId?: string | null) {
    return this.prisma.part.findMany({
      where: {
        deleted_at: null,
        ...(organizationId ? { furniture: { orders: { organization_id: organizationId } } } : {})
      },
      include: this.listInclude,
      orderBy: [
        { current_process: "asc" },
        { created_at: "desc" }
      ],
      take: 200
    });
  }

  findOne(id: string, organizationId?: string | null) {
    return this.prisma.part.findFirstOrThrow({
      where: { id, deleted_at: null, ...(organizationId ? { furniture: { orders: { organization_id: organizationId } } } : {}) },
      include: this.detailInclude
    });
  }

  async findByCode(rawCode: string, organizationId?: string | null) {
    const code = this.extractCode(rawCode);
    return this.prisma.part.findFirstOrThrow({
      where: {
        deleted_at: null,
        ...(organizationId ? { furniture: { orders: { organization_id: organizationId } } } : {}),
        OR: [{ code }, { qr_code_data: rawCode }]
      },
      include: this.detailInclude
    });
  }

  async create(dto: CreatePartDto, organizationId?: string | null) {
    return this.prisma.$transaction((tx) => this.createWithProcesses(tx, dto, organizationId));
  }

  async update(id: string, dto: UpdatePartDto, organizationId?: string | null) {
    const { selected_processes, ...partDto } = dto;

    const current = await this.findOne(id, organizationId);
    return this.prisma.$transaction(async (tx) => {
      if (organizationId && partDto.code && partDto.code !== current.code) {
        const existing = await tx.part.findFirst({
          where: { code: partDto.code, deleted_at: null, id: { not: id }, furniture: { orders: { organization_id: organizationId } } }
        });
        if (existing) throw new ConflictException("Part code already exists in this workspace");
      }

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

  async importParts(dto: ImportPartsDto, organizationId?: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const created: Part[] = [];
      for (const row of dto.parts) {
        created.push(
          await this.createWithProcesses(tx, {
            ...row,
            furniture_id: dto.furniture_id,
            selected_processes: row.selected_processes ?? dto.processes,
            process_template_id: row.process_template_id ?? dto.process_template_id
          }, organizationId)
        );
      }
      return { count: created.length, parts: created };
    });
  }

  async remove(id: string, organizationId?: string | null) {
    await this.findOne(id, organizationId);
    await this.prisma.part.update({
      where: { id },
      data: { deleted_at: new Date() }
    });
    return { message: "Part removed" };
  }

  private async createWithProcesses(tx: Prisma.TransactionClient, dto: CreatePartDto, organizationId?: string | null) {
    if (organizationId) {
      await tx.furniture.findFirstOrThrow({ where: { id: dto.furniture_id, orders: { organization_id: organizationId } } });
    }
    const id = randomUUID();
    const code = dto.code?.trim() || this.generatePartCode();
    if (organizationId) {
      const existing = await tx.part.findFirst({
        where: {
          code,
          deleted_at: null,
          furniture: { orders: { organization_id: organizationId } }
        }
      });
      if (existing) throw new ConflictException("Part code already exists in this workspace");
    }
    const route = await this.resolveProcessRoute(tx, dto, organizationId);
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
        current_process: route[0]?.process_type,
        qr_code_data: JSON.stringify({ id, code })
      }
    });

    await this.createProcessRows(tx, part.id, route);

    return tx.part.findUniqueOrThrow({
      where: { id: part.id },
      include: this.detailInclude
    });
  }

  private async resolveProcessRoute(tx: Prisma.TransactionClient, dto: CreatePartDto, organizationId?: string | null): Promise<ProcessRouteStep[]> {
    if (dto.process_template_id) {
      const template = await (tx as any).processTemplate.findFirstOrThrow({
        where: { id: dto.process_template_id, ...(organizationId ? { organization_id: organizationId } : {}), is_active: true },
        include: { steps: { orderBy: { sequence_order: "asc" } } }
      });
      return template.steps.map((step: any, index: number) => ({
        process_type: step.process_type,
        sequence_order: step.sequence_order ?? index + 1,
        estimated_time_minutes: step.estimated_time_minutes ?? PROCESS_ESTIMATED_MINUTES[step.process_type as ProcessType]
      }));
    }

    const selected = dto.selected_processes?.length ? dto.selected_processes : DEFAULT_PART_PROCESSES;
    return selected.map((process_type, index) => ({
      process_type,
      sequence_order: index + 1,
      estimated_time_minutes: PROCESS_ESTIMATED_MINUTES[process_type]
    }));
  }

  private createProcessRows(tx: Prisma.TransactionClient, partId: string, route: Array<ProcessRouteStep | ProcessType>) {
    return tx.process.createMany({
      data: route.map((step, index) => {
        const normalized = typeof step === "string"
          ? {
              process_type: step,
              sequence_order: index + 1,
              estimated_time_minutes: PROCESS_ESTIMATED_MINUTES[step]
            }
          : {
              process_type: step.process_type,
              sequence_order: step.sequence_order ?? index + 1,
              estimated_time_minutes: step.estimated_time_minutes ?? PROCESS_ESTIMATED_MINUTES[step.process_type]
            };

        return {
          part_id: partId,
          process_type: normalized.process_type,
          sequence_order: normalized.sequence_order,
          estimated_time_minutes: normalized.estimated_time_minutes
        };
      })
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
