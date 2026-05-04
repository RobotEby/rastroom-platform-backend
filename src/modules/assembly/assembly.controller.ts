import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AssemblyService } from "./assembly.service";

@ApiTags("assembly")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("assembly")
export class AssemblyController {
  constructor(private readonly assembly: AssemblyService) {}

  @Roles("admin", "montagem", "supervisor")
  @Get("kits/lookup")
  lookupByQuery(@Query("code") code: string) {
    return this.assembly.lookupKit(code);
  }

  @Roles("admin", "montagem", "supervisor")
  @Get("kits/:code")
  lookup(@Param("code") code: string) {
    return this.assembly.lookupKit(decodeURIComponent(code));
  }

  @Roles("admin", "montagem")
  @Post("kits/:id/finalize")
  finalize(@Param("id") id: string) {
    return this.assembly.finalizeKit(id);
  }
}
