import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles("admin", "supervisor")
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.users.findAll(query);
  }

  @Patch("me")
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.id, dto);
  }

  @Patch("me/password")
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.id, dto);
  }

  @Roles("admin", "supervisor")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.users.findOne(id);
  }

  @Roles("admin")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Roles("admin")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.users.remove(id);
  }
}
