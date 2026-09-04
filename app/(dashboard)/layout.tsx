import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasProjectPermission } from "@/lib/project-authz";
import { roleLabel } from "@/components/projects/projectTone";
import type { ShellUser } from "@/components/shell/types";

/**
 * Authenticated shell. Every `(dashboard)` route is behind this redirect, so
 * pages below may treat `getSession()` as non-null and use `notFound()` for
 * missing records rather than re-implementing the auth bounce.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const department = session.departmentId
    ? await prisma.department.findUnique({
        where: { id: session.departmentId },
        select: { name: true },
      })
    : null;

  const user: ShellUser = {
    name: session.name,
    role: roleLabel(session.role),
    department: department?.name ?? "Not set",
    canViewManagementDashboard: hasProjectPermission(
      session.role,
      "VIEW_MANAGEMENT_DASHBOARD",
    ),
  };

  return <AppShell user={user}>{children}</AppShell>;
}
