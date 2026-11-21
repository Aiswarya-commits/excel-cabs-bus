import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { AdminShell } from "./AdminShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff dashboard", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  return <AdminShell actor={actor}>{children}</AdminShell>;
}
