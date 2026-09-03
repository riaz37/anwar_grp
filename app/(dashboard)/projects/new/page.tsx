import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hasProjectPermission } from "@/lib/project-authz";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectCreateForm } from "@/components/projects/ProjectCreateForm";

export const metadata: Metadata = { title: "Create project" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const session = await getSession();
  if (!session || !hasProjectPermission(session.role, "CREATE_PROJECT")) {
    redirect("/projects");
  }

  const [businessUnits, departments, users] = await Promise.all([
    prisma.businessUnit.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({
      select: { id: true, name: true, businessUnitId: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Create project"
        description="Register a new AI or software initiative. It starts at Idea — discovery, design, and delivery follow the gated stage pipeline."
        backHref="/projects"
        backLabel="Back to portfolio"
      />

      <div className="mt-lg max-w-[720px]">
        <ProjectCreateForm
          businessUnits={businessUnits}
          departments={departments}
          users={users}
        />
      </div>
    </>
  );
}
