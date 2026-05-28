import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiPropertyOptional({ example: "Rastroom Marcenaria" })
  @IsOptional()
  @IsString()
  organization_name?: string;

  @ApiPropertyOptional({ example: "Maria Silva" })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiProperty({ example: "maria@empresa.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 6, example: "Rastroom@123" })
  @IsString()
  @MinLength(6)
  password!: string;
}
