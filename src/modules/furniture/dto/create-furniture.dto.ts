import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateFurnitureDto {
  @ApiProperty()
  @IsUUID()
  order_id!: string;

  @ApiProperty({ example: "Armario Base" })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "Armario" })
  @IsOptional()
  @IsString()
  furniture_type?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Transform(({ value }) => (value === "" || value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  estimated_lead_time_hours?: number;
}
