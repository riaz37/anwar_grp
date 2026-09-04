import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/StatusPill";
import { Card, CardContent } from "@/components/ui/primitives/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/primitives/table";
import { STAGE_LABELS, STAGE_ORDER } from "@/components/projects/projectTone";

/**
 * Mirrors `AT_RISK_WINDOW_DAYS` in `lib/project-health.ts`. That module is
 * `server-only` and imports Prisma at module scope; pulling it in here would
 * instantiate a database client during the static render of a page that has
 * no business touching the database.
 */
const AT_RISK_WINDOW_DAYS = 3;

export const metadata: Metadata = {
  title: "ProjectFlow, Anwar Group AI project governance",
  description:
    "The governance layer over Anwar Group's AI and software initiatives: one owner, one current stage, one next milestone per project, with health computed from real delivery data.",
};

/**
 * Public landing page.
 *
 * Its job is narrow: explain the governance model to Anwar Group leadership
 * and to a new team member before they authenticate, then route them to
 * `/login`. It is a credibility page, not a campaign.
 *
 * Everything below is static. This route sits outside `(dashboard)`, so it
 * has no session and reads nothing from the database; the figures quoted are
 * the seeded demo portfolio (`prisma/seed.ts`), labelled as such rather than
 * presented as live numbers.
 *
 * Motion: the opening band alone carries the `rise-in` entrance from
 * globals.css. It animates transform and opacity from an invisible start to a
 * fully visible resting state, runs once on load, and is not gated on a
 * scroll observer, so no section can ever fail to appear. Reduced motion
 * collapses the duration and the stagger delay to nothing (globals.css).
 */

/** Stagger index for the opening band, per DESIGN.md > Motion. */
function rise(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}

