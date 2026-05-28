import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "./database/prisma.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  health() {
    return {
      status: "ok",
      service: "rastroom-platform-backend",
      timestamp: new Date().toISOString()
    };
  }

  @Get("health/ready")
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        service: "rastroom-platform-backend",
        database: "connected",
        timestamp: new Date().toISOString()
      };
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        service: "rastroom-platform-backend",
        database: "unavailable",
        message: "Banco de dados indisponivel para o Rastroom."
      });
    }
  }
}
