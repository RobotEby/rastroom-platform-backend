import { Injectable } from "@nestjs/common";
import { DefectSeverity, DefectStatus, OrderStatus, Prisma, ProcessType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

const processLabels: Record<ProcessType, string> = {
  corte: "Corte",
  lixamento: "Lixamento",
  pintura: "Pintura",
  borda: "Borda",
  montagem: "Montagem",
  expedicao: "Expedição"
};

const orderLabels: Record<OrderStatus, string> = {
  rascunho: "Rascunho",
  em_producao: "Em produção",
  montagem: "Montagem",
  pronto: "Pronto",
  expedido: "Expedido"
};

const defectStatusLabels: Record<DefectStatus, string> = {
  open: "Aberto",
  in_rework: "Em retrabalho",
  resolved: "Resolvido",
  scrapped: "Descartado"
};

const defectSeverityLabels: Record<DefectSeverity, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica"
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async management(organizationId?: string | null) {
    const now = new Date();
    const nextSevenDays = new Date(now);
    nextSevenDays.setDate(nextSevenDays.getDate() + 7);

    const orderWhere: Prisma.OrderWhereInput = {
      deleted_at: null,
      ...(organizationId ? { organization_id: organizationId } : {})
    };
    const partWhere: Prisma.PartWhereInput = {
      deleted_at: null,
      ...(organizationId ? { furniture: { orders: { organization_id: organizationId } } } : {})
    };
    const executionLogWhere: Prisma.ExecutionLogWhereInput = {
      ...(organizationId
        ? { processes: { parts: { furniture: { orders: { organization_id: organizationId } } } } }
        : {})
    };
    const defectWhere: Prisma.DefectReportWhereInput = {
      ...(organizationId ? { organization_id: organizationId } : {})
    };

    const [
      orderCount,
      activeOrderCount,
      partCount,
      clientCount,
      pendingParts,
      finishedParts,
      delayedOrders,
      openDefects,
      runningProcesses,
      partsByProcess,
      ordersByStatus,
      defectsByStatus,
      defectsBySeverity,
      recentLogs,
      avgTimes,
      operatorProductivity,
      riskyOrders
    ] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.count({
        where: { ...orderWhere, status: { in: ["rascunho", "em_producao", "montagem"] } }
      }),
      this.prisma.part.count({ where: partWhere }),
      this.prisma.client.count({
        where: { deleted_at: null, ...(organizationId ? { organization_id: organizationId } : {}) }
      }),
      this.countPendingParts(organizationId),
      this.prisma.part.count({ where: { ...partWhere, current_process: "expedicao" } }),
      this.prisma.order.count({
        where: {
          ...orderWhere,
          estimated_delivery: { lt: now },
          status: { notIn: ["pronto", "expedido"] }
        }
      }),
      this.prisma.defectReport.count({ where: { ...defectWhere, status: { in: ["open", "in_rework"] } } }),
      this.prisma.executionLog.count({ where: { ...executionLogWhere, status: "em_execucao" } }),
      this.partsByProcess(organizationId),
      this.ordersByStatus(organizationId),
      this.defectsByStatus(organizationId),
      this.defectsBySeverity(organizationId),
      this.recentLogs(organizationId, 8),
      this.avgTimes(organizationId),
      this.operatorProductivity(organizationId),
      this.riskyOrders(organizationId, now, nextSevenDays)
    ]);

    const bottlenecks = partsByProcess
      .map((process) => {
        const average = avgTimes.find((item) => item.key === process.key)?.media ?? 0;
        return {
          ...process,
          average_minutes: average,
          score: process.value * Math.max(average, 1)
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    return {
      updated_at: now.toISOString(),
      summary: {
        orderCount,
        activeOrderCount,
        partCount,
        clientCount,
        pendingParts,
        finishedParts,
        delayedOrders,
        openDefects,
        runningProcesses
      },
      charts: {
        partsByProcess,
        ordersByStatus,
        defectsByStatus,
        defectsBySeverity,
        avgTimes,
        operatorProductivity,
        bottlenecks
      },
      lists: {
        riskyOrders,
        recentLogs,
        alerts: await this.alerts(organizationId)
      }
    };
  }

  async summary(organizationId?: string | null) {
    const [orderCount, partCount, clientCount, pendingParts] = await Promise.all([
      this.prisma.order.count({ where: { deleted_at: null, ...(organizationId ? { organization_id: organizationId } : {}) } }),
      this.prisma.part.count({
        where: { deleted_at: null, ...(organizationId ? { furniture: { orders: { organization_id: organizationId } } } : {}) }
      }),
      this.prisma.client.count({ where: { deleted_at: null, ...(organizationId ? { organization_id: organizationId } : {}) } }),
      this.countPendingParts(organizationId)
    ]);

    return { orderCount, partCount, clientCount, pendingParts };
  }

  async ordersCount(organizationId?: string | null) {
    return this.prisma.order.count({ where: { deleted_at: null, ...(organizationId ? { organization_id: organizationId } : {}) } });
  }

  async partsCount(organizationId?: string | null) {
    return this.prisma.part.count({
      where: { deleted_at: null, ...(organizationId ? { furniture: { orders: { organization_id: organizationId } } } : {}) }
    });
  }

  async clientsCount(organizationId?: string | null) {
    return this.prisma.client.count({ where: { deleted_at: null, ...(organizationId ? { organization_id: organizationId } : {}) } });
  }

  pendingParts(organizationId?: string | null) {
    return this.countPendingParts(organizationId);
  }

  async partsByProcess(organizationId?: string | null) {
    const grouped = await this.prisma.part.groupBy({
      by: ["current_process"],
      where: {
        deleted_at: null,
        current_process: { not: null },
        ...(organizationId ? { furniture: { orders: { organization_id: organizationId } } } : {})
      },
      _count: { _all: true }
    });

    const counts = new Map(
      grouped
        .filter((row) => Boolean(row.current_process))
        .map((row) => [row.current_process as ProcessType, row._count._all])
    );

    return Object.values(ProcessType).map((process) => ({
      key: process,
      name: processLabels[process],
      value: counts.get(process) ?? 0
    }));
  }

  async ordersByStatus(organizationId?: string | null) {
    const grouped = await this.prisma.order.groupBy({
      by: ["status"],
      where: { deleted_at: null, ...(organizationId ? { organization_id: organizationId } : {}) },
      _count: { _all: true }
    });
    const counts = new Map(grouped.map((row) => [row.status, row._count._all]));
    return Object.values(OrderStatus).map((status) => ({
      key: status,
      name: orderLabels[status],
      value: counts.get(status) ?? 0
    }));
  }

  async defectsByStatus(organizationId?: string | null) {
    const grouped = await this.prisma.defectReport.groupBy({
      by: ["status"],
      where: { ...(organizationId ? { organization_id: organizationId } : {}) },
      _count: { _all: true }
    });
    const counts = new Map(grouped.map((row) => [row.status, row._count._all]));
    return Object.values(DefectStatus).map((status) => ({
      key: status,
      name: defectStatusLabels[status],
      value: counts.get(status) ?? 0
    }));
  }

  async defectsBySeverity(organizationId?: string | null) {
    const grouped = await this.prisma.defectReport.groupBy({
      by: ["severity"],
      where: { ...(organizationId ? { organization_id: organizationId } : {}) },
      _count: { _all: true }
    });
    const counts = new Map(grouped.map((row) => [row.severity, row._count._all]));
    return Object.values(DefectSeverity).map((severity) => ({
      key: severity,
      name: defectSeverityLabels[severity],
      value: counts.get(severity) ?? 0
    }));
  }

  async recentLogs(organizationId?: string | null, take = 10) {
    const logs = await this.prisma.executionLog.findMany({
      take,
      where: {
        ...(organizationId ? { processes: { parts: { furniture: { orders: { organization_id: organizationId } } } } } : {})
      },
      orderBy: { started_at: "desc" },
      include: {
        users: true,
        processes: { include: { parts: { include: { furniture: { include: { orders: { include: { clients: true } } } } } } } }
      }
    });

    return logs.map((log) => ({
      id: log.id,
      status: log.status,
      elapsed_seconds: log.elapsed_seconds,
      started_at: log.started_at,
      finished_at: log.finished_at,
      operator: log.users?.full_name ?? log.users?.email ?? "Operador não informado",
      parts: {
        id: log.processes.parts.id,
        name: log.processes.parts.name,
        code: log.processes.parts.code,
        furniture: log.processes.parts.furniture.name,
        order: log.processes.parts.furniture.orders.code,
        client: log.processes.parts.furniture.orders.clients.name
      },
      processes: {
        id: log.processes.id,
        process_type: log.processes.process_type,
        process_label: processLabels[log.processes.process_type],
        estimated_time_minutes: log.processes.estimated_time_minutes
      }
    }));
  }

  async avgTimes(organizationId?: string | null) {
    const logs = await this.prisma.executionLog.findMany({
      where: {
        status: "concluido",
        elapsed_seconds: { not: null },
        ...(organizationId ? { processes: { parts: { furniture: { orders: { organization_id: organizationId } } } } } : {})
      },
      include: { processes: true }
    });

    const buckets = new Map<ProcessType, number[]>();
    for (const log of logs) {
      const list = buckets.get(log.processes.process_type) ?? [];
      list.push(log.elapsed_seconds ?? 0);
      buckets.set(log.processes.process_type, list);
    }

    return Object.values(ProcessType).map((process) => {
      const values = buckets.get(process) ?? [];
      return {
        key: process,
        name: processLabels[process],
        media: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length / 60) : 0
      };
    });
  }

  async alerts(organizationId?: string | null) {
    const logs = await this.prisma.executionLog.findMany({
      where: {
        status: "em_execucao",
        ...(organizationId ? { processes: { parts: { furniture: { orders: { organization_id: organizationId } } } } } : {})
      },
      include: { processes: { include: { parts: { include: { furniture: { include: { orders: { include: { clients: true } } } } } } } } }
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
        minutes_late: Math.max(0, Math.round((now - log.started_at.getTime()) / 60000) - (log.processes.estimated_time_minutes ?? 0)),
        parts: {
          id: log.processes.parts.id,
          name: log.processes.parts.name,
          code: log.processes.parts.code,
          furniture: log.processes.parts.furniture.name,
          order: log.processes.parts.furniture.orders.code,
          client: log.processes.parts.furniture.orders.clients.name
        },
        processes: {
          id: log.processes.id,
          process_type: log.processes.process_type,
          process_label: processLabels[log.processes.process_type],
          estimated_time_minutes: log.processes.estimated_time_minutes
        }
      }));
  }

  private async operatorProductivity(organizationId?: string | null) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const logs = await this.prisma.executionLog.findMany({
      where: {
        status: "concluido",
        finished_at: { gte: since },
        ...(organizationId ? { processes: { parts: { furniture: { orders: { organization_id: organizationId } } } } } : {})
      },
      include: { users: true }
    });

    const buckets = new Map<string, { name: string; value: number; total_seconds: number }>();
    for (const log of logs) {
      const key = log.operator_id ?? "sem-operador";
      const current = buckets.get(key) ?? {
        name: log.users?.full_name ?? log.users?.email ?? "Sem operador",
        value: 0,
        total_seconds: 0
      };
      current.value += 1;
      current.total_seconds += log.elapsed_seconds ?? 0;
      buckets.set(key, current);
    }

    return Array.from(buckets.values())
      .map((item) => ({
        ...item,
        average_minutes: item.value ? Math.round(item.total_seconds / item.value / 60) : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }

  private async riskyOrders(organizationId: string | null | undefined, now: Date, nextSevenDays: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        deleted_at: null,
        ...(organizationId ? { organization_id: organizationId } : {}),
        status: { notIn: ["pronto", "expedido"] },
        estimated_delivery: { lte: nextSevenDays }
      },
      include: {
        clients: true,
        furniture: { where: { deleted_at: null }, include: { parts: { where: { deleted_at: null } } } }
      },
      orderBy: { estimated_delivery: "asc" },
      take: 8
    });

    return orders.map((order) => {
      const totalParts = order.furniture.reduce((sum, item) => sum + item.parts.length, 0);
      const isLate = Boolean(order.estimated_delivery && order.estimated_delivery < now);
      return {
        id: order.id,
        code: order.code,
        client: order.clients.name,
        status: order.status,
        status_label: orderLabels[order.status],
        estimated_delivery: order.estimated_delivery,
        total_parts: totalParts,
        is_late: isLate,
        days_to_delivery: order.estimated_delivery
          ? Math.ceil((order.estimated_delivery.getTime() - now.getTime()) / 86_400_000)
          : null
      };
    });
  }

  private async countPendingParts(organizationId?: string | null) {
    const parts = await this.prisma.part.findMany({
      where: {
        deleted_at: null,
        ...(organizationId ? { furniture: { orders: { organization_id: organizationId } } } : {})
      },
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
