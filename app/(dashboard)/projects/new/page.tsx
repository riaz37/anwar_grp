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
        description="Register a new AI or software initiative. It starts at Idea; discovery, design, and delivery follow the gated stage pipeline."
        eyebrow="Portfolio / New record"
        backHref="/projects"
        backLabel="Back to portfolio"
      />

      {/* The form owns its own two-column split (fields + live rail), so the
          page only sets the outer measure. Wider than `max-w-form` on purpose:
          that cap is the modal width, and the rail lives outside the fields. */}
      <div className="mt-ds-9xl max-w-[64rem] pb-ds-9xl">
        <ProjectCreateForm
          businessUnits={businessUnits}
          departments={departments}
          users={users}
        />
      </div>
    </>
  );
}
