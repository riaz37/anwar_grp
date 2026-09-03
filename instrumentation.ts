/**
 * Next.js instrumentation hook — runs once per server process at boot,
 * before any request is handled. Registers the Project domain's
 * document-download authorization checker (lib/documents.ts fails
 * closed for any DocumentOwnerType with no checker registered).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerDocumentDownloadAuthzChecker } = await import(
      "./lib/documents"
    );
    const { prisma } = await import("./lib/prisma");
    const { isProjectParticipant } = await import("./lib/project-authz");

    registerDocumentDownloadAuthzChecker("PROJECT", async ({ user, ownerId }) => {
      if (user.role === "AI_TEAM_LEAD" || user.role === "MANAGEMENT") return true;
      const project = await prisma.project.findUnique({
        where: { id: ownerId },
        select: {
          ownerId: true,
          analystId: true,
          developerId: true,
          departmentId: true,
        },
      });
      if (!project) return false;
      return isProjectParticipant(user, project);
    });
  }
}
