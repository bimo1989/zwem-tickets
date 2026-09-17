import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import Scanner from "./scanner";

export const dynamic = "force-dynamic";

export default async function AdminScanPage() {
  // proxy.ts only sees that a scanner cookie exists; this is where the code in
  // it is actually checked against the database.
  const role = await getRole();
  if (!role) redirect("/admin/login");

  return <Scanner />;
}
