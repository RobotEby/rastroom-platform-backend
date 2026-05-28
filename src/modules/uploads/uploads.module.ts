import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaModule } from "../../database/prisma.module";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR ?? "uploads",
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`)
      }),
      limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024) }
    })
  ],
  controllers: [UploadsController],
  providers: [UploadsService]
})
export class UploadsModule {}
