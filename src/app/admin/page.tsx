import { redirect } from "next/navigation";
import { canFollowUpOrders, getRole } from "@/lib/auth";
import OrdersView from "./orders-view";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  // proxy.ts can only see that a volunteer cookie exists; this is where a
  // scan-only code is actually turned away from the ticket overview.
  const role = await getRole();
  if (!role) redirect("/admin/login");
  if (!canFollowUpOrders(role)) redirect("/admin/scan");

  return <OrdersView />;
}
