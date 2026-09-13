import "server-only";
import { z } from "zod";
import { tool } from "ai";
import type { Role, DependencyItemType } from "@prisma/client";
import { prisma } from "./prisma";
import { getProjectRaci, getOwnershipGaps, ProjectNotFoundError } from "./raci-engine";
import { getProjectTimeline, type TimelineEntryType } from "./project-memory";
import { isMilestoneOverdue, isMilestoneAtRisk } from "./project-health";
import { isProjectParticipant, getAccessibleProjectIds } from "./project-authz";
import { sendProjectNotificationEmail } from "./email";
import type { SessionPayload } from "./session";

export type AgentToolContext = SessionPayload;

export interface ProjectStatusResult {
  found: boolean;
  projectId: string;
  name: string | null;
  currentStage: string | null;
  health: string | null;
  ownerName: string | null;
  analystName: string | null;
  developerName: string | null;
  expectedDeliveryDate: string | null;
  overdueMilestones: Array<{ id: string; name: string; dueDate: string }>;
  atRiskMilestones: Array<{ id: string; name: string; dueDate: string }>;
}

/**
 * Group D's tool set per AGENTIC_DASHBOARD_PLAN.md "Group D". VIEW_AGENT_INSIGHTS
 * (checked once at the route level) only proves the caller may talk to the
 * assistant at all — it does not prove they may see any given project, so
 * every tool here re-applies the same `isProjectParticipant` scoping the
 * rest of the app uses for reads. Non-participants get `found: false` /
 * empty results (never a 403/404), matching the "don't invent, don't
 * leak" behavior the system prompt already expects from tool results.
 */
export interface AgentToolOptions {
  /**
   * The project id the caller is currently viewing (route's `body.projectId`),
   * when known. When set, notifyProjectStakeholders uses this instead of
   * trusting the model to retype the id on that call — otherwise a
   * mistyped/hallucinated id on one tool call (but not another) in the same
   * turn can make notifications silently fail for one audience while
   * succeeding for another, on what is actually the same project.
   */
  boundProjectId?: string;
}

