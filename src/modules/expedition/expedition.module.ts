import { Module } from "@nestjs/common";
import { ExpeditionController } from "./expedition.controller";
import { ExpeditionService } from "./expedition.service";

@Module({
  controllers: [ExpeditionController],
  providers: [ExpeditionService],
  exports: [ExpeditionService]
})
export class ExpeditionModule {}
