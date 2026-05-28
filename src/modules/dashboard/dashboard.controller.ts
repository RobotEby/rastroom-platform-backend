import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles("admin", "owner", "supervisor", "engineer", "developer")
  @Get("management")
  management(@CurrentUser() user: RequestUser) {
    return this.dashboard.management(user.organization_id);
  }

  @Roles("admin", "owner", "supervisor", "engineer", "developer")
  @Get("summary")
  summary(@CurrentUser() user: RequestUser) {
    return this.dashboard.summary(user.organization_id);
  }

  @Roles("admin", "owner", "supervisor", "engineer", "developer")
  @Get("orders-count")
  ordersCount(@CurrentUser() user: RequestUser) {
    return this.dashboard.ordersCount(user.organization_id);
  }

  @Roles("admin", "owner", "supervisor", "engineer", "developer")
  @Get("parts-count")
  partsCount(@CurrentUser() user: RequestUser) {
    return this.dashboard.partsCount(user.organization_id);
  }

  @Roles("admin", "owner", "supervisor", "engineer", "developer")
  @Get("clients-count")
  clientsCount(@CurrentUser() user: RequestUser) {
    return this.dashboard.clientsCount(user.organization_id);
  }

  @Roles("admin", "owner", "supervisor", "engineer", "developer")
  @Get("pending-parts")
  pendingParts(@CurrentUser() user: RequestUser) {
    return this.dashboard.pendingParts(user.organization_id);
  }

  @Roles("admin", "owner", "supervisor", "engineer", "developer")
  @Get("parts-by-process")
  partsByProcess(@CurrentUser() user: RequestUser) {
    return this.dashboard.partsByProcess(user.organization_id);
  }

  @Roles("admin", "owner", "supervisor", "engineer", "developer")
  @Get("recent-logs")
  recentLogs(@CurrentUser() user: RequestUser) {
    return this.dashboard.recentLogs(user.organization_id);
  }

  @Roles("admin", "owner", "supervisor", "engineer", "developer")
  @Get("avg-times")
  avgTimes(@CurrentUser() user: RequestUser) {
    return this.dashboard.avgTimes(user.organization_id);
  }

  @Roles("admin", "owner", "supervisor", "engineer", "developer")
  @Get("alerts")
  alerts(@CurrentUser() user: RequestUser) {
    return this.dashboard.alerts(user.organization_id);
  }
}
