import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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

  @Roles("admin", "supervisor", "operator", "operador")
  @Get()
  findAll(@Query() query: PaginationQueryDto & { order_id?: string }) {
    return this.furniture.findAll(query);
  }

  @Roles("admin", "supervisor", "operator", "operador")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.furniture.findOne(id);
  }

  @Roles("admin")
  @Post()
  create(@Body() dto: CreateFurnitureDto) {
    return this.furniture.create(dto);
  }

  @Roles("admin")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateFurnitureDto) {
    return this.furniture.update(id, dto);
  }

  @Roles("admin")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.furniture.remove(id);
  }
}