export function createAgentTools(ctx: AgentToolContext, opts: AgentToolOptions = {}) {
  const listProjects = tool({
    description:
      "List projects the caller can see, with their id, name, current stage, and health. Call this first when the user refers to a project by name (or asks to list/browse projects) so you have its id for the other tools — none of them accept a project name directly.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe("Optional case-insensitive substring to filter project names by."),
    }),
    execute: async ({ query }) => {
      const accessible = await getAccessibleProjectIds(ctx);
      const projects = await prisma.project.findMany({
        where: {
          ...(accessible !== "ALL" ? { id: { in: accessible } } : {}),
          ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true, currentStage: true, health: true },
        orderBy: { name: "asc" },
        take: 50,
      });
      return {
        count: projects.length,
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          currentStage: p.currentStage,
          health: p.health,
        })),
      };
    },
  });

  const getProjectStatus = tool({
    description:
      "Get a project's current stage, health, owner/analyst/developer, expected delivery date, and any overdue or at-risk (due within 3 days) milestones. Health is computed from these milestones and any active blockers — check atRiskMilestones/overdueMilestones before telling the user a health status looks unexplained.",
    inputSchema: z.object({
      projectId: z.string().describe("The project's id."),
    }),
    execute: async ({ projectId }): Promise<ProjectStatusResult> => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          owner: true,
          analyst: true,
          developer: true,
          milestones: { where: { status: { not: "DONE" } } },
        },
      });
      const notFound = {
        found: false,
        projectId,
        name: null,
        currentStage: null,
        health: null,
        ownerName: null,
        analystName: null,
        developerName: null,
        expectedDeliveryDate: null,
        overdueMilestones: [],
        atRiskMilestones: [],
      };
      if (!project || !isProjectParticipant(ctx, project)) {
        return notFound;
      }

      const overdueMilestones = project.milestones
        .filter((m) => isMilestoneOverdue(m))
        .map((m) => ({ id: m.id, name: m.name, dueDate: m.dueDate.toISOString() }));
      const atRiskMilestones = project.milestones
        .filter((m) => isMilestoneAtRisk(m))
        .map((m) => ({ id: m.id, name: m.name, dueDate: m.dueDate.toISOString() }));

      return {
        found: true,
        projectId: project.id,
        name: project.name,
        currentStage: project.currentStage,
        health: project.health,
        ownerName: project.owner.name,
        analystName: project.analyst?.name ?? null,
        developerName: project.developer?.name ?? null,
        expectedDeliveryDate: project.expectedDeliveryDate.toISOString(),
        overdueMilestones,
        atRiskMilestones,
      };
    },
  });

  const getProjectRaciTool = tool({
    description:
      "Get a project's RACI grid (Accountable/Responsible/Consulted/Informed) and any ownership gaps flagged against it.",
    inputSchema: z.object({
      projectId: z.string().describe("The project's id."),
    }),
    execute: async ({ projectId }) => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true, analystId: true, developerId: true, departmentId: true },
      });
      if (!project || !isProjectParticipant(ctx, project)) {
        return { found: false, projectId, raci: null, ownershipGaps: [] };
      }
      try {
        const [raci, ownershipGaps] = await Promise.all([
          getProjectRaci(projectId),
          getOwnershipGaps(projectId),
        ]);
        return { found: true, projectId, raci, ownershipGaps };
      } catch (err) {
        if (err instanceof ProjectNotFoundError) {
          return { found: false, projectId, raci: null, ownershipGaps: [] };
        }
        throw err;
      }
    },
  });

  const listOpenFlags = tool({
    description:
      "List currently open agent-raised flags (stuck milestones, stuck blockers, high-severity risks, ownership gaps), optionally scoped to one project.",
    inputSchema: z.object({
      projectId: z.string().optional().describe("Optional project id to scope the flags to."),
    }),
    execute: async ({ projectId }) => {
      if (projectId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { ownerId: true, analystId: true, developerId: true, departmentId: true },
        });
        if (!project || !isProjectParticipant(ctx, project)) {
          return { count: 0, flags: [] };
        }
      }
      const accessible = projectId ? undefined : await getAccessibleProjectIds(ctx);
      const flags = await prisma.agentFlag.findMany({
        where: {
          resolvedAt: null,
          ...(projectId
            ? { projectId }
            : accessible !== "ALL"
              ? { projectId: { in: accessible } }
              : {}),
        },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { severity: "desc" },
        take: 50,
      });
      return {
        count: flags.length,
        flags: flags.map((flag) => ({
          id: flag.id,
          projectId: flag.projectId,
          projectName: flag.project.name,
          flagType: flag.flagType,
          subjectId: flag.subjectId,
          severity: flag.severity,
          narration: flag.narration,
          narrationSource: flag.narrationSource,
          firstFlaggedAt: flag.firstFlaggedAt.toISOString(),
        })),
      };
    },
  });

  const getProjectTimelineTool = tool({
    description:
      "Get a project's chronological event history (stage changes, delay reasons, blockers, scope changes, risks, agent flags), optionally filtered to specific event types.",
    inputSchema: z.object({
      projectId: z.string().describe("The project's id."),
      types: z
        .array(z.string())
        .optional()
        .describe(
          "Optional list of timeline entry types to filter to, e.g. STAGE_CHANGE, DELAY_REASON, BLOCKER_RAISED, RISK_RAISED.",
        ),
    }),
    execute: async ({ projectId, types }) => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true, analystId: true, developerId: true, departmentId: true },
      });
      if (!project || !isProjectParticipant(ctx, project)) {
        return { count: 0, entries: [] };
      }
      const entries = await getProjectTimeline(projectId, {
        types: types as TimelineEntryType[] | undefined,
      });
      return {
        count: entries.length,
        entries: entries.map((entry) => ({
          type: entry.type,
          timestamp: entry.timestamp.toISOString(),
          actorName: entry.actorName,
          summary: entry.summary,
        })),
      };
    },
  });

  const getProjectDependencies = tool({
    description:
      "Get a project's task/milestone dependency graph: which items block which. Use this to answer 'what's blocking X' or 'what does X depend on' questions.",
    inputSchema: z.object({
      projectId: z.string().describe("The project's id."),
    }),
    execute: async ({ projectId }) => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true, analystId: true, developerId: true, departmentId: true },
      });
      if (!project || !isProjectParticipant(ctx, project)) {
        return { count: 0, edges: [] };
      }

      const edges = await prisma.itemDependency.findMany({
        where: { projectId },
        select: { dependentType: true, dependentId: true, dependsOnType: true, dependsOnId: true },
      });
      if (edges.length === 0) {
        return { count: 0, edges: [] };
      }

      const idsByType = new Map<DependencyItemType, Set<string>>();
      for (const edge of edges) {
        for (const [type, id] of [
          [edge.dependentType, edge.dependentId],
          [edge.dependsOnType, edge.dependsOnId],
        ] as const) {
          const set = idsByType.get(type) ?? new Set<string>();
          set.add(id);
          idsByType.set(type, set);
        }
      }

      const [milestones, tasks] = await Promise.all([
        prisma.milestone.findMany({
          where: { id: { in: [...(idsByType.get("MILESTONE") ?? [])] } },
          select: { id: true, name: true, status: true },
        }),
        prisma.projectTask.findMany({
          where: { id: { in: [...(idsByType.get("TASK") ?? [])] } },
          select: { id: true, action: true, status: true },
        }),
      ]);
      const label = new Map<string, { name: string; status: string }>();
      for (const m of milestones) label.set(`MILESTONE:${m.id}`, { name: m.name, status: m.status });
      for (const t of tasks) label.set(`TASK:${t.id}`, { name: t.action, status: t.status });

      const describe = (type: DependencyItemType, id: string) =>
        label.get(`${type}:${id}`) ?? { name: "(unknown item)", status: "UNKNOWN" };

      return {
        count: edges.length,
        edges: edges.map((edge) => ({
          dependent: {
            type: edge.dependentType,
            id: edge.dependentId,
            ...describe(edge.dependentType, edge.dependentId),
          },
          dependsOn: {
            type: edge.dependsOnType,
            id: edge.dependsOnId,
            ...describe(edge.dependsOnType, edge.dependsOnId),
          },
        })),
      };
    },
  });

  const searchDocuments = tool({
    description:
      "Case-insensitive keyword search over document filenames and free-text notes (blocker descriptions, delay reason notes). NOTE: this is a plain text-contains search, not semantic/embedding search — it will miss paraphrases or synonyms of the query.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Keyword or phrase to search for."),
      projectId: z.string().optional().describe("Optional project id to scope the search to."),
    }),
    execute: async ({ query, projectId }) => {
      if (projectId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { ownerId: true, analystId: true, developerId: true, departmentId: true },
        });
        if (!project || !isProjectParticipant(ctx, project)) {
          return { count: 0, documents: [], blockers: [], delayReasons: [] };
        }
      }
      const accessible = projectId ? undefined : await getAccessibleProjectIds(ctx);
      const projectScope = projectId
        ? { projectId }
        : accessible !== "ALL"
          ? { projectId: { in: accessible } }
          : {};

      const [documents, blockers, delayReasons] = await Promise.all([
        prisma.document.findMany({
          where: {
            fileName: { contains: query, mode: "insensitive" },
            ...(projectId ? { ownerType: "PROJECT", ownerId: projectId } : {}),
          },
          take: 20,
          select: { id: true, fileName: true, ownerType: true, ownerId: true, createdAt: true },
        }),
        prisma.blocker.findMany({
          where: {
            description: { contains: query, mode: "insensitive" },
            ...projectScope,
          },
          take: 20,
          select: {
            id: true,
            projectId: true,
            description: true,
            createdAt: true,
            project: { select: { name: true } },
          },
        }),
        prisma.delayReason.findMany({
          where: {
            note: { contains: query, mode: "insensitive" },
            ...projectScope,
          },
          take: 20,
          select: {
            id: true,
            projectId: true,
            note: true,
            category: true,
            createdAt: true,
            project: { select: { name: true } },
          },
        }),
      ]);

      return {
        count: documents.length + blockers.length + delayReasons.length,
        documents: documents.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          ownerType: d.ownerType,
          ownerId: d.ownerId,
          createdAt: d.createdAt.toISOString(),
        })),
        blockers: blockers.map((b) => ({
          id: b.id,
          projectId: b.projectId,
          projectName: b.project.name,
          description: b.description,
          createdAt: b.createdAt.toISOString(),
        })),
        delayReasons: delayReasons.map((d) => ({
          id: d.id,
          projectId: d.projectId,
          projectName: d.project.name,
          category: d.category,
          note: d.note,
          createdAt: d.createdAt.toISOString(),
        })),
      };
    },
  });

  const AUDIENCE_VALUES = ["owner", "analyst", "developer", "team_lead", "management"] as const;
  const AUDIENCE_ROLE: Partial<Record<(typeof AUDIENCE_VALUES)[number], Role>> = {
    team_lead: "AI_TEAM_LEAD",
    management: "MANAGEMENT",
  };

  const notifyProjectStakeholders = tool({
    description:
      "Send an email notifying people connected to a project about an update (e.g. it's paused, blocked, or its status changed). Only call this when the user explicitly asks to notify, email, or alert someone — never proactively just because you have news to share. `audience` picks who receives it: 'owner'/'analyst'/'developer' are the project's assigned people, 'team_lead' is the relevant AI team lead, 'management' is the Management group.",
    inputSchema: z.object({
      projectId: z
        .string()
        .optional()
        .describe(
          "The project's id. Omit this if the user is currently viewing a specific project — it will be filled in automatically.",
        ),
      message: z
        .string()
        .min(1)
        .describe("The update to send, in plain language, e.g. 'This project is paused pending budget approval.'"),
      audience: z
        .array(z.enum(AUDIENCE_VALUES))
        .min(1)
        .describe("Who to notify. Ask the user to clarify if they haven't said who."),
    }),
    execute: async ({ projectId: modelProjectId, message, audience }) => {
      // Prefer the route-bound id (the project actually being viewed) over
      // whatever the model typed, so a mistyped/hallucinated id can't cause
      // this call to silently target a different project than a sibling
      // call in the same turn.
      const projectId = opts.boundProjectId ?? modelProjectId;
      if (!projectId) {
        return {
          sent: false,
          recipientCount: 0,
          recipients: [],
          reason: "No project specified.",
        };
      }
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { owner: true, analyst: true, developer: true },
      });
      if (!project || !isProjectParticipant(ctx, project)) {
        return { sent: false, recipientCount: 0, recipients: [], reason: "Project not found or not accessible." };
      }

      const candidates: Array<{ email: string; name: string }> = [];
      if (audience.includes("owner")) {
        candidates.push({ email: project.owner.email, name: project.owner.name });
      }
      if (audience.includes("analyst") && project.analyst) {
        candidates.push({ email: project.analyst.email, name: project.analyst.name });
      }
      if (audience.includes("developer") && project.developer) {
        candidates.push({ email: project.developer.email, name: project.developer.name });
      }

      const roleAudience = audience
        .map((a) => AUDIENCE_ROLE[a])
        .filter((role): role is Role => role !== undefined);
      if (roleAudience.length > 0) {
        const users = await prisma.user.findMany({
          where: {
            isActive: true,
            role: { in: roleAudience },
            OR: [
              { departmentId: project.departmentId },
              { businessUnitId: project.businessUnitId },
            ],
          },
          select: { email: true, name: true },
        });
        candidates.push(...users);
      }

      const recipients = Array.from(
        new Map(candidates.map((c) => [c.email, c])).values(),
      );

      if (recipients.length === 0) {
        return {
          sent: false,
          recipientCount: 0,
          recipients: [],
          reason: "No matching recipients found for the requested audience.",
        };
      }

      const sentCount = await sendProjectNotificationEmail({
        projectId: project.id,
        projectName: project.name,
        message,
        senderName: ctx.name,
        recipients,
      });

      return {
        sent: sentCount > 0,
        recipientCount: sentCount,
        recipients: recipients.map((r) => r.name),
      };
    },
  });

  return {
    listProjects,
    getProjectStatus,
    getProjectRaci: getProjectRaciTool,
    listOpenFlags,
    getProjectTimeline: getProjectTimelineTool,
    getProjectDependencies,
    searchDocuments,
    notifyProjectStakeholders,
  };
}

export type AgentToolSet = ReturnType<typeof createAgentTools>;
