"use client";

import {
  BLOCKED_MESSAGE_FIELDS,
  MESSAGE_FIELD_GROUPS,
} from "@/lib/communications/field-allowlist";

/**
 * States, in the product itself, which fields a template can and cannot merge.
 *
 * Spec Sec 6: "Internal notes and rejection reasons must never appear
 * automatically in candidate messages." BUILD_PLAN.md Sec 2.8 makes that
 * structural — those fields are not on any allowlist, so no template can
 * reference them. Both of those are server-side facts; surfacing them here is
 * a deliberate UI decision, because a recruiter who does not know the rule
 * exists will assume the system is broken, go and paste the rejection reason
 * into WhatsApp by hand, and route around the whole thing (BUILD_PLAN.md
 * Sec 3.4, adoption risk).
 *
 * Collapsed by default: it is reference material, not a warning. The blocked
 * list is summarised in the always-visible summary line so the constraint is
 * legible without opening anything.
 */
export function FieldAvailabilityNote() {
  return (
    <details className="rounded-md border border-border bg-surface-sunken">
      <summary className="flex min-h-11 cursor-pointer list-item items-center px-md py-sm pl-xl text-body-sm text-text marker:text-muted">
        What a message can and cannot say
        <span className="ml-sm text-muted">
          — internal notes and rejection reasons are never merged in
        </span>
      </summary>

      <div className="border-t border-border px-md py-md">
        <h5 className="text-body-sm font-semibold text-text">
          Never available to any template
        </h5>
        <dl className="mt-sm flex flex-col gap-sm">
          {BLOCKED_MESSAGE_FIELDS.map((field) => (
            <div key={field.path}>
              <dt className="text-body-sm font-medium text-error-ink">
                {field.label}
                <span className="ml-sm font-mono text-caption font-normal text-muted">
                  {field.path}
                </span>
              </dt>
              <dd className="max-w-[62ch] text-body-sm text-muted">
                {field.reason}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-sm max-w-[62ch] text-body-sm text-muted">
          These are not filtered out at send time — they are absent from the
          list of fields a template is allowed to reference at all, so no
          template, present or future, can pull them into a candidate message.
          If a candidate should be told something from one of them, a person
          writes it themselves.
        </p>

        <h5 className="mt-lg text-body-sm font-semibold text-text">
          Available to templates
        </h5>
        <div className="mt-sm grid grid-cols-1 gap-md sm:grid-cols-2">
          {MESSAGE_FIELD_GROUPS.map((group) => (
            <div key={group.source}>
              <p className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
                {group.source}
              </p>
              <ul className="mt-xs flex flex-col gap-2xs">
                {group.fields.map((field) => (
                  <li key={field.path} className="text-body-sm text-text">
                    {field.label}
                    <span className="ml-sm font-mono text-caption text-muted">
                      {field.path}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
