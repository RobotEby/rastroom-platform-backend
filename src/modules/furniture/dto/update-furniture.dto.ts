import { PartialType } from "@nestjs/swagger";
import { CreateFurnitureDto } from "./create-furniture.dto";

export class UpdateFurnitureDto extends PartialType(CreateFurnitureDto) {}
