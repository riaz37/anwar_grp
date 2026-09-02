"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { findMockDuplicates } from "@/app/(dashboard)/_mock-candidates";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DocumentUpload } from "@/components/ui/DocumentUpload";
import { SelectField, TextInputField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import {
  CANDIDATE_SOURCES,
  CANDIDATE_SOURCE_LABELS,
  type DuplicateMatch,
  type PersonRef,
} from "@/lib/types/domain";

/**
 * New-candidate form — spec Sec 6 "Minimum details": name, mobile number,
 * email, CV, candidate source, position applied for, assigned recruiter.
 *
 * The duplicate warning is deliberately **non-blocking**: the same person
 * legitimately applies to more than one requisition (spec Sec 6), and a hard
 * block would push recruiters back into their spreadsheets. It surfaces the
 * match, links to it, and lets the recruiter carry on.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** BD mobile numbers, entered with or without spaces and country code. */
const MOBILE_PATTERN = /^\+?[\d\s-]{9,20}$/;

const DEDUP_DEBOUNCE_MS = 400;

type Errors = Partial<
  Record<
    "name" | "mobile" | "email" | "source" | "requisition" | "recruiter",
    string
  >
>;

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "submitted" }
  | { phase: "error"; message: string };

export interface RequisitionOption {
  id: string;
  ref: string;
  position: string;
  /** The requisition's own recruiter, used to pre-fill the assignment. */
  recruiterId: string;
}

