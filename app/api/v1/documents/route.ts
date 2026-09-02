import { NextRequest } from "next/server";
import { z } from "zod";
import { DocumentOwnerType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, handleRouteError } from "@/lib/api-response";

const createDocumentSchema = z.object({
  ownerType: z.nativeEnum(DocumentOwnerType),
  ownerId: z.string().min(1),
  storageKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

/**
 * Creates the Document row once the client has confirmed the presigned
 * PUT (from POST /api/v1/documents/presign-upload) actually landed the
 * file — lib/documents.ts's presignUpload() deliberately does not touch
 * the DB itself (see its doc comment), this route is that missing
 * write. Does not re-validate the file against the object store; the
 * allowlist/size check already happened at presign time.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = createDocumentSchema.parse(await req.json());

    const document = await prisma.document.create({
      data: {
        ownerType: body.ownerType,
        ownerId: body.ownerId,
        storageKey: body.storageKey,
        fileName: body.fileName,
        contentType: body.contentType,
        sizeBytes: body.sizeBytes,
        uploadedById: user.userId,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "DOCUMENT_CREATE",
      entityType: "Document",
      entityId: document.id,
      metadata: { ownerType: document.ownerType, ownerId: document.ownerId },
    });

    return ok(document, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
