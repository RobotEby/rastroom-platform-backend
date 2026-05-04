import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  create(file: Express.Multer.File, ownerId?: string) {
    return this.prisma.upload.create({
      data: {
        owner_id: ownerId,
        original_name: file.originalname,
        filename: file.filename,
        mime_type: file.mimetype,
        size_bytes: file.size,
        url: `/uploads/${file.filename}`
      }
    });
  }
}
