-- CreateIndex
CREATE INDEX "attachments_upload_id_idx" ON "attachments"("upload_id");

-- CreateIndex
CREATE INDEX "checklist_run_items_run_id_idx" ON "checklist_run_items"("run_id");

-- CreateIndex
CREATE INDEX "checklist_runs_template_id_idx" ON "checklist_runs"("template_id");

-- CreateIndex
CREATE INDEX "checklist_runs_order_id_idx" ON "checklist_runs"("order_id");

-- CreateIndex
CREATE INDEX "checklist_runs_part_id_idx" ON "checklist_runs"("part_id");

-- CreateIndex
CREATE INDEX "checklist_template_items_template_id_idx" ON "checklist_template_items"("template_id");

-- CreateIndex
CREATE INDEX "checklist_templates_organization_id_idx" ON "checklist_templates"("organization_id");

-- CreateIndex
CREATE INDEX "defect_reports_organization_id_idx" ON "defect_reports"("organization_id");

-- CreateIndex
CREATE INDEX "defect_reports_part_id_idx" ON "defect_reports"("part_id");

-- CreateIndex
CREATE INDEX "defect_reports_status_idx" ON "defect_reports"("status");

-- CreateIndex
CREATE INDEX "documents_organization_id_idx" ON "documents"("organization_id");

-- CreateIndex
CREATE INDEX "documents_order_id_idx" ON "documents"("order_id");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "offline_sync_events_organization_id_idx" ON "offline_sync_events"("organization_id");

-- CreateIndex
CREATE INDEX "offline_sync_events_device_id_idx" ON "offline_sync_events"("device_id");

-- CreateIndex
CREATE INDEX "offline_sync_events_status_idx" ON "offline_sync_events"("status");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "process_template_steps_template_id_idx" ON "process_template_steps"("template_id");

-- CreateIndex
CREATE INDEX "process_templates_organization_id_idx" ON "process_templates"("organization_id");

-- CreateIndex
CREATE INDEX "process_templates_is_active_idx" ON "process_templates"("is_active");
