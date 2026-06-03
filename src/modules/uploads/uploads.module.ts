import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaModule } from "../../database/prisma.module";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

function getMaxUploadSizeBytes() {
  const maxUploadSizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 10);
  return Number.isFinite(maxUploadSizeMb) && maxUploadSizeMb > 0
    ? maxUploadSizeMb * 1024 * 1024
    : 10 * 1024 * 1024;
}

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR ?? "uploads",
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`)
      }),
      limits: { fileSize: getMaxUploadSizeBytes() }
    })
  ],
  controllers: [UploadsController],
  providers: [UploadsService]
})
export class UploadsModule {}
