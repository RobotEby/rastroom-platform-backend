import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { FinishProcessDto } from "./dto/finish-process.dto";
import { StartProcessDto } from "./dto/start-process.dto";
import { ProcessesService } from "./processes.service";

@ApiTags("processes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("processes")
export class ProcessesController {
  constructor(private readonly processes: ProcessesService) {}

  @Roles("owner", "admin", "supervisor", "operator", "operador", "maker", "montagem", "developer")
  @Get()
  findByQuery(@Query("part") partId: string | undefined, @CurrentUser() user: RequestUser) {
    if (!partId) return [];
    return this.processes.findForPart(partId, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "operator", "operador", "maker", "montagem", "developer")
  @Get("part/:partId")
  findForPart(@Param("partId") partId: string, @CurrentUser() user: RequestUser) {
    return this.processes.findForPart(partId, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "operator", "operador", "maker", "developer")
  @Post(":id/start")
  start(
    @Param("id") id: string,
    @Body() dto: StartProcessDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.processes.startProcess(id, user.id, dto, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "operator", "operador", "maker", "developer")
  @Post("logs/:id/finish")
  finish(@Param("id") id: string, @Body() dto: FinishProcessDto, @CurrentUser() user: RequestUser) {
    return this.processes.finishLog(id, dto, user.organization_id);
  }
}
