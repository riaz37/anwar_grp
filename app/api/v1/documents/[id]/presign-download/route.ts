import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { presignDownload, isAuthorizedForDocumentOwner } from "@/lib/documents";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

/**
 * GET /api/v1/documents/:id/presign-download
 *
 * Authz: requires a logged-in user AND passes the owning entity's
 * pluggable authorization check (lib/documents.ts:isAuthorizedForDocumentOwner)
 * before ever issuing a presigned GET — per PROJECT_PLAN.md Sec 2.6.
 * Since no owning module has registered a checker yet in Phase 1, this
 * currently fails closed (denies) for every ownerType until a later
 * module registers one.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      return fail("NOT_FOUND", "Document not found.", 404);
    }

    const authorized = await isAuthorizedForDocumentOwner({
      user,
      ownerType: document.ownerType,
      ownerId: document.ownerId,
    });

    if (!authorized) {
      return fail(
        "FORBIDDEN",
        "You are not authorized to download this document.",
        403,
      );
    }

    const result = await presignDownload(document.storageKey);

    await writeAudit({
      actorId: user.userId,
      action: "DOCUMENT_PRESIGN_DOWNLOAD",
      entityType: document.ownerType,
      entityId: document.ownerId,
      metadata: { documentId: document.id, storageKey: document.storageKey },
    });

    return ok(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
