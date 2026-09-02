import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { ShellUser } from "@/components/shell/types";

function formatRole(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

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
    role: formatRole(session.role),
    department: department?.name ?? "—",
  };

  return <AppShell user={user}>{children}</AppShell>;
}
