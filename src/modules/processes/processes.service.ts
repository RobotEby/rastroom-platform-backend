import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { FinishProcessDto } from "./dto/finish-process.dto";
import { StartProcessDto } from "./dto/start-process.dto";

@Injectable()
export class ProcessesService {
  constructor(private readonly prisma: PrismaService) {}

  findForPart(partId: string) {
    return this.prisma.process.findMany({
      where: { part_id: partId },
      orderBy: { sequence_order: "asc" },
      include: {
        execution_logs: {
          orderBy: { started_at: "desc" },
          include: { users: true }
        }
      }
    });
  }

  async startProcess(processId: string, userId: string, dto: StartProcessDto) {
    const process = await this.prisma.process.findUniqueOrThrow({
      where: { id: processId },
      include: {
        parts: true,
        execution_logs: true
      }
    });

    const previous = await this.prisma.process.findFirst({
      where: {
        part_id: process.part_id,
        sequence_order: process.sequence_order - 1
      },
      include: { execution_logs: true }
    });

    if (previous) {
      const previousDone = previous.execution_logs.some((log) => log.status === "concluido");
      if (!previousDone) {
        throw new BadRequestException("Previous process must be completed first");
      }
    }

    const activeLog = await this.prisma.executionLog.findFirst({
      where: {
        status: "em_execucao",
        processes: { part_id: process.part_id }
      }
    });
    if (activeLog) {
      throw new BadRequestException("This part already has a running process");
    }

    const alreadyDone = process.execution_logs.some((log) => log.status === "concluido");
    if (alreadyDone) {
      throw new BadRequestException("Process already completed");
    }

    const log = await this.prisma.executionLog.create({
      data: {
        process_id: processId,
        operator_id: userId,
        status: "em_execucao",
        notes: dto.notes
      },
      include: {
        processes: { include: { parts: true } },
        users: true
      }
    });

    await this.prisma.part.update({
      where: { id: process.part_id },
      data: { current_process: process.process_type }
    });

    return log;
  }

  async finishLog(logId: string, dto: FinishProcessDto) {
    return this.prisma.$transaction(async (tx) => {
      const log = await tx.executionLog.findUniqueOrThrow({
        where: { id: logId },
        include: { processes: { include: { parts: { include: { furniture: true } } } } }
      });

      if (log.status !== "em_execucao") {
        throw new BadRequestException("Only running logs can be finished");
      }

      const now = new Date();
      const elapsed =
        dto.elapsed_seconds ??
        Math.max(0, Math.round((now.getTime() - log.started_at.getTime()) / 1000));

      const updated = await tx.executionLog.update({
        where: { id: logId },
        data: {
          status: "concluido",
          finished_at: now,
          elapsed_seconds: elapsed,
          notes: dto.notes ?? log.notes
        },
        include: { processes: { include: { parts: true } }, users: true }
      });

      await this.updatePartProgress(tx, log.processes.part_id);
      await this.updateOrderIfReady(tx, log.processes.parts.furniture.order_id);

      return updated;
    });
  }

  private async updatePartProgress(tx: Prisma.TransactionClient, partId: string) {
    const processes = await tx.process.findMany({
      where: { part_id: partId },
      orderBy: { sequence_order: "asc" },
      include: { execution_logs: true }
    });

    const next = processes.find(
      (process) => !process.execution_logs.some((log) => log.status === "concluido")
    );

    if (next) {
      await tx.part.update({
        where: { id: partId },
        data: { current_process: next.process_type }
      });
    }
  }

  private async updateOrderIfReady(tx: Prisma.TransactionClient, orderId: string) {
    const parts = await tx.part.findMany({
      where: {
        deleted_at: null,
        furniture: { order_id: orderId }
      },
      include: {
        processes: { include: { execution_logs: true } }
      }
    });

    if (!parts.length) return;

    const allReady = parts.every((part) =>
      part.processes.length > 0 &&
      part.processes.every((process) =>
        process.execution_logs.some((log) => log.status === "concluido")
      )
    );

    if (allReady) {
      await tx.order.updateMany({
        where: { id: orderId, status: { notIn: ["expedido"] } },
        data: { status: "pronto" }
      });
    }
  }
}
