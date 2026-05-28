import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer", "maker", "operator", "operador", "montagem")
  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.notifications.findAll(user);
  }

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer", "maker", "operator", "operador", "montagem")
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.findOne(id, user);
  }

  @Roles("owner", "admin", "supervisor", "seller", "engineer", "developer", "maker", "operator", "operador", "montagem")
  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.markRead(id, user);
  }
}
