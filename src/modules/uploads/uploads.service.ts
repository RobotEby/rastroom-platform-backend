import { Injectable, BadRequestException } from "@nestjs/common";
import { RequestUser } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../database/prisma.service";

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "text/csv", "application/vnd.openxmlformats-officedocument"];

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  create(file: Express.Multer.File, user: RequestUser) {
    const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix));
    if (!allowed) throw new BadRequestException("Unsupported file type");
    return this.prisma.upload.create({
      data: {
        owner_id: user.id,
        original_name: file.originalname,
        filename: file.filename,
        mime_type: file.mimetype,
        size_bytes: file.size,
        url: `/uploads/${file.filename}`
      }
    });
  }
}
