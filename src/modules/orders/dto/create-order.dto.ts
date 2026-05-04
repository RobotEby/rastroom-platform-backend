import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OrderStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  client_id!: string;

  @ApiProperty({ example: "PED-001" })
  @IsString()
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: OrderStatus, default: "rascunho" })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ example: "2026-05-20" })
  @IsOptional()
  @IsDateString()
  estimated_delivery?: string;
}
