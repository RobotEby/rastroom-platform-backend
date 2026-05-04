import { Module } from "@nestjs/common";
import { AssemblyController } from "./assembly.controller";
import { AssemblyService } from "./assembly.service";

@Module({
  controllers: [AssemblyController],
  providers: [AssemblyService],
  exports: [AssemblyService]
})
export class AssemblyModule {}
