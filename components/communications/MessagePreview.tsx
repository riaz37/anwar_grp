"use client";

import {
  MESSAGE_FIELDS,
  type RenderResult,
} from "@/lib/communications/field-allowlist";

/**
 * Renders a template against the current application context, showing exactly
 * what the candidate will receive — and, just as importantly, what they will
 * not.
 *
 * Three kinds of placeholder are drawn differently on purpose:
 *   resolved  plain text, indistinguishable from the rest of the message,
 *             because that is how it will arrive
 *   missing   marked and named, so a blank "Where:" line is caught here rather
 *             than by the candidate
 *   blocked   marked in error tone; a template containing one is a bug, and
 *             the field is never interpolated in any environment
 */

function fieldLabel(path: string): string {
  return MESSAGE_FIELDS.find((field) => field.path === path)?.label ?? path;
}

export function MessagePreview({
  subject,
  render,
  channel,
  recipient,
}: {
  subject: RenderResult | null;
  render: RenderResult;
  channel: string;
  recipient: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-sm border-b border-border px-md py-sm">
        <p className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
          Preview — {channel}
        </p>
        <p className="font-data text-caption tabular-nums text-muted">
          to {recipient || "no recipient set"}
        </p>
      </div>

      {subject && (
        <p className="border-b border-border px-md py-sm text-body-sm font-semibold text-text">
          <Segments render={subject} />
        </p>
      )}

      <p className="whitespace-pre-wrap px-md py-md text-body-sm leading-relaxed text-text">
        <Segments render={render} />
      </p>

      {(render.missingPaths.length > 0 || render.blockedPaths.length > 0) && (
        <div className="border-t border-border px-md py-sm">
          {render.missingPaths.length > 0 && (
            <p className="text-body-sm text-warning-ink">
              <span className="font-semibold">
                {render.missingPaths.length} field
                {render.missingPaths.length === 1 ? "" : "s"} still empty:
              </span>{" "}
              {render.missingPaths.map(fieldLabel).join(", ")}. Fill{" "}
              {render.missingPaths.length === 1 ? "it" : "them"} in before
              sending, or the candidate gets a gap.
            </p>
          )}
          {render.blockedPaths.length > 0 && (
            <p className="mt-sm text-body-sm text-error-ink">
              <span className="font-semibold">
                This template references a field outside the allowlist:
              </span>{" "}
              {render.blockedPaths.join(", ")}. It will never be filled in.
              Report the template to your administrator.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Segments({ render }: { render: RenderResult }) {
  return (
    <>
      {render.segments.map((segment, index) => {
        switch (segment.kind) {
          case "text":
          case "value":
            return <span key={index}>{segment.text}</span>;
          case "missing":
            return (
              <mark
                key={index}
                className="rounded-sm bg-warning-soft px-xs font-medium text-warning-ink"
              >
                [{fieldLabel(segment.path)} — not set]
              </mark>
            );
          case "blocked":
            return (
              <mark
                key={index}
                className="rounded-sm bg-error-soft px-xs font-medium text-error-ink line-through"
              >
                [{segment.path} — not allowed]
              </mark>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
