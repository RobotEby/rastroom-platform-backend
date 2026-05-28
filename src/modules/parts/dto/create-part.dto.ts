import { ApiProperty, ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { ProcessType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested
} from "class-validator";

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === "" || value === null ? undefined : value;

const numberOrUndefined = ({ value }: { value: unknown }) =>
  value === "" || value === null || value === undefined ? undefined : Number(value);

export class CreatePartDto {
  @ApiProperty()
  @IsUUID()
  furniture_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  parent_part_id?: string;

  @ApiPropertyOptional({ example: "P-123" })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: "Lateral Esquerda" })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_mother_part?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(numberOrUndefined)
  @IsNumber()
  width_mm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(numberOrUndefined)
  @IsNumber()
  height_mm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(numberOrUndefined)
  @IsNumber()
  depth_mm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  material?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  finish_color?: string;

  @ApiPropertyOptional({ example: "#ffffff" })
  @IsOptional()
  @IsString()
  finish_color_hex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  finish_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paint_recipe?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  edge_banding_info?: string;

  @ApiPropertyOptional({ enum: ProcessType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ProcessType, { each: true })
  selected_processes?: ProcessType[];

  @ApiPropertyOptional({ description: "Process template used to generate the operational route for this part" })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  process_template_id?: string;
}

export class ImportPartRowDto extends OmitType(CreatePartDto, ["furniture_id"] as const) {}

export class ImportPartsDto {
  @ApiProperty()
  @IsUUID()
  furniture_id!: string;

  @ApiProperty({ type: [ImportPartRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportPartRowDto)
  parts!: ImportPartRowDto[];

  @ApiPropertyOptional({ enum: ProcessType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ProcessType, { each: true })
  processes?: ProcessType[];

  @ApiPropertyOptional({ description: "Process template applied to every imported part when row-level processes are not provided" })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  process_template_id?: string;
}
