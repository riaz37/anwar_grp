import type { CSSProperties } from "react";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hasProjectPermission } from "@/lib/project-authz";
import { PORTFOLIO_WIDE_ROLES } from "@/lib/project-permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { todayIsoDate } from "@/lib/format";
import { PortfolioBrowser } from "@/components/dashboard/projects-list/PortfolioBrowser";
import { PortfolioEmpty } from "@/components/dashboard/projects-list/PortfolioEmpty";
import type { ProjectListItem } from "@/components/dashboard/projects-list/types";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

/** Health states that mean somebody has to do something this week. */
const ATTENTION_HEALTH = new Set(["DELAYED", "BLOCKED", "AT_RISK"]);

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Scoped to participants unless the role is portfolio-wide — mirrors
  // GET /api/v1/projects (assignment Sec 9: "Developer: View assigned
  // projects" vs. AI_TEAM_LEAD/MANAGEMENT "View all projects").
  const where: Prisma.ProjectWhereInput = PORTFOLIO_WIDE_ROLES.has(session.role)
    ? {}
    : {
        OR: [
          { ownerId: session.userId },
          { analystId: session.userId },
          { developerId: session.userId },
          ...(session.role === "BUSINESS_OWNER" && session.departmentId
            ? [{ departmentId: session.departmentId }]
            : []),
        ],
      };

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      analyst: { select: { id: true, name: true } },
      developer: { select: { id: true, name: true } },
      businessUnit: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  const rows: ProjectListItem[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    currentStage: project.currentStage,
    health: project.health,
    ownerName: project.owner.name,
    analystName: project.analyst?.name ?? null,
    developerName: project.developer?.name ?? null,
    businessUnitName: project.businessUnit.name,
    departmentName: project.department.name,
    /* Date-only: the schedule is a calendar fact, and trimming the time
       component keeps server and client comparisons identical. */
    expectedDeliveryDate: project.expectedDeliveryDate.toISOString().slice(0, 10),
  }));

  const canCreate = session
    ? hasProjectPermission(session.role, "CREATE_PROJECT")
    : false;

  const needsAttention = rows.filter((row) =>
    ATTENTION_HEALTH.has(row.health),
  ).length;

  return (
    <>
      <div className="rise-in" style={{ "--i": 0 } as CSSProperties}>
        <PageHeader
          title="Portfolio"
          description="Every AI and software initiative across Anwar Group: where it stands in the pipeline, who is accountable, and when it ships."
          meta={
            rows.length > 0 ? (
              <p className="text-caption-2 text-text-low">
                <span className="font-data tabular-nums text-text-high">
                  {rows.length}
                </span>
                {rows.length === 1 ? " project" : " projects"}
                {needsAttention > 0 && (
                  <>
                    <span aria-hidden className="mx-ds-sm text-outline-high">
                      /
                    </span>
                    <span className="font-data tabular-nums text-warn-high">
                      {needsAttention}
                    </span>{" "}
                    <span className="text-warn-high">need attention</span>
                  </>
                )}
              </p>
            ) : undefined
          }
          actions={
            canCreate ? (
              <ButtonLink href="/projects/new" variant="primary">
                <PlusIcon />
                Create project
              </ButtonLink>
            ) : undefined
          }
        />
      </div>

      <div className="mt-ds-7xl rise-in" style={{ "--i": 1 } as CSSProperties}>
        {rows.length === 0 ? (
          <PortfolioEmpty canCreate={canCreate} />
        ) : (
          <PortfolioBrowser projects={rows} todayIso={todayIsoDate()} />
        )}
      </div>
    </>
  );
}
