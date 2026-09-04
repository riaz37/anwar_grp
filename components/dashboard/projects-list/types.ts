import type { ProjectHealth, ProjectStage } from "@prisma/client";
import { STAGE_ORDER } from "@/components/projects/projectTone";

/**
 * Row model for the portfolio list. The page hands the client browser plain
 * serialisable values only — dates arrive as `YYYY-MM-DD` strings so the
 * server render and the client rehydration format and compare them
 * identically (see `lib/format.ts` on why locale/zone are pinned).
 */
export interface ProjectListItem {
  id: string;
  name: string;
  currentStage: ProjectStage;
  health: ProjectHealth;
  ownerName: string;
  analystName: string | null;
  developerName: string | null;
  businessUnitName: string;
  departmentName: string;
  /** `YYYY-MM-DD`. */
  expectedDeliveryDate: string;
}

/** Health ordered by how loudly it asks for attention, not alphabetically. */
export const HEALTH_RANK: Record<ProjectHealth, number> = {
  DELAYED: 0,
  BLOCKED: 1,
  AT_RISK: 2,
  ON_TRACK: 3,
};

/** Facet order for the health filter row — worst first, matching the rank. */
export const HEALTH_FACETS: readonly ProjectHealth[] = [
  "DELAYED",
  "BLOCKED",
  "AT_RISK",
  "ON_TRACK",
];

export type SortKey = "name" | "stage" | "health" | "delivery";
export type SortDirection = "asc" | "desc";
export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

/**
 * Clicking a new column starts it in its most useful direction rather than
 * always ascending: names read A→Z, but a schedule reads soonest-first and a
 * health column reads worst-first.
 */
const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  name: "asc",
  stage: "asc",
  health: "asc",
  delivery: "asc",
};

export function toggleSort(current: SortState, key: SortKey): SortState {
  if (current.key !== key) return { key, direction: DEFAULT_DIRECTION[key] };
  return {
    key,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

export interface PortfolioFilters {
  query: string;
  stage: ProjectStage | "";
  health: ProjectHealth | "";
  hideCompleted: boolean;
}

export const EMPTY_FILTERS: PortfolioFilters = {
  query: "",
  stage: "",
  health: "",
  hideCompleted: false,
};

export function hasActiveFilters(filters: PortfolioFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.stage !== "" ||
    filters.health !== "" ||
    filters.hideCompleted
  );
}

export function filterProjects(
  projects: readonly ProjectListItem[],
  filters: PortfolioFilters,
): ProjectListItem[] {
  const query = filters.query.trim().toLowerCase();
  return projects.filter((project) => {
    if (filters.hideCompleted && project.currentStage === "COMPLETED") {
      return false;
    }
    if (filters.stage !== "" && project.currentStage !== filters.stage) {
      return false;
    }
    if (filters.health !== "" && project.health !== filters.health) {
      return false;
    }
    if (query === "") return true;
    return [
      project.name,
      project.ownerName,
      project.analystName ?? "",
      project.developerName ?? "",
      project.businessUnitName,
      project.departmentName,
    ].some((field) => field.toLowerCase().includes(query));
  });
}

export function sortProjects(
  projects: readonly ProjectListItem[],
  sort: SortState,
): ProjectListItem[] {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...projects].sort((a, b) => {
    switch (sort.key) {
      case "stage":
        return (
          (STAGE_ORDER.indexOf(a.currentStage) -
            STAGE_ORDER.indexOf(b.currentStage)) *
            direction || a.name.localeCompare(b.name)
        );
      case "health":
        return (
          (HEALTH_RANK[a.health] - HEALTH_RANK[b.health]) * direction ||
          a.name.localeCompare(b.name)
        );
      case "delivery":
        return (
          a.expectedDeliveryDate.localeCompare(b.expectedDeliveryDate) *
            direction || a.name.localeCompare(b.name)
        );
      default:
        return a.name.localeCompare(b.name) * direction;
    }
  });
}

const DAY_MS = 86_400_000;

/** Whole days from `todayIso` to `targetIso`; negative once the date is past. */
export function daysUntil(targetIso: string, todayIso: string): number {
  const target = Date.parse(`${targetIso}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  return Math.round((target - today) / DAY_MS);
}

export type DeliveryTone = "done" | "overdue" | "soon" | "steady";

/**
 * The schedule read-out beside every date. A completed project is never
 * "late" — its delivery date is history, so it drops out of the urgency
 * scale entirely instead of glowing red forever.
 */
export function describeDelivery(
  project: ProjectListItem,
  todayIso: string,
): { tone: DeliveryTone; label: string } {
  if (project.currentStage === "COMPLETED") {
    return { tone: "done", label: "Delivered" };
  }
  const days = daysUntil(project.expectedDeliveryDate, todayIso);
  if (days < 0) {
    return { tone: "overdue", label: `${Math.abs(days)}d overdue` };
  }
  if (days === 0) return { tone: "soon", label: "Due today" };
  if (days <= 7) return { tone: "soon", label: `in ${days}d` };
  if (days <= 60) return { tone: "steady", label: `in ${days}d` };
  return { tone: "steady", label: `in ${Math.round(days / 30)}mo` };
}

export const DELIVERY_TONE_CLASS: Record<DeliveryTone, string> = {
  done: "text-success-high",
  overdue: "text-danger-high",
  soon: "text-warn-high",
  steady: "text-text-low",
};

/** Two-letter monogram for an avatar chip: first + last initial. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function stageIndex(stage: ProjectStage): number {
  return Math.max(0, STAGE_ORDER.indexOf(stage));
}

export const STAGE_COUNT = STAGE_ORDER.length;
