import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ExpeditionService } from "./expedition.service";

@ApiTags("expedition")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("expedition")
export class ExpeditionController {
  constructor(private readonly expedition: ExpeditionService) {}

  @Roles("admin", "montagem", "supervisor")
  @Get("orders")
  findReadyOrders() {
    return this.expedition.findReadyOrders();
  }

  @Roles("admin", "montagem")
  @Post("orders/:id/expedite")
  expedite(@Param("id") id: string) {
    return this.expedition.expedite(id);
  }
}
