"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/components/projects/projectTone";
import { Button } from "@/components/ui/Button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/primitives/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/primitives/popover";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/primitives/toggle-group";

export interface DirectoryUser {
  id: string;
  name: string;
  role: string;
}

export interface RoleChoice {
  value: string;
  label: string;
}

/**
 * Searchable person picker (Popover + Command combobox) used as the inline
 * fix on the ownership queue — the point of a queue row is to clear it from
 * here, not to navigate somewhere else and come back.
 *
 * The directory is loaded on first open (`onOpen`) rather than shipped with
 * the page: a dashboard that may show zero gaps should not pay for a user
 * list nobody opens.
 */
export function PersonPicker({
  label,
  heading,
  description,
  users,
  loading,
  loadError,
  onOpen,
  roleChoices,
  busy,
  onPick,
}: {
  /** Trigger text — a verb + object, e.g. "Assign owner". */
  label: string;
  /** Popover heading; names the project so the action is unambiguous. */
  heading: string;
  description?: string;
  users: DirectoryUser[];
  loading: boolean;
  loadError: string | null;
  onOpen: () => void;
  /** Optional second dimension, e.g. Consulted vs Informed. */
  roleChoices?: RoleChoice[];
  busy: boolean;
  onPick: (userId: string, roleChoice: string | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(roleChoices?.[0]?.value ?? null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function pick(userId: string) {
    setPendingId(userId);
    const settled = await onPick(userId, choice);
    setPendingId(null);
    if (settled) setOpen(false);
  }

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onOpen();
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button
          aria-busy={busy}
          className="h-8 gap-ds-sm rounded-md border border-outline-med bg-surface-2 px-ds-lg text-caption-2 font-semibold text-text-med hover:bg-surface-3 hover:text-text-high"
          disabled={busy}
          variant="secondary"
        >
          {busy ? "Saving…" : label}
          <ChevronDown aria-hidden="true" className="size-3.5 text-text-low" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[19rem] rounded-xl border-outline-low bg-surface-1 p-0 shadow-e2"
      >
        <div className="border-b border-outline-low px-ds-2xl py-ds-xl">
          <p className="truncate text-body-1 font-semibold text-text-high">
            {heading}
          </p>
          {description && (
            <p className="mt-ds-xxs text-caption-1 text-text-low">{description}</p>
          )}
          {roleChoices && (
            <ToggleGroup
              aria-label="RACI role"
              className="mt-ds-lg rounded-sm bg-surface-2 p-ds-xxs"
              onValueChange={(next) => next && setChoice(next)}
              type="single"
              value={choice ?? undefined}
              variant="default"
            >
              {roleChoices.map((entry) => (
                <ToggleGroupItem
                  className="h-auto flex-1 rounded-sm px-ds-md py-ds-xs text-caption-2 font-medium text-text-low hover:bg-transparent hover:text-text-high data-[state=on]:bg-surface-4 data-[state=on]:text-text-high"
                  key={entry.value}
                  value={entry.value}
                >
                  {entry.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>

        <Command
          className="bg-transparent"
          filter={(value, search) =>
            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput
            className="text-body-1"
            placeholder="Search people"
          />
          <CommandList className="max-h-[15rem]">
            {loadError ? (
              <p className="px-ds-2xl py-ds-4xl text-body-1 text-danger-high">
                {loadError}
              </p>
            ) : loading ? (
              <p className="px-ds-2xl py-ds-4xl text-body-1 text-text-low">
                Loading people…
              </p>
            ) : (
              <>
                <CommandEmpty className="px-ds-2xl py-ds-4xl text-left text-body-1 text-text-low">
                  Nobody matches that name.
                </CommandEmpty>
                <CommandGroup className="p-ds-xs">
                  {users.map((user) => (
                    <CommandItem
                      className="flex items-center gap-ds-md rounded-md px-ds-lg py-ds-md text-body-1 data-[selected=true]:bg-primary-wash data-[selected=true]:text-primary-high"
                      disabled={pendingId !== null}
                      key={user.id}
                      onSelect={() => pick(user.id)}
                      value={`${user.name} ${roleLabel(user.role)}`}
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-6 shrink-0 place-items-center rounded-pill bg-primary-med text-caption-2 font-semibold text-primary-onaccent"
                      >
                        {initials(user.name)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {user.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-caption-1 text-text-low",
                          pendingId === user.id && "text-primary-high",
                        )}
                      >
                        {pendingId === user.id ? "Saving…" : roleLabel(user.role)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
