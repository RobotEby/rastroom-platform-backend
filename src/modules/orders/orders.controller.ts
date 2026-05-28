import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OrderStatus } from "@prisma/client";
import { CurrentUser, RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { OrdersService } from "./orders.service";

@ApiTags("orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "maker", "developer", "montagem")
  @Get()
  findAll(@Query() query: PaginationQueryDto & { status?: OrderStatus }, @CurrentUser() user: RequestUser) {
    return this.orders.findAll(query, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "montagem", "developer")
  @Get("ready")
  ready(@CurrentUser() user: RequestUser) {
    return this.orders.findReadyForExpedition(user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "maker", "developer", "montagem")
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.orders.findOne(id, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer", "maker")
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: RequestUser) {
    return this.orders.create(dto, user.id, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrderDto, @CurrentUser() user: RequestUser) {
    return this.orders.update(id, dto, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "montagem", "maker", "developer")
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateOrderStatusDto, @CurrentUser() user: RequestUser) {
    return this.orders.updateStatus(id, dto, user.organization_id);
  }

  @Roles("owner", "admin", "supervisor", "developer")
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.orders.remove(id, user.organization_id);
  }
}
