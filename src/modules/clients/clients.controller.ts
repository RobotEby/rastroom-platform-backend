import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@ApiTags("clients")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("clients")
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer")
  @Get()
  findAll(@Query() query: PaginationQueryDto, @CurrentUser() user: RequestUser) {
    return this.clients.findAll(query, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer")
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.clients.findOne(id, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer")
  @Post()
  create(@Body() dto: CreateClientDto, @CurrentUser() user: RequestUser) {
    return this.clients.create(dto, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateClientDto, @CurrentUser() user: RequestUser) {
    return this.clients.update(id, dto, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "developer")
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.clients.remove(id, user.organization_id);
  }
}
