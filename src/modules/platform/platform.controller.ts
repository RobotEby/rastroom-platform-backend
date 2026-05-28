import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PlatformService } from "./platform.service";

@ApiTags("platform")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("platform")
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Roles("owner", "admin", "supervisor", "developer", "engineer", "seller")
  @Get("workspace")
  workspace(@CurrentUser() user: RequestUser) {
    return this.platform.workspace(user);
  }


  @Roles("owner", "admin", "supervisor", "engineer", "developer")
  @Get("access-policy")
  accessPolicy(@CurrentUser() user: RequestUser) {
    return this.platform.accessPolicy(user);
  }

  @Roles("owner", "admin", "developer")
  @Patch("workspace")
  updateWorkspace(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.platform.updateWorkspace(user, dto);
  }

  @Roles("owner", "admin", "developer")
  @Post("users")
  createWorkspaceUser(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.platform.createWorkspaceUser(user, dto);
  }

  @Roles("owner", "admin", "developer")
  @Patch("users/:id")
  updateWorkspaceUser(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: any) {
    return this.platform.updateWorkspaceUser(user, id, dto);
  }

  @Roles("owner", "admin", "supervisor", "developer", "engineer", "seller")
  @Get("audit")
  audit(@CurrentUser() user: RequestUser) {
    return this.platform.auditLogs(user);
  }

  @Roles("owner", "admin", "supervisor", "developer", "engineer", "seller")
  @Get("offline-sync")
  offlineEvents(@CurrentUser() user: RequestUser) {
    return this.platform.offlineEvents(user);
  }

  @Roles("owner", "admin", "supervisor", "developer")
  @Patch("offline-sync/:id")
  processOfflineEvent(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: any) {
    return this.platform.processOfflineEvent(user, id, dto);
  }

  @Roles("owner", "admin", "engineer", "supervisor", "developer")
  @Get("process-templates")
  processTemplates(@CurrentUser() user: RequestUser) {
    return this.platform.listProcessTemplates(user);
  }

  @Roles("owner", "admin", "engineer", "supervisor", "developer")
  @Post("process-templates")
  createProcessTemplate(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.platform.createProcessTemplate(user, dto);
  }

  @Roles("owner", "admin", "engineer", "supervisor", "developer")
  @Patch("process-templates/:id")
  updateProcessTemplate(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: any) {
    return this.platform.updateProcessTemplate(user, id, dto);
  }

  @Roles("owner", "admin", "supervisor", "maker", "operator", "operador", "montagem")
  @Get("defects")
  defects(@CurrentUser() user: RequestUser, @Query("part_id") partId?: string) {
    return this.platform.listDefects(user, partId);
  }

  @Roles("owner", "admin", "supervisor", "maker", "operator", "operador", "montagem")
  @Post("defects")
  createDefect(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.platform.createDefect(user, dto);
  }

  @Roles("owner", "admin", "supervisor", "maker", "operator", "operador", "montagem")
  @Patch("defects/:id")
  updateDefect(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: any) {
    return this.platform.updateDefect(user, id, dto);
  }

  @Roles("owner", "admin", "supervisor", "engineer", "developer")
  @Get("checklist-templates")
  checklistTemplates(@CurrentUser() user: RequestUser) {
    return this.platform.listChecklistTemplates(user);
  }

  @Roles("owner", "admin", "supervisor", "engineer", "developer")
  @Post("checklist-templates")
  createChecklistTemplate(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.platform.createChecklistTemplate(user, dto);
  }

  @Roles("owner", "admin", "supervisor", "maker", "operator", "operador", "montagem")
  @Post("checklists/run")
  runChecklist(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.platform.runChecklist(user, dto);
  }

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer", "montagem")
  @Get("documents")
  documents(@CurrentUser() user: RequestUser, @Query("order_id") orderId?: string) {
    return this.platform.listDocuments(user, orderId);
  }

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer", "montagem")
  @Post("documents/generate")
  generateDocument(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.platform.generateDocument(user, dto);
  }

  @Roles("owner", "admin", "supervisor", "maker", "operator", "operador", "montagem", "engineer", "developer")
  @Get("attachments")
  attachments(@CurrentUser() user: RequestUser, @Query("entity_type") entityType: string, @Query("entity_id") entityId: string) {
    return this.platform.listAttachments(user, entityType, entityId);
  }

  @Roles("owner", "admin", "supervisor", "maker", "operator", "operador", "montagem", "engineer", "developer")
  @Post("attachments")
  linkAttachment(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.platform.linkAttachment(user, dto);
  }

  @Roles("owner", "admin", "supervisor", "maker", "operator", "operador", "montagem")
  @Post("offline-sync")
  sync(@CurrentUser() user: RequestUser, @Body() dto: any) {
    return this.platform.recordOfflineEvent(user, dto);
  }
}
