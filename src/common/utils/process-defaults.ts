import { ProcessType } from "@prisma/client";

export const PROCESS_ESTIMATED_MINUTES: Record<ProcessType, number> = {
  corte: 10,
  lixamento: 15,
  pintura: 30,
  borda: 12,
  montagem: 20,
  expedicao: 10
};

export const DEFAULT_PART_PROCESSES: ProcessType[] = ["corte", "lixamento", "pintura"];
