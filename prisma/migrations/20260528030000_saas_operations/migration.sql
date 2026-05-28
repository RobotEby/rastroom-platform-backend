-- Rastroom SaaS operations migration
-- Adds organization scoping, dynamic workflows, documents, checklists, defects, attachments, and offline sync queue.

CREATE TYPE "DocumentType" AS ENUM ('order_summary', 'shipping_receipt', 'part_label', 'checklist', 'technical_sheet', 'defect_report');
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'generated', 'archived');
CREATE TYPE "DefectSeverity" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "DefectStatus" AS ENUM ('open', 'in_rework', 'resolved', 'scrapped');
CREATE TYPE "OfflineSyncStatus" AS ENUM ('queued', 'processed', 'failed');
CREATE TYPE "AttachmentEntityType" AS ENUM ('order', 'furniture', 'part', 'process_log', 'defect_report', 'checklist');

ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'maker';
ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'seller';
ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'engineer';
ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'developer';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'order_created';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'order_delayed';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'defect_reported';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'checklist_completed';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'document_generated';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'offline_sync_failed';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'read';

CREATE TABLE "organizations" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

ALTER TABLE "users" ADD COLUMN "organization_id" UUID;
ALTER TABLE "clients" ADD COLUMN "organization_id" UUID;
ALTER TABLE "orders" ADD COLUMN "organization_id" UUID;
ALTER TABLE "notifications" ADD COLUMN "organization_id" UUID, ADD COLUMN "recipient_id" UUID;
ALTER TABLE "audit_logs" ADD COLUMN "organization_id" UUID;

CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX "clients_organization_id_idx" ON "clients"("organization_id");
CREATE INDEX "orders_organization_id_idx" ON "orders"("organization_id");
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");
CREATE INDEX "notifications_recipient_id_idx" ON "notifications"("recipient_id");
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "process_templates" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "process_templates_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "process_template_steps" (
  "id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "process_type" "ProcessType" NOT NULL,
  "label" TEXT NOT NULL,
  "sequence_order" INTEGER NOT NULL,
  "estimated_time_minutes" INTEGER,
  "requires_checklist" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "process_template_steps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "process_template_steps_template_id_sequence_order_key" ON "process_template_steps"("template_id", "sequence_order");
ALTER TABLE "process_templates" ADD CONSTRAINT "process_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "process_template_steps" ADD CONSTRAINT "process_template_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "process_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "attachments" (
  "id" UUID NOT NULL,
  "upload_id" UUID NOT NULL,
  "entity_type" "AttachmentEntityType" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "caption" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attachments_entity_type_entity_id_idx" ON "attachments"("entity_type", "entity_id");
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "defect_reports" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "part_id" UUID NOT NULL,
  "reported_by" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" "DefectSeverity" NOT NULL DEFAULT 'medium',
  "status" "DefectStatus" NOT NULL DEFAULT 'open',
  "rework_notes" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "defect_reports_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "defect_reports" ADD CONSTRAINT "defect_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "defect_reports" ADD CONSTRAINT "defect_reports_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "checklist_templates" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "checklist_template_items" (
  "id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "checklist_runs" (
  "id" UUID NOT NULL,
  "template_id" UUID,
  "order_id" UUID,
  "part_id" UUID,
  "completed_by" UUID,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checklist_runs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "checklist_run_items" (
  "id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "checked" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "checklist_run_items_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_run_items" ADD CONSTRAINT "checklist_run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "checklist_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "documents" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "order_id" UUID,
  "type" "DocumentType" NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'generated',
  "title" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "generated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "offline_sync_events" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "device_id" TEXT NOT NULL,
  "user_id" UUID,
  "event_key" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OfflineSyncStatus" NOT NULL DEFAULT 'queued',
  "error_message" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offline_sync_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "offline_sync_events_event_key_key" ON "offline_sync_events"("event_key");
ALTER TABLE "offline_sync_events" ADD CONSTRAINT "offline_sync_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
