import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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

  @Roles("admin", "supervisor")
  @Get("summary")
  summary() {
    return this.dashboard.summary();
  }

  @Roles("admin", "supervisor")
  @Get("orders-count")
  ordersCount() {
    return this.dashboard.ordersCount();
  }

  @Roles("admin", "supervisor")
  @Get("parts-count")
  partsCount() {
    return this.dashboard.partsCount();
  }

  @Roles("admin", "supervisor")
  @Get("clients-count")
  clientsCount() {
    return this.dashboard.clientsCount();
  }

  @Roles("admin", "supervisor")
  @Get("pending-parts")
  pendingParts() {
    return this.dashboard.pendingParts();
  }

  @Roles("admin", "supervisor")
  @Get("parts-by-process")
  partsByProcess() {
    return this.dashboard.partsByProcess();
  }

  @Roles("admin", "supervisor")
  @Get("recent-logs")
  recentLogs() {
    return this.dashboard.recentLogs();
  }

  @Roles("admin", "supervisor")
  @Get("avg-times")
  avgTimes() {
    return this.dashboard.avgTimes();
  }

  @Roles("admin", "supervisor")
  @Get("alerts")
  alerts() {
    return this.dashboard.alerts();
  }
}
