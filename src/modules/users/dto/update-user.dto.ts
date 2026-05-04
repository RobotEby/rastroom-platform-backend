import { ApiPropertyOptional } from "@nestjs/swagger";
import { AppRole } from "@prisma/client";
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiPropertyOptional({ enum: AppRole, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(AppRole, { each: true })
  roles?: AppRole[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
