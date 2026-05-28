import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ProcessType } from "@prisma/client";
import { CurrentUser, RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreatePartDto, ImportPartsDto } from "./dto/create-part.dto";
import { UpdatePartDto } from "./dto/update-part.dto";
import { PartsService } from "./parts.service";

@ApiTags("parts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("parts")
export class PartsController {
  constructor(private readonly parts: PartsService) {}

  @Roles("owner", "admin", "supervisor", "operator", "operador", "maker", "montagem", "engineer", "developer")
  @Get()
  findAll(@Query() query: PaginationQueryDto & { furniture_id?: string; current_process?: ProcessType }, @CurrentUser() user: RequestUser) {
    return this.parts.findAll(query, user.organization_id);
  }


  @Roles("owner", "admin", "supervisor", "operator", "operador", "maker", "montagem", "engineer", "developer")
  @Get("production-board")
  productionBoard(@CurrentUser() user: RequestUser) {
    return this.parts.findProductionBoard(user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "operator", "operador", "maker", "montagem", "engineer", "developer")
  @Get("by-code/:code")
  findByCode(@Param("code") code: string, @CurrentUser() user: RequestUser) {
    return this.parts.findByCode(decodeURIComponent(code), user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "operator", "operador", "maker", "montagem", "engineer", "developer")
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.parts.findOne(id, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "engineer", "developer", "maker")
  @Post()
  create(@Body() dto: CreatePartDto, @CurrentUser() user: RequestUser) {
    return this.parts.create(dto, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "engineer", "developer")
  @Post("import")
  importParts(@Body() dto: ImportPartsDto, @CurrentUser() user: RequestUser) {
    return this.parts.importParts(dto, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "engineer", "developer")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePartDto, @CurrentUser() user: RequestUser) {
    return this.parts.update(id, dto, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "developer")
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.parts.remove(id, user.organization_id);
  }
}
