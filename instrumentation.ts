/**
 * Next.js instrumentation hook — runs once per server process at boot,
 * before any request is handled. Currently a no-op: document-download
 * authorization for `DocumentOwnerType.PROJECT` is inlined directly in
 * `lib/documents.ts` (see that file's doc comment) rather than
 * registered here at boot — a boot-time registry proved unreliable
 * under Next's dev-mode module isolation (found and fixed by /qa,
 * 2026-09-03: the registry `instrumentation.ts` populated and the one
 * a route handler read from were different module instances, so every
 * download was silently denied).
 */
export async function register() {
  // Intentionally empty.
}
