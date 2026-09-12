import "server-only";
import { z } from "zod";
import { tool } from "ai";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { getProjectRaci, getOwnershipGaps, ProjectNotFoundError } from "./raci-engine";
import { getProjectTimeline, type TimelineEntryType } from "./project-memory";
import { isMilestoneOverdue } from "./project-health";
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
export function createAgentTools(ctx: AgentToolContext) {
  const getProjectStatus = tool({
    description:
      "Get a project's current stage, health, owner/analyst/developer, expected delivery date, and any overdue milestones.",
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
      };
      if (!project || !isProjectParticipant(ctx, project)) {
        return notFound;
      }

      const overdueMilestones = project.milestones
        .filter((m) => isMilestoneOverdue(m))
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
      projectId: z.string().describe("The project's id."),
      message: z
        .string()
        .min(1)
        .describe("The update to send, in plain language, e.g. 'This project is paused pending budget approval.'"),
      audience: z
        .array(z.enum(AUDIENCE_VALUES))
        .min(1)
        .describe("Who to notify. Ask the user to clarify if they haven't said who."),
    }),
    execute: async ({ projectId, message, audience }) => {
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
    getProjectStatus,
    getProjectRaci: getProjectRaciTool,
    listOpenFlags,
    getProjectTimeline: getProjectTimelineTool,
    searchDocuments,
    notifyProjectStakeholders,
  };
}

export type AgentToolSet = ReturnType<typeof createAgentTools>;
