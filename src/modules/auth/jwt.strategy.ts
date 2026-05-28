import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../database/prisma.service";
import { sanitizeUser } from "../../common/utils/sanitize-user";

export type JwtPayload = {
  sub: string;
  email: string;
  roles: string[];
  organization_id?: string | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_ACCESS_SECRET") ?? (process.env.NODE_ENV === "production" ? (() => { throw new Error("JWT_ACCESS_SECRET is required"); })() : "dev-access-secret")
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deleted_at: null, is_active: true }
    });

    if (!user) {
      throw new UnauthorizedException("Invalid token");
    }

    return sanitizeUser(user);
  }
}
