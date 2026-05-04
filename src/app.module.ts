import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./database/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { FurnitureModule } from "./modules/furniture/furniture.module";
import { PartsModule } from "./modules/parts/parts.module";
import { ProcessesModule } from "./modules/processes/processes.module";
import { AssemblyModule } from "./modules/assembly/assembly.module";
import { ExpeditionModule } from "./modules/expedition/expedition.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100
      }
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    OrdersModule,
    FurnitureModule,
    PartsModule,
    ProcessesModule,
    AssemblyModule,
    ExpeditionModule,
    DashboardModule,
    UploadsModule,
    NotificationsModule
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
