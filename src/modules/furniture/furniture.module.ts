import { Module } from "@nestjs/common";
import { FurnitureController } from "./furniture.controller";
import { FurnitureService } from "./furniture.service";

@Module({
  controllers: [FurnitureController],
  providers: [FurnitureService],
  exports: [FurnitureService]
})
export class FurnitureModule {}
