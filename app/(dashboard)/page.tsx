import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectHealth } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hasProjectPermission } from "@/lib/project-authz";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/StatusPill";
import { HEALTH_LABELS, HEALTH_TONE } from "@/components/projects/projectTone";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [openTaskCount, openMilestoneCount, canSeeManagement] = await Promise.all([
    prisma.projectTask.count({ where: { ownerId: session.userId, status: { not: "DONE" } } }),
    prisma.milestone.count({ where: { ownerId: session.userId, status: { not: "DONE" } } }),
    Promise.resolve(hasProjectPermission(session.role, "VIEW_MANAGEMENT_DASHBOARD")),
  ]);

  const attentionProjects = canSeeManagement
    ? await prisma.project.findMany({
        where: { health: { in: [ProjectHealth.BLOCKED, ProjectHealth.DELAYED] } },
        select: { id: true, name: true, health: true },
        take: 5,
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return (
    <>
      <PageHeader
        title={`Welcome, ${session.name}`}
        description="Anwar AI ProjectFlow — where every AI and software initiative stands, who owns it, and what's next."
      />

      <div className="mt-lg grid grid-cols-1 gap-lg sm:grid-cols-2">
        <section className="rounded-md border border-border p-md">
          <h2 className="text-body font-semibold text-text">Your work</h2>
          <p className="mt-2xs text-body-sm text-muted">
            <span className="font-data tabular-nums text-text">{openTaskCount}</span> open task
            {openTaskCount === 1 ? "" : "s"},{" "}
            <span className="font-data tabular-nums text-text">{openMilestoneCount}</span> open
            milestone{openMilestoneCount === 1 ? "" : "s"}.
          </p>
          <div className="mt-md">
            <ButtonLink href="/my-work" variant="secondary">
              Go to My Work
            </ButtonLink>
          </div>
        </section>

        {canSeeManagement && (
          <section className="rounded-md border border-border p-md">
            <h2 className="text-body font-semibold text-text">Needs attention</h2>
            {attentionProjects.length === 0 ? (
              <p className="mt-2xs text-body-sm text-muted">Nothing blocked or delayed.</p>
            ) : (
              <ul className="mt-2xs flex flex-col gap-2xs">
                {attentionProjects.map((p) => (
                  <li key={p.id} className="flex items-center gap-sm text-body-sm">
                    <Pill tone={HEALTH_TONE[p.health]} label={HEALTH_LABELS[p.health]} />
                    <Link href={`/projects/${p.id}`} className="text-text hover:text-accent-ink">
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-md">
              <ButtonLink href="/dashboard" variant="secondary">
                Open Management Dashboard
              </ButtonLink>
            </div>
          </section>
        )}
      </div>

      <div className="mt-lg">
        <ButtonLink href="/projects" variant="ghost">
          View full portfolio →
        </ButtonLink>
      </div>
    </>
  );
}

