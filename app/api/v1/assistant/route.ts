import { streamText, convertToModelMessages, stepCountIs, generateId, type UIMessage } from "ai";
import { z } from "zod";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { fail, handleRouteError } from "@/lib/api-response";
import { llmModel } from "@/lib/llm-client";
import { createAgentTools } from "@/lib/agent-tools";
import {
  getConversationOwnedBy,
  persistAssistantMessage,
  persistUserMessage,
} from "@/lib/chat";

const requestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()),
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
});

export const BASE_SYSTEM_PROMPT = `You are the PMO agentic assistant for this project portfolio.
Answer ONLY using the results returned by your tools — never invent status, dates, names, or numbers.
If a tool call returns nothing relevant to the question, say plainly that you don't know or that
no matching data was found, rather than guessing or filling in a plausible-sounding answer.
When asked about a specific project, prefer calling getProjectStatus, getProjectRaci, and
getProjectTimeline for that project's id before answering. Use listOpenFlags for "what's flagged"
or "what needs attention" questions. Use searchDocuments for free-text lookups, and note to the
user when it is a keyword match rather than a semantic match if that distinction matters to their
question.

Use notifyProjectStakeholders only when the user explicitly asks you to notify, email, or alert
someone about a project — never send a notification on your own initiative. If they don't say who
should receive it, ask before calling the tool rather than guessing an audience. After it runs,
tell the user plainly who was actually notified (or why nobody was, e.g. no matching recipients).

Formatting: your response is rendered as Markdown (GitHub-flavored, tables included), for a
management audience scanning on a screen, not reading prose. Default to structure over paragraphs:
- Comparing two or more projects/rows of the same shape (status, milestones, owners) → use a
  Markdown table, not a paragraph per project.
- A single project's detail → short bulleted fields (**Status:**, **Owner:**, **Due:**), not a
  run-on sentence.
- A flat list of items (blockers, flags, names) → a bullet or numbered list.
- Reserve full sentences for the actual analysis/recommendation, not for restating field values.
- Never invent a table column or row the tools didn't return data for.
- Every tool result that includes a project's id lets you link straight to that project's page:
  write the project's name as a Markdown link to /projects/{projectId} (e.g.
  [Steel Quality Defect Classifier](/projects/cm123abc)) the first time you name it in an answer,
  so the reader can open it directly instead of searching for it. Use the exact id the tool
  returned — never guess or shorten it.`;

/** Exported for test/eval reuse — see the stopWhen comment below for why this exists. */
export const ASSISTANT_MAX_STEPS = 5;

/**
 * Streaming Q&A endpoint (AGENTIC_DASHBOARD_PLAN.md "Group D"). Gated by
 * VIEW_AGENT_INSIGHTS, which only proves the caller may talk to the
 * assistant at all — the full session is passed into createAgentTools so
 * each tool call re-applies `isProjectParticipant` scoping per project,
 * the same as the rest of the app's reads. `projectId`, when present,
 * also seeds the system prompt so the assistant scopes its answers to
 * that project (the per-project drill-down variant).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "VIEW_AGENT_INSIGHTS");

    const body = requestSchema.parse(await request.json());

    // Ownership check happens before any persistence or model call — a
    // conversationId the caller doesn't own must 404 the same as one that
    // doesn't exist, rather than silently scoping the reply to someone
    // else's history.
    if (body.conversationId) {
      const conversation = await getConversationOwnedBy(body.conversationId, user.userId);
      if (!conversation) {
        return fail("NOT_FOUND", "Conversation not found.", 404);
      }
      const lastMessage = body.messages[body.messages.length - 1];
      if (lastMessage?.role === "user") {
        await persistUserMessage(body.conversationId, lastMessage);
      }
    }

    const identityLine = `You are speaking with ${user.name} (role: ${user.role}). Answer as their assistant — tailor tone and detail to that role (e.g. a developer likely wants task/blocker detail, while MANAGEMENT/AI_TEAM_LEAD likely want portfolio-level summaries). You do not need to ask who they are or which projects they can see: every tool call below is already scoped to what this person is permitted to view, so an empty or "not found" tool result means they don't have access or it doesn't exist — tell them that plainly rather than asking them to check their permissions.`;
    const system = body.projectId
      ? `${BASE_SYSTEM_PROMPT}\n\n${identityLine}\n\nThe user is currently viewing project id "${body.projectId}" — scope your answers to this project unless they explicitly ask about the wider portfolio.`
      : `${BASE_SYSTEM_PROMPT}\n\n${identityLine}`;

    const tools = createAgentTools(user);

    const result = streamText({
      model: llmModel,
      system,
      messages: convertToModelMessages(body.messages),
      tools,
      // Without this, the AI SDK v5 default (stopWhen: stepCountIs(1))
      // stops the run the instant the model emits a tool call, so the
      // model never gets a follow-up turn to read the tool result and
      // write an actual answer — confirmed via test/eval: finishReason
      // "tool-calls", text "". Every real question in this system prompt
      // requires at least one tool call, so without this the assistant
      // was returning empty responses for nearly all questions. 5 steps
      // covers a multi-tool question (e.g. status + RACI + timeline)
      // plus one final answer turn.
      stopWhen: stepCountIs(ASSISTANT_MAX_STEPS),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: body.messages,
      // Without this, the SDK leaves responseMessage.id as an empty string
      // (per its own docs: "If not provided, no message ID will be set").
      // persistAssistantMessage upserts by id, so every assistant turn across
      // every conversation was colliding on the same "" row — each new
      // reply silently overwrote the last one's row instead of creating its
      // own, leaving every conversation but one assistant-less on reload.
      generateMessageId: generateId,
      onFinish: body.conversationId
        ? async ({ responseMessage }) => {
            await persistAssistantMessage(body.conversationId!, responseMessage);
          }
        : undefined,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
