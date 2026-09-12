"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { DependencyItemType } from "@prisma/client";
import { cn } from "@/lib/utils";
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
import { ApiRequestError, postJson } from "@/lib/api-client";
import type { ItemDependencyView } from "../types";

export interface DependencyCandidate {
  id: string;
  type: DependencyItemType;
  label: string;
}

/**
 * Multi-select "depends on" picker, forked from PersonPicker's Popover +
 * Command combobox (components/dashboard/portfolio/PersonPicker.tsx) — same
 * searchable-list shape, but toggling any number of predecessors instead of
 * picking exactly one person. Cycle/self-loop/cross-project rejection is
 * enforced server-side (lib/dependency-graph.ts via the dependencies route);
 * this component surfaces that rejection as an inline error rather than
 * pre-checking client-side, to avoid duplicating that logic into the
 * client bundle.
 */
export function DependencyPicker({
  projectId,
  itemType,
  itemId,
  itemLabel,
  candidates,
  currentEdges,
  onChanged,
}: {
  projectId: string;
  itemType: DependencyItemType;
  itemId: string;
  itemLabel: string;
  /** Every other milestone/task in the project — the caller excludes self. */
  candidates: DependencyCandidate[];
  /** This item's own dependency edges, from the project's full edge list. */
  currentEdges: ItemDependencyView[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const edgeByDependsOnId = new Map(
    currentEdges.map((edge) => [`${edge.dependsOnType}:${edge.dependsOnId}`, edge]),
  );

  async function toggle(candidate: DependencyCandidate) {
    const key = `${candidate.type}:${candidate.id}`;
    const existing = edgeByDependsOnId.get(key);
    setPendingCandidateId(candidate.id);
    setError(null);
    try {
      if (existing) {
        const response = await fetch(
          `/api/v1/projects/${projectId}/dependencies/${existing.id}`,
          { method: "DELETE" },
        );
        const envelope = await response.json().catch(() => null);
        if (!response.ok || !envelope?.success) {
          throw new ApiRequestError(
            envelope?.error?.message ?? "Couldn’t remove the dependency.",
            response.status,
            envelope?.error?.code ?? "UNKNOWN_ERROR",
          );
        }
      } else {
        await postJson(`/api/v1/projects/${projectId}/dependencies`, {
          dependentType: itemType,
          dependentId: itemId,
          dependsOnType: candidate.type,
          dependsOnId: candidate.id,
        });
      }
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Couldn’t update the dependency.",
      );
    } finally {
      setPendingCandidateId(null);
    }
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-8 gap-ds-sm rounded-md border border-outline-med bg-surface-2 px-ds-lg text-caption-2 font-semibold text-text-med hover:bg-surface-3 hover:text-text-high"
          variant="secondary"
        >
          {currentEdges.length > 0 ? `Depends on (${currentEdges.length})` : "Depends on"}
          <ChevronDown aria-hidden="true" className="size-3.5 text-text-low" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[19rem] rounded-xl border-outline-low bg-surface-1 p-0 shadow-e2"
      >
        <div className="border-b border-outline-low px-ds-2xl py-ds-xl">
          <p className="truncate text-body-1 font-semibold text-text-high">{itemLabel}</p>
          <p className="mt-ds-xxs text-caption-1 text-text-low">
            Select what has to finish before this can start.
          </p>
          {error && <p className="mt-ds-sm text-caption-1 text-danger-high">{error}</p>}
        </div>

        <Command
          className="bg-transparent"
          filter={(value, search) =>
            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput className="text-body-1" placeholder="Search milestones and tasks" />
          <CommandList className="max-h-[15rem]">
            <CommandEmpty className="px-ds-2xl py-ds-4xl text-left text-body-1 text-text-low">
              Nothing else to depend on yet.
            </CommandEmpty>
            <CommandGroup className="p-ds-xs">
              {candidates.map((candidate) => {
                const key = `${candidate.type}:${candidate.id}`;
                const selected = edgeByDependsOnId.has(key);
                return (
                  <CommandItem
                    className="flex items-center gap-ds-md rounded-md px-ds-lg py-ds-md text-body-1 data-[selected=true]:bg-primary-wash data-[selected=true]:text-primary-high"
                    disabled={pendingCandidateId !== null}
                    key={candidate.id}
                    onSelect={() => toggle(candidate)}
                    value={candidate.label}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-sm border border-outline-med",
                        selected && "border-primary-high bg-primary-med",
                      )}
                    >
                      {selected && <Check className="size-3.5 text-primary-onaccent" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {candidate.label}
                    </span>
                    <span className="shrink-0 text-caption-1 text-text-low">
                      {pendingCandidateId === candidate.id
                        ? "Saving…"
                        : candidate.type === "MILESTONE"
                          ? "Milestone"
                          : "Task"}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
