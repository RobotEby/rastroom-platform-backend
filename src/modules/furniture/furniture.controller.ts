import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateFurnitureDto } from "./dto/create-furniture.dto";
import { UpdateFurnitureDto } from "./dto/update-furniture.dto";
import { FurnitureService } from "./furniture.service";

@ApiTags("furniture")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("furniture")
export class FurnitureController {
  constructor(private readonly furniture: FurnitureService) {}

  @Roles("owner", "admin", "supervisor", "operator", "operador", "maker", "engineer", "developer")
  @Get()
  findAll(@Query() query: PaginationQueryDto & { order_id?: string }, @CurrentUser() user: RequestUser) {
    return this.furniture.findAll(query, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "operator", "operador", "maker", "engineer", "developer")
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.furniture.findOne(id, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "engineer", "developer", "maker")
  @Post()
  create(@Body() dto: CreateFurnitureDto, @CurrentUser() user: RequestUser) {
    return this.furniture.create(dto, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "engineer", "developer")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateFurnitureDto, @CurrentUser() user: RequestUser) {
    return this.furniture.update(id, dto, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "developer")
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.furniture.remove(id, user.organization_id);
  }
}
