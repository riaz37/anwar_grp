"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  SelectField,
  TextInputField,
  type SelectOption,
} from "@/components/ui/Field";
import { PlusIcon } from "@/components/ui/icons";
import type { NewJoiningItemInput } from "@/lib/types/joining";

/**
 * Adding a one-off checklist item. Three fields, inline, no dialog.
 *
 * The spec's thirteen items cover the common case and are seeded in one click
 * (see `JoiningSection`'s empty state), so this form is for the exceptions —
 * "Factory gate pass", "Uniform issue", "Safety induction for the plant". A
 * modal for three fields on a tab that is otherwise a checklist would be more
 * ceremony than the thing being created.
 *
 * It starts collapsed behind an "Add an item" button so a full checklist reads
 * as a checklist rather than as a form with a list above it.
 */

export function AddJoiningItemForm({
  owners,
  defaultOwnerId,
  defaultDueDate,
  busy,
  onAdd,
}: {
  /** Everyone who can own an item, grouped by function in the picker. */
  owners: readonly { id: string; name: string; role: string }[];
  defaultOwnerId: string;
  /** `YYYY-MM-DD` — the target joining date, or today when there is none. */
  defaultDueDate: string;
  busy: boolean;
  onAdd: (input: NewJoiningItemInput) => Promise<void>;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [error, setError] = useState<string | null>(null);

  const ownerOptions: readonly SelectOption[] = owners.map((person) => ({
    value: person.id,
    label: `${person.name} — ${person.role}`,
  }));

  function reset() {
    setLabel("");
    setOwnerId(defaultOwnerId);
    setDueDate(defaultDueDate);
    setError(null);
  }

  async function submit() {
    if (label.trim().length === 0) {
      setError("Give the item a label — what has to happen.");
      return;
    }
    if (!dueDate) {
      setError("Give the item a due date.");
      return;
    }
    setError(null);
    await onAdd({ label, ownerId, dueDate });
    // Kept open with the fields cleared: adding one item usually means adding
    // two or three, and a form that closes on every save costs a click each
    // time.
    setLabel("");
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <PlusIcon />
        Add an item
      </Button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      aria-labelledby={`${formId}-heading`}
      className="flex max-w-[var(--container-form)] flex-col gap-md rounded-md border border-border bg-surface-sunken px-md py-md lg:px-lg lg:py-lg"
    >
      <h4 id={`${formId}-heading`} className="text-body font-semibold text-text">
        Add a checklist item
      </h4>

      <TextInputField
        id={`${formId}-label`}
        label="What has to happen"
        required
        value={label}
        onChange={setLabel}
        placeholder="Factory gate pass"
      />

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <SelectField
          id={`${formId}-owner`}
          label="Owner"
          required
          value={ownerId}
          onChange={setOwnerId}
          options={ownerOptions}
          placeholder="Choose an owner…"
        />
        <TextInputField
          id={`${formId}-due`}
          label="Due date"
          type="date"
          required
          value={dueDate}
          onChange={setDueDate}
        />
      </div>

      {error && (
        <p role="alert" className="text-body-sm text-error-ink">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-sm">
        <Button type="submit" variant="primary" disabled={busy}>
          Add item
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Done adding
        </Button>
      </div>
    </form>
  );
}
