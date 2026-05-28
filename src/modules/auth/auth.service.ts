import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { User } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { sanitizeUser } from "../../common/utils/sanitize-user";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("E-mail already registered");

    const password_hash = await argon2.hash(dto.password);
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.organization_name?.trim() || `${dto.full_name || dto.email.split("@")[0]} Workspace`,
        slug: await this.createOrganizationSlug(dto.organization_name || dto.email)
      }
    });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        full_name: dto.full_name,
        password_hash,
        organization_id: organization.id,
        roles: ["owner", "admin", "supervisor"]
      }
    });

    return this.buildSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deleted_at: null }
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordOk = await argon2.verify(user.password_hash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.buildSession(user);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET") ?? "dev-refresh-secret"
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deleted_at: null, is_active: true }
    });

    if (!user?.refresh_token_hash) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const tokenOk = await argon2.verify(user.refresh_token_hash, refreshToken);
    if (!tokenOk) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return this.buildSession(user);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refresh_token_hash: null }
    });
    return { message: "Logged out" };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deleted_at: null }
    });
    return sanitizeUser(user);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.deleted_at) {
      return { message: "If the e-mail exists, reset instructions were generated." };
    }

    const resetToken = randomBytes(32).toString("hex");
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        reset_token_hash: await argon2.hash(resetToken),
        reset_token_expires_at: new Date(Date.now() + 1000 * 60 * 30)
      }
    });

    return {
      message: "Password reset token generated for development.",
      reset_token: resetToken
    };
  }

  async resetPassword(email: string, token: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.reset_token_hash || !user.reset_token_expires_at) {
      throw new BadRequestException("Invalid reset token");
    }

    if (user.reset_token_expires_at.getTime() < Date.now()) {
      throw new BadRequestException("Reset token expired");
    }

    const tokenOk = await argon2.verify(user.reset_token_hash, token);
    if (!tokenOk) throw new BadRequestException("Invalid reset token");

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: await argon2.hash(password),
        reset_token_hash: null,
        reset_token_expires_at: null,
        refresh_token_hash: null
      }
    });

    return { message: "Password updated" };
  }

  private async createOrganizationSlug(seed: string) {
    const base = seed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "workspace";
    let slug = base;
    let suffix = 1;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }

  private async buildSession(user: User) {
    const payload = { sub: user.id, email: user.email, roles: user.roles, organization_id: user.organization_id };
    const access_token = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET") ?? "dev-access-secret",
      expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m"
    });
    const refresh_token = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>("JWT_REFRESH_SECRET") ?? "dev-refresh-secret",
      expiresIn: this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d"
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refresh_token_hash: await argon2.hash(refresh_token) }
    });

    const safeUser = sanitizeUser(user);
    return {
      user: safeUser,
      roles: safeUser.roles,
      access_token,
      refresh_token
    };
  }
}