/** Full-bleed band closed by a hairline, the page's only structural unit. */
function Band({
  id,
  index,
  label,
  children,
  tint = false,
}: {
  id?: string;
  /** Drawing-style band index, e.g. `02`. */
  index: string;
  label: string;
  children: ReactNode;
  tint?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${index}-heading`}
      className={`border-b border-outline-low ${tint ? "bg-surface-1" : ""}`}
    >
      <div className="mx-auto grid w-full max-w-page grid-cols-1 gap-ds-7xl px-ds-2xl py-[clamp(48px,5vw,80px)] lg:grid-cols-[8rem_minmax(0,1fr)] lg:gap-ds-9xl lg:px-ds-7xl lg:py-[clamp(64px,6vw,96px)]">
        <p className="annotation flex items-baseline gap-ds-lg lg:sticky lg:top-20 lg:self-start">
          <span className="font-data tabular-nums text-primary-high">{index}</span>
          <span>{label}</span>
        </p>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function BandHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="max-w-[24ch] text-balance text-heading-2 font-semibold text-text-high"
    >
      {children}
    </h2>
  );
}

/** Label above value, the way a drawing annotates a dimension. */
function Spec({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className="border-t border-outline-low pt-ds-sm">
      <dt className="annotation">{label}</dt>
      <dd
        className={`mt-ds-xxs text-body-1 text-text-high ${numeric ? "font-data tabular-nums" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

const ROLES: {
  role: string;
  person: string;
  does: string;
  sees: string;
}[] = [
  {
    role: "AI Analyst",
    person: "Nusrat Jahan",
    does: "Creates projects, writes the requirements, manages milestones, records blockers and delay reasons, moves stages.",
    sees: "Every project they work on, end to end.",
  },
  {
    role: "Developer",
    person: "Tanvir Ahmed",
    does: "Updates task and milestone status, raises and resolves blockers, ticks exit criteria, moves stages.",
    sees: "The projects they are assigned to.",
  },
  {
    role: "Business Owner",
    person: "Kamrul Hasan",
    does: "Approves the design, records scope changes, signs off UAT, moves stages.",
    sees: "The projects their department requested.",
  },
  {
    role: "AI Team Lead",
    person: "Farzana Rahman",
    does: "Everything an analyst and a developer can do, plus assigning the owner, analyst, and developer on any project.",
    sees: "The whole portfolio, plus the management dashboard.",
  },
  {
    role: "Management",
    person: "Anwar Chowdhury",
    does: "Nothing. Read only by design, so the record stays the delivery team's account of itself.",
    sees: "The whole portfolio, plus the management dashboard.",
  },
];

const HEALTH_RULES: {
  tone: "neutral" | "error" | "warning" | "success";
  label: string;
  rule: string;
}[] = [
  {
    tone: "neutral",
    label: "Blocked",
    rule: "At least one blocker is open. A blocker outranks a slipped date because nobody on the project can clear it alone.",
  },
  {
    tone: "error",
    label: "Delayed",
    rule: "A milestone is past its due date and is not done.",
  },
  {
    tone: "warning",
    label: "At risk",
    rule: `A milestone falls due within ${AT_RISK_WINDOW_DAYS} days and is not done yet.`,
  },
  {
    tone: "success",
    label: "On track",
    rule: "No open blocker, nothing overdue, nothing due imminently.",
  },
];

/** The two projects `prisma/seed.ts` creates, quoted as they are seeded. */
const PORTFOLIO: {
  name: string;
  problem: string;
  owner: string;
  stage: string;
  nextMilestone: string;
  health: { tone: "error" | "success"; label: string };
  note: string;
}[] = [
  {
    name: "Claims Intake Automation",
    problem:
      "Claims intake is manual, re-keyed from scanned PDFs, and takes 3 business days to reach an adjuster.",
    owner: "Farzana Rahman, AI Team Lead",
    stage: STAGE_LABELS.DEVELOPMENT,
    nextMilestone: "Core OCR pipeline, 2 days overdue",
    health: { tone: "error", label: "Delayed" },
    note: "Delay reason on record: integration dependency, waiting on the claims vendor OCR sandbox credentials.",
  },
  {
    name: "Internal Helpdesk Copilot",
    problem:
      "IT helpdesk tickets take an average of 6 hours to triage before reaching the right specialist.",
    owner: "Farzana Rahman, AI Team Lead",
    stage: STAGE_LABELS.IDEA,
    nextMilestone: "None set yet, the Idea gate has to close first",
    health: { tone: "success", label: "On track" },
    note: "Analyst and developer are still unassigned, which is exactly what the Idea stage looks like.",
  },
];

export default async function MarketingPage() {
  // A signed-in visitor has no reason to land on the pitch for the tool
  // they're already using — send them straight to their home dashboard.
  // This makes the page dynamic (session cookies vary per request), trading
  // the static prerender for correct behavior.
  const session = await getSession();
  if (session) redirect("/home");

  return (
    <>
      {/* Opening band. Asymmetric two-column: the argument on the left, a
          specimen of the actual record on the right. The old ultramarine
          system's `.blueprint-grid` hairline lattice has no equivalent in
          this dark, lime-accent system (DESIGN.md doesn't specify a
          hero-band decorative pattern), so the band is now a plain surface
          rather than a re-guessed decoration. */}
      <section aria-labelledby="hero-heading" className="border-b border-outline-low">
        <div className="mx-auto grid w-full max-w-page grid-cols-1 gap-ds-9xl px-ds-2xl py-[clamp(56px,7vw,112px)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-ds-9xl lg:px-ds-7xl lg:py-[clamp(72px,8vw,128px)]">
          <div>
            <p className="rise-in annotation" style={rise(0)}>
              Anwar Group, AI and Digital Transformation
            </p>
            <h1
              id="hero-heading"
              className="rise-in mt-ds-2xl max-w-[18ch] text-balance text-display-1 font-extrabold text-text-high"
              style={rise(1)}
            >
              One owner. One stage. One next date.
            </h1>
            <p
              className="rise-in mt-ds-7xl max-w-[62ch] text-pretty text-body-2 text-text-med"
              style={rise(2)}
            >
              ProjectFlow is the governance layer over Anwar Group&apos;s AI and
              software initiatives. It is not another task tracker. It exists so
              that management can see, in seconds, where every project stands,
              what is late, why it is late, who owns the next move, and when it
              ships.
            </p>
            <div
              className="rise-in mt-ds-9xl flex flex-wrap items-center gap-ds-xl"
              style={rise(3)}
            >
              <ButtonLink href="/login" variant="primary">
                Sign in to ProjectFlow
              </ButtonLink>
              <ButtonLink href="#model" variant="ghost">
                Read the governance model
              </ButtonLink>
            </div>
            <p
              className="rise-in mt-ds-2xl text-caption-2 text-text-low"
              style={rise(4)}
            >
              Access is by Anwar Group account. Every stage change, blocker, and
              scope change is attributed and timestamped.
            </p>
          </div>

          {/* Specimen: a real project record with its live fields, so the
              first thing a visitor sees is the product's actual output. */}
          <Card
            className="rise-in gap-0 py-0 shadow-e2"
            style={rise(5)}
            aria-labelledby="specimen-name"
          >
            <CardContent className="px-ds-2xl py-ds-2xl">
              <div className="flex items-baseline justify-between gap-ds-xl border-b border-outline-low pb-ds-sm">
                <p className="annotation">Project record</p>
                <p className="annotation font-data tabular-nums">Seeded demo</p>
              </div>
              <p
                id="specimen-name"
                className="mt-ds-2xl text-title-1 font-semibold text-text-high"
              >
                Claims Intake Automation
              </p>
              <dl className="mt-ds-2xl grid grid-cols-2 gap-x-ds-2xl gap-y-ds-xl">
                <Spec label="Owner" value="Farzana Rahman" />
                <Spec label="Current stage" value={STAGE_LABELS.DEVELOPMENT} />
                <Spec
                  label="Next milestone"
                  value="Core OCR pipeline"
                />
                <Spec label="Due" value="2 days overdue" numeric />
                <Spec
                  label="Health"
                  value={<Pill tone="error" label="Delayed" />}
                />
                <Spec label="Open blockers" value="0" numeric />
              </dl>
              <p className="mt-ds-2xl border-t border-outline-low pt-ds-sm text-caption-2 text-text-low">
                Health here was not typed in by anyone. It is what the overdue
                milestone and the blocker log add up to.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Band id="model" index="01" label="The model">
        <BandHeading id="01-heading">
          A project is one accountable record, not a board full of cards.
        </BandHeading>
        <p className="mt-ds-2xl max-w-[62ch] text-pretty text-body-2 text-text-med">
          Anwar Group runs AI initiatives across several departments at once.
          The failure mode is never a missing task list, it is a status meeting
          where nobody can say who owns the next move. ProjectFlow fixes the
          shape of the record so that answer always exists.
        </p>
        <dl className="mt-ds-9xl grid grid-cols-1 gap-x-ds-9xl gap-y-ds-2xl sm:grid-cols-2 lg:grid-cols-3">
          <Spec
            label="One owner"
            value="Exactly one accountable person per project. Analyst and developer are separate assignments, and neither dilutes the owner."
          />
          <Spec
            label="One current stage"
            value="A project sits at one of ten stages. It moves forward one step at a time, and every move is recorded with who made it."
          />
          <Spec
            label="One next milestone"
            value="A dated checkpoint with its own owner. Slipping past that date forces a recorded delay reason before anything else can proceed."
          />
          <Spec
            label="Blockers name the fix"
            value="Every open blocker carries its impact and the single action that would clear it, so escalation is a sentence, not a meeting."
          />
          <Spec
            label="Scope changes are logged"
            value="A delivery date can move, but only with a reason and an impact attached, which is what keeps it explainable months later."
          />
          <Spec
            label="Documents sit on the record"
            value="Requirements, designs, test results, and UAT sign-offs attach to the project the gate asked for them at."
          />
        </dl>
      </Band>

      <Band index="02" label="The pipeline" tint>
        <BandHeading id="02-heading">
          Ten stages, each with fixed exit criteria.
        </BandHeading>
        <p className="mt-ds-2xl max-w-[62ch] text-pretty text-body-2 text-text-med">
          The stages are the same for every project, so two initiatives at
          Development mean the same thing. A stage cannot be advanced while one
          of its required exit-criteria items is still unticked, which is what
          stops a project being declared finished by optimism.
        </p>
        <ol className="mt-ds-9xl grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-outline-low bg-outline-low sm:grid-cols-2 lg:grid-cols-5">
          {STAGE_ORDER.map((stage, i) => {
            const isCurrent = stage === "DEVELOPMENT";
            return (
              <li
                key={stage}
                className={`flex flex-col gap-ds-xxs px-ds-2xl py-ds-2xl ${
                  isCurrent ? "bg-primary-wash" : "bg-surface-0"
                }`}
              >
                <span
                  className={`font-data text-caption-2 tabular-nums ${
                    isCurrent ? "text-primary-high" : "text-text-low"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`text-body-1 ${
                    isCurrent ? "font-semibold text-primary-high" : "text-text-high"
                  }`}
                >
                  {STAGE_LABELS[stage]}
                </span>
                {isCurrent && (
                  <span className="text-caption-2 text-primary-high">
                    Claims Intake Automation is here
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </Band>

      <Band index="03" label="Health">
        <BandHeading id="03-heading">
          Status is computed from the record, never typed into it.
        </BandHeading>
        <p className="mt-ds-2xl max-w-[62ch] text-pretty text-body-2 text-text-med">
          A self-reported green light is worth nothing. Health here is derived
          on every write from two things the team is already recording: open
          blockers and milestone dates. The highest applicable state wins.
        </p>
        <ul className="mt-ds-9xl flex flex-col">
          {HEALTH_RULES.map((h) => (
            <li
              key={h.label}
              className="flex flex-col gap-ds-xs border-t border-outline-low py-ds-2xl last:border-b sm:flex-row sm:items-baseline sm:gap-ds-7xl"
            >
              <span className="w-28 shrink-0">
                <Pill tone={h.tone} label={h.label} />
              </span>
              <span className="max-w-[62ch] text-pretty text-body-1 text-text-high">
                {h.rule}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-ds-7xl max-w-[62ch] border-l-2 border-primary-med py-ds-sm pl-ds-2xl text-pretty text-body-1 text-text-high">
          Worked example: Claims Intake Automation reads Delayed because the
          Core OCR pipeline milestone passed its due date while still in
          progress. The team recorded the reason against it, integration
          dependency, so the delay is not just a red marker, it has an account
          attached.
        </p>
      </Band>

      <Band index="04" label="Roles" tint>
        <BandHeading id="04-heading">
          Five roles. What each one can change is the difference between them.
        </BandHeading>
        <p className="mt-ds-2xl max-w-[62ch] text-pretty text-body-2 text-text-med">
          Permissions are enforced on the server, not by hiding buttons.
          Management is deliberately read only: leadership reads the portfolio,
          it does not edit the delivery team&apos;s account of it.
        </p>
        <div className="mt-ds-9xl overflow-x-auto rounded-xl border border-outline-low bg-surface-0">
          {/* A floor width so the three columns scroll on a phone rather than
              compressing into three unreadable ribbons of wrapped text. */}
          <Table className="min-w-[46rem]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Role</TableHead>
                <TableHead scope="col">Can change</TableHead>
                <TableHead scope="col">Can see</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLES.map((r) => (
                <TableRow key={r.role}>
                  <TableCell className="align-top">
                    <span className="block font-medium text-text-high">
                      {r.role}
                    </span>
                    <span className="mt-ds-xxs block text-caption-2 text-text-low">
                      Demo account: {r.person}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[38ch] whitespace-normal align-top text-text-med">
                    {r.does}
                  </TableCell>
                  <TableCell className="max-w-[26ch] whitespace-normal align-top text-text-med">
                    {r.sees}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Band>

      <Band index="05" label="In the system">
        <BandHeading id="05-heading">
          What the seeded portfolio looks like today.
        </BandHeading>
        <p className="mt-ds-2xl max-w-[62ch] text-pretty text-body-2 text-text-med">
          Two projects ship with the demo database, chosen to sit at opposite
          ends of the pipeline. Sign in with any of the five demo accounts to
          see the same records with that role&apos;s permissions applied.
        </p>
        <div className="mt-ds-9xl grid grid-cols-1 gap-ds-2xl lg:grid-cols-2">
          {PORTFOLIO.map((p) => (
            <Card key={p.name} className="gap-0 py-0 shadow-e2">
              <CardContent className="px-ds-2xl py-ds-2xl">
                <div className="flex flex-wrap items-center justify-between gap-ds-xl">
                  <h3 className="text-title-1 font-semibold text-text-high">
                    {p.name}
                  </h3>
                  <Pill tone={p.health.tone} label={p.health.label} />
                </div>
                <p className="mt-ds-xl max-w-[62ch] text-pretty text-body-1 text-text-med">
                  {p.problem}
                </p>
                <dl className="mt-ds-2xl grid grid-cols-1 gap-x-ds-2xl gap-y-ds-xl sm:grid-cols-2">
                  <Spec label="Owner" value={p.owner} />
                  <Spec label="Current stage" value={p.stage} />
                  <Spec label="Next milestone" value={p.nextMilestone} />
                  <Spec label="Note" value={p.note} />
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </Band>

      <section aria-labelledby="access-heading">
        <div className="mx-auto w-full max-w-page px-ds-2xl py-[clamp(48px,6vw,96px)] lg:px-ds-7xl">
          <p className="annotation">Access</p>
          <h2
            id="access-heading"
            className="mt-ds-xl max-w-[22ch] text-balance text-heading-1 font-bold text-text-high"
          >
            Sign in with your Anwar Group account.
          </h2>
          <p className="mt-ds-2xl max-w-[62ch] text-pretty text-body-2 text-text-med">
            If you are on the AI team, your account already exists and your role
            decides what you can change. If you are reviewing the portfolio for
            leadership, ask the AI Team Lead for a Management account, which
            opens the dashboard in read-only form.
          </p>
          <div className="mt-ds-9xl flex flex-wrap items-center gap-ds-xl">
            <ButtonLink href="/login" variant="primary">
              Sign in to ProjectFlow
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
