import type { Access } from "./access";
import { readWorkspace } from "@/lib/workspace/store";

const fixtureWarehouse = "PILOT-01";

export function supplierWarehouse(access: Access): string | null {
  if (access.role !== "supplier" || !access.email) return null;
  const application = readWorkspace().applications.find(
    (item) => item.role === "supplier" && item.status === "approved" && item.email === access.email,
  );
  if (application?.warehouseCode) return application.warehouseCode;
  if (access.userId === "dev-supplier") return fixtureWarehouse;
  return null;
}

export function supplierOwnsWarehouse(access: Access, warehouseCode: string | null | undefined): boolean {
  const warehouse = supplierWarehouse(access);
  return warehouse !== null && warehouseCode === warehouse;
}
