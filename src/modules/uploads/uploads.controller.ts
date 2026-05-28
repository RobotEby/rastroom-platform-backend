import { Controller, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UploadsService } from "./uploads.service";

@ApiTags("uploads")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    if (!file) throw new BadRequestException("File is required");
    return this.uploads.create(file, user);
  }
}
