import { Injectable } from "@nestjs/common";
import { ProcessType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

const processLabels: Record<ProcessType, string> = {
  corte: "Corte",
  lixamento: "Lixamento",
  pintura: "Pintura",
  borda: "Borda",
  montagem: "Montagem",
  expedicao: "Expedicao"
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [orderCount, partCount, clientCount, pendingParts] = await Promise.all([
      this.prisma.order.count({ where: { deleted_at: null } }),
      this.prisma.part.count({ where: { deleted_at: null } }),
      this.prisma.client.count({ where: { deleted_at: null } }),
      this.countPendingParts()
    ]);

    return { orderCount, partCount, clientCount, pendingParts };
  }

  async ordersCount() {
    return this.prisma.order.count({ where: { deleted_at: null } });
  }

  async partsCount() {
    return this.prisma.part.count({ where: { deleted_at: null } });
  }

  async clientsCount() {
    return this.prisma.client.count({ where: { deleted_at: null } });
  }

  pendingParts() {
    return this.countPendingParts();
  }

  async partsByProcess() {
    const grouped = await this.prisma.part.groupBy({
      by: ["current_process"],
      where: { deleted_at: null, current_process: { not: null } },
      _count: { _all: true }
    });

    return grouped.map((row) => ({
      name: processLabels[row.current_process as ProcessType],
      value: row._count._all
    }));
  }

  async recentLogs() {
    const logs = await this.prisma.executionLog.findMany({
      take: 10,
      orderBy: { started_at: "desc" },
      include: {
        processes: { include: { parts: true } }
      }
    });

    return logs.map((log) => ({
      id: log.id,
      status: log.status,
      elapsed_seconds: log.elapsed_seconds,
      started_at: log.started_at,
      finished_at: log.finished_at,
      parts: {
        id: log.processes.parts.id,
        name: log.processes.parts.name,
        code: log.processes.parts.code
      },
      processes: {
        id: log.processes.id,
        process_type: log.processes.process_type,
        estimated_time_minutes: log.processes.estimated_time_minutes
      }
    }));
  }

  async avgTimes() {
    const logs = await this.prisma.executionLog.findMany({
      where: { status: "concluido", elapsed_seconds: { not: null } },
      include: { processes: true }
    });

    const buckets = new Map<ProcessType, number[]>();
    for (const log of logs) {
      const list = buckets.get(log.processes.process_type) ?? [];
      list.push(log.elapsed_seconds ?? 0);
      buckets.set(log.processes.process_type, list);
    }

    return Array.from(buckets.entries()).map(([process, values]) => ({
      name: processLabels[process],
      media: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length / 60)
    }));
  }

  async alerts() {
    const logs = await this.prisma.executionLog.findMany({
      where: { status: "em_execucao" },
      include: { processes: { include: { parts: true } } }
    });

    const now = Date.now();
    return logs
      .filter((log) => {
        const estimated = log.processes.estimated_time_minutes ?? 0;
        return estimated > 0 && now - log.started_at.getTime() > estimated * 60 * 1000;
      })
      .map((log) => ({
        id: log.id,
        started_at: log.started_at,
        parts: {
          id: log.processes.parts.id,
          name: log.processes.parts.name,
          code: log.processes.parts.code
        },
        processes: {
          id: log.processes.id,
          process_type: log.processes.process_type,
          estimated_time_minutes: log.processes.estimated_time_minutes
        }
      }));
  }

  private async countPendingParts() {
    const parts = await this.prisma.part.findMany({
      where: { deleted_at: null },
      include: { processes: { include: { execution_logs: true } } }
    });

    return parts.filter(
      (part) =>
        part.processes.length === 0 ||
        part.processes.some(
          (process) => !process.execution_logs.some((log) => log.status === "concluido")
        )
    ).length;
  }
}
