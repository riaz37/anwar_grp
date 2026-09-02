import Link from "next/link";
import { EmptyTasksIcon } from "@/components/shell/icons";
import {
  dueLabel,
  groupTasks,
  type Task,
  type Urgency,
} from "./types";

/* Column template shared by the header strip and every row so the queue stays
   on one grid at desktop width (DESIGN.md > Layout: grid-disciplined). */
const COLUMNS =
  // Track sizes are fixed ratios (not `max-content`) so the header strip and
  // every row resolve to identical columns despite being separate grids.
  "md:grid md:grid-cols-[minmax(0,3.5fr)_minmax(0,4fr)_minmax(7.5rem,1.3fr)_minmax(3.5rem,0.8fr)_minmax(7.5rem,1.3fr)] " +
  "md:items-center md:gap-md lg:gap-lg";

const URGENCY_DOT: Record<Urgency, string> = {
  overdue: "bg-error",
  today: "bg-warning",
  upcoming: "bg-border-strong",
};

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: "text-error-ink",
  today: "text-warning-ink",
  upcoming: "text-muted",
};

function StagePill({ stage }: { stage: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-border bg-surface-sunken px-sm py-2xs text-caption font-medium text-muted">
      {stage}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-caption font-medium uppercase tracking-[0.06em] text-muted md:hidden">
      {children}
    </span>
  );
}

function TaskRow({ task, urgency }: { task: Task; urgency: Urgency }) {
  return (
    <li className={`px-md py-md lg:px-lg ${COLUMNS}`}>
      <div className="min-w-0">
        <Link
          href={`/candidates/${task.candidateId}`}
          /* On touch devices the tap area is padded out to 44px and pulled
             back with a matching negative margin, so row density is unchanged
             on pointer devices (DESIGN.md > Accessibility). */
          className="rounded-sm text-body font-medium text-text underline decoration-transparent decoration-1 underline-offset-2 transition-colors duration-100 ease-move hover:decoration-accent pointer-coarse:inline-flex pointer-coarse:-my-[13px] pointer-coarse:py-[13px]"
        >
          {task.candidateName}
        </Link>
        <p className="truncate text-body-sm text-muted">
          <span className="font-data tabular-nums">{task.requisitionRef}</span>
          {" · "}
          {task.requisitionTitle}
        </p>
      </div>

      <p className="mt-sm text-body-sm text-text md:mt-0">
        <FieldLabel>Next action</FieldLabel>{" "}
        <span className="md:block">{task.nextAction}</span>
      </p>

      <div className="mt-sm md:mt-0">
        <StagePill stage={task.stage} />
      </div>

      <p className="mt-sm text-body-sm text-muted md:mt-0">
        <FieldLabel>Owner</FieldLabel> {task.owner}
      </p>

      <p
        className={`mt-sm flex items-center gap-sm whitespace-nowrap text-body-sm font-medium md:mt-0 md:justify-end ${URGENCY_TEXT[urgency]}`}
      >
        <span
          aria-hidden="true"
          className={`size-1.5 shrink-0 rounded-full ${URGENCY_DOT[urgency]}`}
        />
        <span className="font-data tabular-nums">
          {dueLabel(task.dueDate)}
        </span>
      </p>
    </li>
  );
}

function EmptyQueue() {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface px-lg py-2xl text-center">
      <EmptyTasksIcon className="mx-auto text-border-strong" />
      <h2 className="mt-md text-section text-text">Your queue is clear</h2>
      <p className="mx-auto mt-sm max-w-[46ch] text-body-sm text-muted">
        Tasks appear here when an application you own has a next action with a
        due date — a screening to record, feedback to chase, an approval to
        submit. Nothing is waiting on you right now.
      </p>
      <div className="mt-lg flex flex-wrap items-center justify-center gap-md">
        <Link
          href="/candidates"
          className="inline-flex min-h-11 items-center rounded-sm border border-border-strong bg-surface px-md text-body-sm font-medium text-text transition-colors duration-100 ease-move hover:bg-surface-sunken"
        >
          Browse candidates
        </Link>
        <Link href="/requisitions" className="link text-body-sm">
          View open requisitions
        </Link>
      </div>
    </div>
  );
}

export function TaskQueue({ tasks }: { tasks: Task[] }) {
  const groups = groupTasks(tasks);

  if (groups.length === 0) return <EmptyQueue />;

  return (
    <div className="flex flex-col gap-xl">
      {groups.map((group) => (
        <section key={group.urgency} aria-labelledby={`group-${group.urgency}`}>
          <div className="mb-sm flex items-baseline gap-sm">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${URGENCY_DOT[group.urgency]}`}
            />
            <h2
              id={`group-${group.urgency}`}
              className="text-section text-text"
            >
              {group.title}
            </h2>
            <span className="font-data text-body-sm tabular-nums text-muted">
              {group.tasks.length}
            </span>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <div
              className={`hidden border-b border-border bg-surface-sunken px-md py-sm text-caption font-medium uppercase tracking-[0.06em] text-muted lg:px-lg ${COLUMNS}`}
            >
              <span>Candidate</span>
              <span>Next action</span>
              <span>Stage</span>
              <span>Owner</span>
              <span className="md:text-right">Due</span>
            </div>

            <ul className="divide-y divide-border">
              {group.tasks.map((task) => (
                <TaskRow key={task.id} task={task} urgency={group.urgency} />
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
