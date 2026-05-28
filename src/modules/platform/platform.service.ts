import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AppRole } from "@prisma/client";
import * as argon2 from "argon2";
import { RequestUser } from "../../common/decorators/current-user.decorator";
import { ROLE_PROFILES, expandRoles } from "../../common/authorization/access-policy";

type StepDto = {
  process_type: string;
  label?: string;
  sequence_order?: number;
  estimated_time_minutes?: number;
  requires_checklist?: boolean;
};

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  private orgId(user: RequestUser) {
    if (!user.organization_id) throw new ForbiddenException("User is not bound to an organization");
    return user.organization_id;
  }

  workspace(user: RequestUser) {
    return (this.prisma as any).organization.findUniqueOrThrow({
      where: { id: this.orgId(user) },
      include: {
        users: { where: { deleted_at: null }, select: { id: true, email: true, full_name: true, roles: true, is_active: true } },
        process_templates: { include: { steps: { orderBy: { sequence_order: "asc" } } } },
        checklist_templates: { include: { items: { orderBy: { sort_order: "asc" } } } }
      }
    });
  }


  accessPolicy(user: RequestUser) {
    const roles = expandRoles(user.roles ?? []);
    return {
      organization_id: this.orgId(user),
      user_roles: roles,
      profiles: ROLE_PROFILES,
      current_permissions: Array.from(
        new Set(
          ROLE_PROFILES
            .filter((profile) => roles.includes(profile.role))
            .flatMap((profile) => profile.permissions)
        )
      )
    };
  }

  async updateWorkspace(user: RequestUser, dto: { name?: string; slug?: string }) {
    const organizationId = this.orgId(user);
    const name = dto.name?.trim();
    const slug = dto.slug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!name && !slug) throw new BadRequestException("name or slug is required");

    if (slug) {
      const duplicate = await (this.prisma as any).organization.findFirst({
        where: { slug, id: { not: organizationId } }
      });
      if (duplicate) throw new ConflictException("Workspace slug is already in use");
    }

    const updated = await (this.prisma as any).organization.update({
      where: { id: organizationId },
      data: { name, slug },
      include: {
        users: { where: { deleted_at: null }, select: { id: true, email: true, full_name: true, roles: true, is_active: true } },
        process_templates: { include: { steps: { orderBy: { sequence_order: "asc" } } } },
        checklist_templates: { include: { items: { orderBy: { sort_order: "asc" } } } }
      }
    });
    await this.audit(this.prisma as any, user, "update", "organization", organizationId, { name: updated.name, slug: updated.slug });
    return updated;
  }

  async createWorkspaceUser(user: RequestUser, dto: { email?: string; full_name?: string; roles?: string[]; password?: string; is_active?: boolean }) {
    const email = dto.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException("email is required");
    if (!dto.password || dto.password.length < 8) throw new BadRequestException("password must have at least 8 characters");
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("E-mail already registered");

    const created = await this.prisma.user.create({
      data: {
        organization_id: this.orgId(user),
        email,
        full_name: dto.full_name?.trim(),
        roles: this.normalizeRoles(dto.roles),
        is_active: dto.is_active ?? true,
        password_hash: await argon2.hash(dto.password)
      }
    });
    await this.audit(this.prisma as any, user, "create", "user", created.id, { email: created.email, roles: created.roles });
    const { password_hash, refresh_token_hash, reset_token_hash, ...safe } = created as any;
    void password_hash; void refresh_token_hash; void reset_token_hash;
    return safe;
  }

  async updateWorkspaceUser(user: RequestUser, id: string, dto: { full_name?: string; roles?: string[]; is_active?: boolean }) {
    if (id === user.id && dto.is_active === false) throw new BadRequestException("You cannot deactivate your own user");
    const target = await this.prisma.user.findFirstOrThrow({ where: { id, organization_id: this.orgId(user), deleted_at: null } });
    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: {
        full_name: dto.full_name,
        roles: dto.roles ? this.normalizeRoles(dto.roles) : undefined,
        is_active: dto.is_active
      }
    });
    await this.audit(this.prisma as any, user, "update", "user", updated.id, { roles: updated.roles, is_active: updated.is_active });
    const { password_hash, refresh_token_hash, reset_token_hash, ...safe } = updated as any;
    void password_hash; void refresh_token_hash; void reset_token_hash;
    return safe;
  }


  auditLogs(user: RequestUser) {
    return this.prisma.auditLog.findMany({
      where: { organization_id: this.orgId(user) },
      include: { users: { select: { id: true, email: true, full_name: true } } },
      orderBy: { created_at: "desc" },
      take: 100
    });
  }

  offlineEvents(user: RequestUser) {
    return (this.prisma as any).offlineSyncEvent.findMany({
      where: { organization_id: this.orgId(user) },
      orderBy: { created_at: "desc" },
      take: 100
    });
  }

  async processOfflineEvent(user: RequestUser, id: string, dto: { status?: string; error_message?: string }) {
    const current = await (this.prisma as any).offlineSyncEvent.findFirstOrThrow({ where: { id, organization_id: this.orgId(user) } });
    const updated = await (this.prisma as any).offlineSyncEvent.update({
      where: { id: current.id },
      data: {
        status: dto.status ?? "processed",
        error_message: dto.error_message ?? null,
        processed_at: dto.status === "failed" ? undefined : new Date()
      }
    });
    await this.audit(this.prisma as any, user, "update", "offline_sync_event", updated.id, { status: updated.status });
    return updated;
  }

  listProcessTemplates(user: RequestUser) {
    return (this.prisma as any).processTemplate.findMany({
      where: { organization_id: this.orgId(user), is_active: true },
      include: { steps: { orderBy: { sequence_order: "asc" } } },
      orderBy: [{ is_default: "desc" }, { created_at: "desc" }]
    });
  }

  createProcessTemplate(user: RequestUser, dto: { name: string; description?: string; is_default?: boolean; steps?: StepDto[] }) {
    if (!dto.name?.trim()) throw new BadRequestException("Template name is required");
    const steps = this.normalizeSteps(dto.steps);
    return (this.prisma as any).$transaction(async (tx: any) => {
      if (dto.is_default) {
        await tx.processTemplate.updateMany({ where: { organization_id: this.orgId(user) }, data: { is_default: false } });
      }
      const created = await tx.processTemplate.create({
        data: {
          organization_id: this.orgId(user),
          name: dto.name.trim(),
          description: dto.description,
          is_default: dto.is_default ?? false,
          steps: { create: steps }
        },
        include: { steps: { orderBy: { sequence_order: "asc" } } }
      });
      await this.audit(tx, user, "create", "process_template", created.id, { name: created.name });
      return created;
    });
  }

  updateProcessTemplate(user: RequestUser, id: string, dto: { name?: string; description?: string; is_default?: boolean; is_active?: boolean; steps?: StepDto[] }) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      await tx.processTemplate.findFirstOrThrow({ where: { id, organization_id: this.orgId(user) } });
      if (dto.is_default) {
        await tx.processTemplate.updateMany({ where: { organization_id: this.orgId(user) }, data: { is_default: false } });
      }
      if (dto.steps?.length) {
        await tx.processTemplateStep.deleteMany({ where: { template_id: id } });
      }
      const updated = await tx.processTemplate.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          is_default: dto.is_default,
          is_active: dto.is_active,
          ...(dto.steps?.length ? { steps: { create: this.normalizeSteps(dto.steps) } } : {})
        },
        include: { steps: { orderBy: { sequence_order: "asc" } } }
      });
      await this.audit(tx, user, "update", "process_template", id, { name: updated.name });
      return updated;
    });
  }

  listDefects(user: RequestUser, partId?: string) {
    return (this.prisma as any).defectReport.findMany({
      where: { organization_id: this.orgId(user), ...(partId ? { part_id: partId } : {}) },
      include: { part: { include: { furniture: { include: { orders: true } } } } },
      orderBy: { created_at: "desc" }
    });
  }

  async createDefect(user: RequestUser, dto: any) {
    if (!dto.part_id || !dto.title) throw new BadRequestException("part_id and title are required");
    await this.ensurePart(user, dto.part_id);
    const defect = await (this.prisma as any).defectReport.create({
      data: {
        organization_id: this.orgId(user),
        part_id: dto.part_id,
        reported_by: user.id,
        title: dto.title,
        description: dto.description,
        severity: dto.severity ?? "medium",
        status: dto.status ?? "open"
      }
    });
    await this.notifyOrganization(user, "defect_reported", `Defect reported: ${dto.title}`);
    await this.audit(this.prisma as any, user, "create", "defect_report", defect.id, { title: defect.title, part_id: dto.part_id });
    return defect;
  }

  async updateDefect(user: RequestUser, id: string, dto: any) {
    await (this.prisma as any).defectReport.findFirstOrThrow({ where: { id, organization_id: this.orgId(user) } });
    const updated = await (this.prisma as any).defectReport.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        status: dto.status,
        rework_notes: dto.rework_notes,
        resolved_at: dto.status === "resolved" || dto.status === "scrapped" ? new Date() : undefined
      }
    });
    await this.audit(this.prisma as any, user, "update", "defect_report", id, { status: updated.status });
    return updated;
  }

  listChecklistTemplates(user: RequestUser) {
    return (this.prisma as any).checklistTemplate.findMany({
      where: { organization_id: this.orgId(user), is_active: true },
      include: { items: { orderBy: { sort_order: "asc" } } },
      orderBy: { created_at: "desc" }
    });
  }

  createChecklistTemplate(user: RequestUser, dto: any) {
    if (!dto.name || !dto.items?.length) throw new BadRequestException("name and items are required");
    return (this.prisma as any).checklistTemplate.create({
      data: {
        organization_id: this.orgId(user),
        name: dto.name,
        description: dto.description,
        items: { create: dto.items.map((item: any, index: number) => ({ label: item.label, required: item.required ?? true, sort_order: index + 1 })) }
      },
      include: { items: { orderBy: { sort_order: "asc" } } }
    });
  }

  async runChecklist(user: RequestUser, dto: any) {
    const items = dto.items ?? [];
    if (!items.length) throw new BadRequestException("Checklist items are required");
    if (dto.template_id) await this.ensureChecklistTemplate(user, dto.template_id);
    if (dto.order_id) await this.ensureOrder(user, dto.order_id);
    if (dto.part_id) await this.ensurePart(user, dto.part_id);
    if (!dto.order_id && !dto.part_id) throw new BadRequestException("order_id or part_id is required");

    const run = await (this.prisma as any).checklistRun.create({
      data: {
        template_id: dto.template_id,
        order_id: dto.order_id,
        part_id: dto.part_id,
        completed_by: user.id,
        completed_at: new Date(),
        items: { create: items.map((item: any, index: number) => ({ label: item.label, checked: !!item.checked, notes: item.notes, sort_order: index + 1 })) }
      },
      include: { items: { orderBy: { sort_order: "asc" } } }
    });
    await this.notifyOrganization(user, "checklist_completed", "Checklist concluído");
    await this.audit(this.prisma as any, user, "create", "checklist_run", run.id, { order_id: dto.order_id, part_id: dto.part_id });
    return run;
  }

  async listDocuments(user: RequestUser, orderId?: string) {
    const documents = await (this.prisma as any).document.findMany({
      where: { organization_id: this.orgId(user), ...(orderId ? { order_id: orderId } : {}) },
      orderBy: { created_at: "desc" }
    });

    return Promise.all(documents.map((document: any) => this.hydrateDocumentContent(user, document)));
  }

  async generateDocument(user: RequestUser, dto: any) {
    const type = dto.type ?? "order_summary";
    const order = dto.order_id
      ? await this.ensureOrder(user, dto.order_id, { clients: true, furniture: { include: { parts: true } } })
      : null;
    const part = dto.part_id ? await this.ensurePart(user, dto.part_id) : null;

    if (["order_summary", "shipping_receipt", "technical_sheet"].includes(type) && !order) {
      throw new BadRequestException("order_id is required for this document type");
    }
    if (type === "part_label" && !part) {
      throw new BadRequestException("part_id is required for part labels");
    }

    const orderFromPart = part?.furniture?.orders ?? null;
    const labelSnapshot = type === "part_label" && part
      ? {
          ...(dto.label ?? {}),
          part_id: part.id,
          code: part.code,
          name: part.name,
          qr_code_data: part.qr_code_data,
          material: part.material,
          finish_color: part.finish_color,
          finish_type: part.finish_type,
          width_mm: part.width_mm,
          height_mm: part.height_mm,
          depth_mm: part.depth_mm,
          current_process: part.current_process,
          furniture_name: part.furniture?.name,
          order_code: orderFromPart?.code,
          client_name: orderFromPart?.clients?.name
        }
      : dto.label ?? null;

    const content = {
      generated_at: new Date().toISOString(),
      type,
      workspace: { organization_id: this.orgId(user) },
      order: order ?? orderFromPart,
      part,
      checklist: dto.checklist ?? null,
      label: labelSnapshot,
      notes: dto.notes ?? null
    };
    const doc = await (this.prisma as any).document.create({
      data: {
        organization_id: this.orgId(user),
        order_id: dto.order_id ?? (type === "part_label" ? orderFromPart?.id : undefined),
        type,
        title: dto.title ?? this.documentTitle(type, order?.code ?? part?.code),
        content,
        generated_by: user.id
      }
    });
    await this.notifyOrganization(user, "document_generated", `Documento gerado: ${doc.title}`);
    await this.audit(this.prisma as any, user, "create", "document", doc.id, { type, order_id: dto.order_id, part_id: dto.part_id });
    return doc;
  }

  listAttachments(user: RequestUser, entityType: string, entityId: string) {
    if (!entityType || !entityId) throw new BadRequestException("entity_type and entity_id are required");
    return (this.prisma as any).attachment.findMany({
      where: { entity_type: entityType, entity_id: entityId, upload: { users: { organization_id: this.orgId(user) } } },
      include: { upload: true },
      orderBy: { created_at: "desc" }
    });
  }

  async linkAttachment(user: RequestUser, dto: any) {
    if (!dto.upload_id || !dto.entity_type || !dto.entity_id) throw new BadRequestException("upload_id, entity_type and entity_id are required");
    const upload = await this.prisma.upload.findFirstOrThrow({ where: { id: dto.upload_id, users: { organization_id: this.orgId(user) } } });
    await this.ensureAttachableEntity(user, dto.entity_type, dto.entity_id);
    const attachment = await (this.prisma as any).attachment.create({
      data: { upload_id: upload.id, entity_type: dto.entity_type, entity_id: dto.entity_id, caption: dto.caption },
      include: { upload: true }
    });
    await this.audit(this.prisma as any, user, "create", "attachment", attachment.id, { entity_type: dto.entity_type, entity_id: dto.entity_id });
    return attachment;
  }

  recordOfflineEvent(user: RequestUser, dto: any) {
    if (!dto.device_id || !dto.event_key || !dto.entity || !dto.action) {
      throw new BadRequestException("device_id, event_key, entity and action are required");
    }
    return (this.prisma as any).offlineSyncEvent.upsert({
      where: { event_key: dto.event_key },
      create: {
        organization_id: this.orgId(user),
        device_id: dto.device_id,
        user_id: user.id,
        event_key: dto.event_key,
        entity: dto.entity,
        action: dto.action,
        payload: dto.payload ?? {},
        status: "queued"
      },
      update: { payload: dto.payload ?? {}, status: "queued", error_message: null }
    });
  }

  private async hydrateDocumentContent(user: RequestUser, document: any) {
    if (document.type !== "part_label") return document;

    const content = document.content ?? {};
    const storedPart = content.part ?? {};
    const storedLabel = content.label ?? {};
    const partId = storedLabel.part_id ?? storedPart.id;
    const partCode = storedLabel.code ?? storedPart.code;
    const part = await this.findPartForLabel(user, partId, partCode);

    if (!part) return document;

    const order = part.furniture?.orders ?? content.order ?? null;
    const label = {
      ...storedLabel,
      part_id: part.id,
      code: part.code,
      name: part.name,
      qr_code_data: part.qr_code_data,
      material: part.material,
      finish_color: part.finish_color,
      finish_type: part.finish_type,
      width_mm: part.width_mm,
      height_mm: part.height_mm,
      depth_mm: part.depth_mm,
      current_process: part.current_process,
      furniture_name: part.furniture?.name ?? storedLabel.furniture_name,
      order_code: order?.code ?? storedLabel.order_code,
      client_name: order?.clients?.name ?? storedLabel.client_name
    };

    return {
      ...document,
      order_id: document.order_id ?? order?.id ?? null,
      content: {
        ...content,
        order,
        part,
        label
      }
    };
  }

  private async findPartForLabel(user: RequestUser, id?: string, code?: string) {
    const include = { furniture: { include: { orders: { include: { clients: true } } } } };
    const organizationWhere = { furniture: { orders: { organization_id: this.orgId(user) } } };

    if (id) {
      const byId = await this.prisma.part.findFirst({
        where: { id, deleted_at: null, ...organizationWhere },
        include
      });
      if (byId) return byId;
    }

    if (code) {
      const byCode = await this.prisma.part.findFirst({
        where: { code, deleted_at: null, ...organizationWhere },
        include,
        orderBy: { updated_at: "desc" }
      });
      if (byCode) return byCode;
    }

    return null;
  }

  private normalizeRoles(roles?: string[]): AppRole[] {
    const allowed = new Set<AppRole>([
      "owner",
      "admin",
      "supervisor",
      "engineer",
      "seller",
      "maker",
      "operator",
      "operador",
      "montagem",
      "developer"
    ]);
    const normalized = (roles?.length ? roles : ["maker"])
      .filter((role): role is AppRole => allowed.has(role as AppRole));
    return normalized.length ? normalized : ["maker"];
  }

  private normalizeSteps(steps?: StepDto[]) {
    const list = steps?.length ? steps : [
      { process_type: "corte", label: "Corte" },
      { process_type: "lixamento", label: "Lixamento" },
      { process_type: "pintura", label: "Pintura" },
      { process_type: "borda", label: "Borda" },
      { process_type: "montagem", label: "Montagem" },
      { process_type: "expedicao", label: "Expedição" }
    ];
    return list.map((step, index) => ({
      process_type: step.process_type,
      label: step.label ?? step.process_type,
      sequence_order: step.sequence_order ?? index + 1,
      estimated_time_minutes: step.estimated_time_minutes,
      requires_checklist: step.requires_checklist ?? false
    }));
  }

  private documentTitle(type: string, orderCode?: string) {
    const labels: Record<string, string> = {
      order_summary: "Resumo do pedido",
      shipping_receipt: "Comprovante de expedição",
      technical_sheet: "Ficha técnica",
      part_label: "Etiqueta da peça",
      checklist: "Checklist"
    };
    const suffix = orderCode ? ` - ${orderCode}` : "";
    return `${labels[type] ?? type.replace(/_/g, " ")}${suffix}`;
  }

  private ensureOrder(user: RequestUser, id: string, include?: any) {
    return this.prisma.order.findFirstOrThrow({ where: { id, organization_id: this.orgId(user), deleted_at: null }, include });
  }

  private ensurePart(user: RequestUser, id: string) {
    return this.prisma.part.findFirstOrThrow({
      where: { id, deleted_at: null, furniture: { orders: { organization_id: this.orgId(user) } } },
      include: { furniture: { include: { orders: { include: { clients: true } } } } }
    });
  }

  private ensureChecklistTemplate(user: RequestUser, id: string) {
    return (this.prisma as any).checklistTemplate.findFirstOrThrow({ where: { id, organization_id: this.orgId(user), is_active: true } });
  }

  private ensureAttachableEntity(user: RequestUser, entityType: string, entityId: string) {
    switch (entityType) {
      case "order":
        return this.ensureOrder(user, entityId);
      case "furniture":
        return this.prisma.furniture.findFirstOrThrow({ where: { id: entityId, deleted_at: null, orders: { organization_id: this.orgId(user) } } });
      case "part":
        return this.ensurePart(user, entityId);
      case "defect_report":
        return (this.prisma as any).defectReport.findFirstOrThrow({ where: { id: entityId, organization_id: this.orgId(user) } });
      case "checklist":
        return (this.prisma as any).checklistRun.findFirstOrThrow({ where: { id: entityId, OR: [{ order: { organization_id: this.orgId(user) } }, { part: { furniture: { orders: { organization_id: this.orgId(user) } } } }] } });
      case "process_log":
        return this.prisma.executionLog.findFirstOrThrow({ where: { id: entityId, processes: { parts: { furniture: { orders: { organization_id: this.orgId(user) } } } } } });
      default:
        throw new BadRequestException("Unsupported attachment entity_type");
    }
  }

  private async notifyOrganization(user: RequestUser, type: string, message: string) {
    const users = await this.prisma.user.findMany({ where: { organization_id: this.orgId(user), deleted_at: null, is_active: true } });
    if (!users.length) return;
    await (this.prisma as any).notification.createMany({
      data: users.map((recipient) => ({ organization_id: this.orgId(user), recipient_id: recipient.id, recipient_email: recipient.email, type, status: "pending", message }))
    });
  }

  private audit(client: any, user: RequestUser, action: string, entity: string, entityId?: string, metadata?: unknown) {
    return client.auditLog.create({
      data: { organization_id: this.orgId(user), actor_id: user.id, action, entity, entity_id: entityId, metadata: metadata ?? {} }
    });
  }
}