export function CandidateForm({
  requisitions,
  recruiters,
}: {
  /** Open requisitions the candidate can be applied to. */
  requisitions: readonly RequisitionOption[];
  recruiters: readonly PersonRef[];
}) {
  const prefix = useId();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [requisitionId, setRequisitionId] = useState("");
  const [recruiterId, setRecruiterId] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<Errors>({});
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
  const [state, setState] = useState<SubmitState>({ phase: "idle" });

  const submitting = state.phase === "submitting";

  /* ────────────────────────────────────────────────────────────────────────
   * Duplicate check
   *
   * TODO(backend): there is no *pre-submit* dedup endpoint yet. `lib/
   * candidate-dedup.ts` and `findDuplicateCandidates()` exist, but they are
   * only reachable through `POST /api/v1/candidates`, which returns matches in
   * `meta.duplicateWarning` *after* the record is already created. Warning the
   * recruiter while they type is the point (spec Sec 4), so this needs:
   *
   *   GET /api/v1/candidates/dedup-check?email=…&mobileNumber=…
   *     -> { matches: [{ candidate, matchedOn }] }
   *
   * TODO(frontend): once that exists, swap `findMockDuplicates(...)` for the
   * fetch and map its `matches` onto `DuplicateMatch[]`. Keep the debounce and
   * the `ignore` guard — they stop an in-flight check from overwriting a newer
   * one — and pass an `AbortSignal` through `postJson`/`getJson`.
   *
   * Belt and braces: also read `meta.duplicateWarning` off the create response
   * in `handleSubmit` and render the same banner, in case a duplicate was
   * created between the check and the submit.
   * ──────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const trimmedEmail = email.trim();
    const trimmedMobile = mobile.trim();

    let ignore = false;
    // Everything — including clearing a stale result — happens after the
    // debounce, never synchronously in the effect body.
    const timer = setTimeout(() => {
      const matches =
        trimmedEmail || trimmedMobile
          ? findMockDuplicates({ email: trimmedEmail, mobile: trimmedMobile })
          : [];
      if (ignore) return;
      setDuplicates(matches);
      if (matches.length > 0) setDuplicatesDismissed(false);
    }, DEDUP_DEBOUNCE_MS);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [email, mobile]);

  function validate(): Errors {
    const found: Errors = {};
    if (!name.trim()) found.name = "Enter the candidate’s full name.";
    if (!mobile.trim()) found.mobile = "Enter a mobile number.";
    else if (!MOBILE_PATTERN.test(mobile.trim())) {
      found.mobile =
        "That doesn’t look like a mobile number — digits only, optionally with a country code.";
    }
    if (!email.trim()) found.email = "Enter an email address.";
    else if (!EMAIL_PATTERN.test(email.trim())) {
      found.email = "That doesn’t look like an email address — check for typos.";
    }
    if (!source) found.source = "Record where this candidate came from.";
    if (!requisitionId) {
      found.requisition = "Choose the requisition they are applying to.";
    }
    if (!recruiterId) {
      found.recruiter =
        "Every application needs one assigned recruiter — choose who owns this one.";
    }
    return found;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const firstKey = Object.keys(found)[0];
      document.getElementById(`${prefix}-${firstKey}`)?.focus();
      return;
    }

    setState({ phase: "submitting" });

    /* ──────────────────────────────────────────────────────────────────────
     * SWAP POINT — candidate + application create
     *
     * `POST /api/v1/candidates` and
     * `POST /api/v1/candidates/{id}/applications` both exist already.
     *
     * TODO(frontend): replace this no-op with:
     *
     *   const candidate = await postJson("/api/v1/candidates", {
     *     name, mobileNumber: mobile, email,
     *     candidateSource: source, cvDocumentId,   // note the field names
     *   });
     *   await postJson(`/api/v1/candidates/${candidate.id}/applications`, {
     *     requisitionId, assignedRecruiterId: recruiterId,
     *   });
     *   router.push(`/candidates/${candidate.id}`);
     *
     * Blocked on one gap: `cvDocumentId` has to be the id of an existing
     * `Document` row, and no route creates one — see the TODO(backend) block
     * at the bottom of `components/ui/DocumentUpload.tsx`. Until that lands,
     * the CV can be presigned and PUT but not linked, which is why it is held
     * in `cvFile` here rather than uploaded on selection (a presigned key also
     * needs a real ownerId, which only exists after the POST).
     * ────────────────────────────────────────────────────────────────────── */
    await new Promise((resolve) => setTimeout(resolve, 400));
    setState({ phase: "submitted" });
  }

  const showDuplicates = duplicates.length > 0 && !duplicatesDismissed;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-lg">
      <LiveRegion>
        {showDuplicates && (
          <InlineBanner
            tone="warning"
            title={
              duplicates.length === 1
                ? "This person may already be on file"
                : `${duplicates.length} existing candidates match these details`
            }
            onDismiss={() => setDuplicatesDismissed(true)}
            dismissLabel="Dismiss the duplicate warning"
          >
            <p>
              You can still save — the same person often applies to more than
              one requisition. If it is the same person, open their profile and
              add an application there instead, so both applications stay under
              one record.
            </p>
            <ul className="mt-sm flex flex-col gap-xs">
              {duplicates.map((match) => (
                <li key={match.candidateId}>
                  <Link href={`/candidates/${match.candidateId}`} className="link">
                    {match.name}
                  </Link>{" "}
                  — matched on {match.matchedOn.join(" and ")};{" "}
                  <span className="font-data tabular-nums">
                    {match.applicationCount}
                  </span>{" "}
                  application
                  {match.applicationCount === 1 ? "" : "s"} on file
                </li>
              ))}
            </ul>
          </InlineBanner>
        )}

        {state.phase === "submitted" && (
          <InlineBanner
            tone="info"
            title="Not saved — the candidate API isn’t wired up yet"
            onDismiss={() => setState({ phase: "idle" })}
          >
            The form validated and would have posted to{" "}
            <code className="font-mono text-caption">
              POST /api/v1/candidates
            </code>
            . See the SWAP POINT comment in{" "}
            <code className="font-mono text-caption">
              components/candidates/CandidateForm.tsx
            </code>
            .
          </InlineBanner>
        )}

        {state.phase === "error" && (
          <InlineBanner
            tone="error"
            title="That candidate wasn’t saved"
            onDismiss={() => setState({ phase: "idle" })}
          >
            {state.message}
          </InlineBanner>
        )}
      </LiveRegion>

      <fieldset className="flex flex-col gap-md border-0 p-0">
        <legend className="mb-sm text-subhead text-text">Person</legend>

        <TextInputField
          id={`${prefix}-name`}
          label="Full name"
          required
          disabled={submitting}
          value={name}
          onChange={setName}
          error={errors.name}
          autoComplete="name"
        />

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <TextInputField
            id={`${prefix}-mobile`}
            label="Mobile number"
            type="tel"
            inputMode="tel"
            required
            disabled={submitting}
            value={mobile}
            onChange={setMobile}
            error={errors.mobile}
            hint="Used for WhatsApp and calls."
          />
          <TextInputField
            id={`${prefix}-email`}
            label="Email"
            type="email"
            inputMode="email"
            required
            disabled={submitting}
            value={email}
            onChange={setEmail}
            error={errors.email}
            hint="Checked against existing candidates as you type."
          />
        </div>

        <SelectField
          id={`${prefix}-source`}
          label="Candidate source"
          required
          disabled={submitting}
          value={source}
          onChange={setSource}
          error={errors.source}
          options={CANDIDATE_SOURCES.map((value) => ({
            value,
            label: CANDIDATE_SOURCE_LABELS[value],
          }))}
        />

        <DocumentUpload
          ownerType="CANDIDATE"
          ownerId={null}
          label="CV"
          hint="Attached to the profile when you save."
          onFileStaged={setCvFile}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-md border-0 p-0">
        <legend className="mb-sm text-subhead text-text">
          First application
        </legend>

        <SelectField
          id={`${prefix}-requisition`}
          label="Position applied for"
          required
          disabled={submitting}
          value={requisitionId}
          onChange={(value) => {
            setRequisitionId(value);
            // Default the recruiter to the requisition's, which is right most
            // of the time — still editable.
            const match = requisitions.find((option) => option.id === value);
            if (match && !recruiterId) setRecruiterId(match.recruiterId);
          }}
          error={errors.requisition}
          hint="Only requisitions currently open for sourcing are listed."
          options={requisitions.map((requisition) => ({
            value: requisition.id,
            label: `${requisition.ref} — ${requisition.position}`,
          }))}
        />

        <SelectField
          id={`${prefix}-recruiter`}
          label="Assigned recruiter"
          required
          disabled={submitting}
          value={recruiterId}
          onChange={setRecruiterId}
          error={errors.recruiter}
          hint="Exactly one recruiter owns each application."
          options={recruiters.map((recruiter) => ({
            value: recruiter.id,
            label: recruiter.name,
          }))}
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-md border-t border-border pt-lg">
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? "Saving…" : "Save candidate"}
        </Button>
        <ButtonLink href="/candidates" variant="ghost">
          Cancel
        </ButtonLink>
        {cvFile && (
          <span className="text-body-sm text-muted">
            CV “{cvFile.name}” will upload with this record.
          </span>
        )}
      </div>
    </form>
  );
}
