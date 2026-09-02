/**
 * Next.js instrumentation hook — runs once per server process at boot,
 * before any request is handled. Used here to wire up module-owned
 * registrations that must exist before routes execute, e.g. Phase 2's
 * document-download authz checkers (lib/phase2-document-authz.ts),
 * since lib/documents.ts fails closed for any DocumentOwnerType with no
 * checker registered.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerPhase2DocumentAuthzCheckers } = await import(
      "./lib/phase2-document-authz"
    );
    registerPhase2DocumentAuthzCheckers();
  }
}
