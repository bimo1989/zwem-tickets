import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import ScanLoginForm from "./scan-login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tickets scannen",
};

// Short, shareable URL to hand to volunteers: /scan. Anyone already signed in
// skips straight to the camera.
export default async function ScanLoginPage() {
  if (await getRole()) redirect("/admin/scan");

  return <ScanLoginForm />;
}
