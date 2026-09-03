import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hasProjectPermission } from "@/lib/project-authz";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { ProjectsTable, type ProjectRow } from "@/components/projects/ProjectsTable";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await getSession();

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      analyst: { select: { id: true, name: true } },
      developer: { select: { id: true, name: true } },
      businessUnit: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  const rows: ProjectRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    currentStage: p.currentStage,
    health: p.health,
    ownerName: p.owner.name,
    analystName: p.analyst?.name ?? null,
    developerName: p.developer?.name ?? null,
    businessUnitName: p.businessUnit.name,
    departmentName: p.department.name,
    expectedDeliveryDate: p.expectedDeliveryDate.toISOString(),
  }));

  const canCreate = session ? hasProjectPermission(session.role, "CREATE_PROJECT") : false;

  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Every AI and software initiative across Anwar Group — where it stands, who owns it, and when it ships."
        actions={
          canCreate ? (
            <ButtonLink href="/projects/new" variant="primary">
              <PlusIcon />
              Create project
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="mt-lg">
        <ProjectsTable projects={rows} />
      </div>
    </>
  );
}
