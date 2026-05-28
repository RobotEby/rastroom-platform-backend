import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { normalizePagination } from "../../common/utils/pagination";
import { sanitizeUser } from "../../common/utils/sanitize-user";
import { PrismaService } from "../../database/prisma.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const pagination = normalizePagination(query, ["created_at", "updated_at", "email", "full_name"], { maxLimit: 500 });
    const where: Prisma.UserWhereInput = {
      deleted_at: null,
      ...(pagination.search
        ? {
            OR: [
              { email: { contains: pagination.search, mode: "insensitive" } },
              { full_name: { contains: pagination.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { [pagination.sortBy]: pagination.sortOrder },
      skip: pagination.skip,
      take: pagination.limit
    });

    return users.map(sanitizeUser);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id, deleted_at: null }
    });
    return sanitizeUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        email: dto.email?.toLowerCase()
      }
    });
    return sanitizeUser(user);
  }

  async remove(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false, refresh_token_hash: null }
    });
    return { message: "User removed" };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto
    });
    return sanitizeUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.current_password === dto.new_password) {
      throw new BadRequestException("New password must be different");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const passwordOk = await argon2.verify(user.password_hash, dto.current_password);
    if (!passwordOk) {
      throw new UnauthorizedException("Current password is invalid");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: await argon2.hash(dto.new_password),
        refresh_token_hash: null
      }
    });

    return { message: "Password updated" };
  }
}
