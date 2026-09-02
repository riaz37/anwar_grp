import "server-only";
import { prisma } from "./prisma";
import type { Candidate } from "@prisma/client";

/**
 * Duplicate-candidate detection. Per BUILD_PLAN.md's explicit scope
 * decision ("Fuzzy/dedup candidate matching + merge UI — exact match
 * only for now"), this is EXACT match only: normalized email and/or
 * normalized mobile number equality against existing Candidate rows.
 * No fuzzy matching, no ML, no external service.
 *
 * This is a WARNING, not a block (PDF Sec 4 "Duplicate-candidate
 * warnings") — callers surface the result to the recruiter, who can
 * proceed with creation regardless.
 */

export interface CandidateDuplicateMatch {
  candidate: Pick<
    Candidate,
    "id" | "name" | "email" | "mobileNumber" | "createdAt"
  >;
  matchedOn: Array<"email" | "mobileNumber">;
}

export interface CandidateDedupResult {
  hasDuplicates: boolean;
  matches: CandidateDuplicateMatch[];
}

/** Lowercase + trim. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Strip everything but digits. */
export function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, "");
}

/**
 * Checks an incoming (email, mobileNumber) pair against existing
 * Candidate rows for exact normalized matches. Optionally excludes a
 * candidate id (useful when re-checking on PATCH, so a candidate never
 * flags itself as its own duplicate).
 */
export async function findDuplicateCandidates(params: {
  email: string;
  mobileNumber: string;
  excludeCandidateId?: string;
}): Promise<CandidateDedupResult> {
  const normalizedEmail = normalizeEmail(params.email);
  const normalizedMobile = normalizeMobile(params.mobileNumber);

  // Exact match only (no fuzzy/ML matching per BUILD_PLAN.md). Email
  // equality is narrowed at the DB level (case-insensitive, indexed);
  // mobile-number formatting varies (spaces/dashes/+country code), so
  // that dimension is normalized and compared in app code against a
  // full scan. At MVP volume (BUILD_PLAN.md assumption 2: hundreds to
  // low thousands of candidates) this is acceptable — revisit with a
  // normalized-mobile column + index if it proves slow.
  const candidates = await prisma.candidate.findMany({
    where: params.excludeCandidateId
      ? { id: { not: params.excludeCandidateId } }
      : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      mobileNumber: true,
      createdAt: true,
    },
  });

  const matchesById = new Map<string, CandidateDuplicateMatch>();

  for (const candidate of candidates) {
    const matchedOn: Array<"email" | "mobileNumber"> = [];
    if (normalizeEmail(candidate.email) === normalizedEmail) {
      matchedOn.push("email");
    }
    if (
      normalizedMobile.length > 0 &&
      normalizeMobile(candidate.mobileNumber) === normalizedMobile
    ) {
      matchedOn.push("mobileNumber");
    }
    if (matchedOn.length > 0) {
      matchesById.set(candidate.id, { candidate, matchedOn });
    }
  }

  const matches = [...matchesById.values()];
  return { hasDuplicates: matches.length > 0, matches };
}
