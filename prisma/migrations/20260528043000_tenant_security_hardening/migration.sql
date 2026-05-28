-- Allow order codes to be reused safely across different workspaces.
DROP INDEX IF EXISTS "orders_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "orders_organization_id_code_key" ON "orders"("organization_id", "code");

-- Part codes are resolved through the owning order/workspace relation. Keeping a global
-- unique constraint would prevent two companies from using the same shop-floor code.
DROP INDEX IF EXISTS "parts_code_key";
CREATE INDEX IF NOT EXISTS "parts_code_idx" ON "parts"("code");
