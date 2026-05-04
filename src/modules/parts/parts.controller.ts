import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ProcessType } from "@prisma/client";
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

  @Roles("admin", "supervisor", "operator", "operador", "montagem")
  @Get()
  findAll(@Query() query: PaginationQueryDto & { furniture_id?: string; current_process?: ProcessType }) {
    return this.parts.findAll(query);
  }

  @Roles("admin", "supervisor", "operator", "operador", "montagem")
  @Get("by-code/:code")
  findByCode(@Param("code") code: string) {
    return this.parts.findByCode(decodeURIComponent(code));
  }

  @Roles("admin", "supervisor", "operator", "operador", "montagem")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.parts.findOne(id);
  }

  @Roles("admin")
  @Post()
  create(@Body() dto: CreatePartDto) {
    return this.parts.create(dto);
  }

  @Roles("admin")
  @Post("import")
  importParts(@Body() dto: ImportPartsDto) {
    return this.parts.importParts(dto);
  }

  @Roles("admin")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePartDto) {
    return this.parts.update(id, dto);
  }

  @Roles("admin")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.parts.remove(id);
  }
}
