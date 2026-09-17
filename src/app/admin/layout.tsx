import { getRole } from "@/lib/auth";
import AdminShell from "./admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Decides which tabs the header shows. Access itself is enforced by proxy.ts
  // and, for scanner sessions, by getRole() in the scanner page and route.
  const role = await getRole();

  return <AdminShell role={role}>{children}</AdminShell>;
}
