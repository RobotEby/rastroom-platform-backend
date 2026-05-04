CREATE TYPE "AppRole" AS ENUM ('admin', 'operator', 'operador', 'montagem', 'supervisor');
CREATE TYPE "OrderStatus" AS ENUM ('rascunho', 'em_producao', 'montagem', 'pronto', 'expedido');
CREATE TYPE "ProcessType" AS ENUM ('corte', 'lixamento', 'pintura', 'borda', 'montagem', 'expedicao');
CREATE TYPE "ProcessLogStatus" AS ENUM ('aguardando', 'em_execucao', 'concluido', 'alerta');
CREATE TYPE "NotificationType" AS ENUM ('order_expedited', 'kit_completed', 'process_alert');
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT,
  "roles" "AppRole"[] NOT NULL DEFAULT ARRAY['operator']::"AppRole"[],
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "refresh_token_hash" TEXT,
  "reset_token_hash" TEXT,
  "reset_token_expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clients" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "status" "OrderStatus" NOT NULL DEFAULT 'rascunho',
  "estimated_delivery" TIMESTAMP(3),
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "furniture" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "furniture_type" TEXT,
  "estimated_lead_time_hours" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "furniture_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "parts" (
  "id" UUID NOT NULL,
  "furniture_id" UUID NOT NULL,
  "parent_part_id" UUID,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_mother_part" BOOLEAN NOT NULL DEFAULT false,
  "width_mm" DOUBLE PRECISION,
  "height_mm" DOUBLE PRECISION,
  "depth_mm" DOUBLE PRECISION,
  "material" TEXT,
  "finish_color" TEXT,
  "finish_color_hex" TEXT,
  "finish_type" TEXT,
  "paint_recipe" TEXT,
  "edge_banding_info" TEXT,
  "current_process" "ProcessType",
  "qr_code_data" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "processes" (
  "id" UUID NOT NULL,
  "part_id" UUID NOT NULL,
  "process_type" "ProcessType" NOT NULL,
  "sequence_order" INTEGER NOT NULL,
  "estimated_time_minutes" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "execution_logs" (
  "id" UUID NOT NULL,
  "process_id" UUID NOT NULL,
  "operator_id" UUID,
  "status" "ProcessLogStatus" NOT NULL DEFAULT 'em_execucao',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "elapsed_seconds" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "order_id" UUID,
  "recipient_email" TEXT,
  "type" "NotificationType" NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
  "message" TEXT NOT NULL,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uploads" (
  "id" UUID NOT NULL,
  "owner_id" UUID,
  "original_name" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "actor_id" UUID,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entity_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
CREATE INDEX "clients_name_idx" ON "clients"("name");
CREATE INDEX "clients_email_idx" ON "clients"("email");
CREATE INDEX "clients_deleted_at_idx" ON "clients"("deleted_at");
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");
CREATE INDEX "orders_client_id_idx" ON "orders"("client_id");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_estimated_delivery_idx" ON "orders"("estimated_delivery");
CREATE INDEX "orders_deleted_at_idx" ON "orders"("deleted_at");
CREATE INDEX "furniture_order_id_idx" ON "furniture"("order_id");
CREATE INDEX "furniture_name_idx" ON "furniture"("name");
CREATE INDEX "furniture_deleted_at_idx" ON "furniture"("deleted_at");
CREATE UNIQUE INDEX "parts_code_key" ON "parts"("code");
CREATE UNIQUE INDEX "parts_qr_code_data_key" ON "parts"("qr_code_data");
CREATE INDEX "parts_furniture_id_idx" ON "parts"("furniture_id");
CREATE INDEX "parts_parent_part_id_idx" ON "parts"("parent_part_id");
CREATE INDEX "parts_code_idx" ON "parts"("code");
CREATE INDEX "parts_current_process_idx" ON "parts"("current_process");
CREATE INDEX "parts_deleted_at_idx" ON "parts"("deleted_at");
CREATE UNIQUE INDEX "processes_part_id_sequence_order_key" ON "processes"("part_id", "sequence_order");
CREATE INDEX "processes_part_id_idx" ON "processes"("part_id");
CREATE INDEX "processes_process_type_idx" ON "processes"("process_type");
CREATE INDEX "execution_logs_process_id_idx" ON "execution_logs"("process_id");
CREATE INDEX "execution_logs_operator_id_idx" ON "execution_logs"("operator_id");
CREATE INDEX "execution_logs_status_idx" ON "execution_logs"("status");
CREATE INDEX "execution_logs_started_at_idx" ON "execution_logs"("started_at");
CREATE INDEX "notifications_order_id_idx" ON "notifications"("order_id");
CREATE INDEX "notifications_status_idx" ON "notifications"("status");
CREATE INDEX "uploads_owner_id_idx" ON "uploads"("owner_id");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "furniture" ADD CONSTRAINT "furniture_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parts" ADD CONSTRAINT "parts_furniture_id_fkey" FOREIGN KEY ("furniture_id") REFERENCES "furniture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parts" ADD CONSTRAINT "parts_parent_part_id_fkey" FOREIGN KEY ("parent_part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "processes" ADD CONSTRAINT "processes_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
