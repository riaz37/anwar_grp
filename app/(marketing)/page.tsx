import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { Metadata } from "next";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  CalendarClock,
  Route,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { alias } from "@/components/shell/icons";
import { Button as ButtonPrimitive } from "@/components/ui/primitives/button";
import { Pill } from "@/components/ui/StatusPill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/primitives/table";
import { CheckIcon } from "@/components/ui/icons";
import { GlowField } from "@/components/marketing/GlowField";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";
import { STAGE_LABELS, STAGE_ORDER } from "@/components/projects/projectTone";
import { STAGE_GATE_TEMPLATES } from "@/lib/stage-gate-templates";
import {
  PROJECT_PERMISSIONS,
  type ProjectPermission,
} from "@/lib/project-permissions";

/**
 * Mirrors `AT_RISK_WINDOW_DAYS` in `lib/project-health.ts`. That module is
 * `server-only` and imports Prisma at module scope; pulling it in here would
 * instantiate a database client during the render of a page with no business
 * touching the database. `stage-gate-templates.ts` and
 * `project-permissions.ts`, by contrast, are deliberately plain data modules,
 * so the gate criteria and the permission matrix below are read from the same
 * source the running application enforces rather than retyped by hand.
 */
const AT_RISK_WINDOW_DAYS = 3;

export const metadata: Metadata = {
  title: "ProjectFlow, Anwar Group AI project governance",
  description:
    "The governance record over Anwar Group's AI and software initiatives: one owner, one stage, one next date, and a health status computed from blockers and milestones rather than reported by hand.",
};

/**
 * Public landing page.
 *
 * Its job is narrow: explain the governance model to Anwar Group leadership
 * and to a new team member before they authenticate, then route them to
 * `/login`. It is an explanation, not a campaign — there is nothing to buy and
 * nobody to sign up, so there is no pricing, no testimonial and no logo wall.
 *
 * Everything below is static. This route sits outside `(dashboard)`, so it
 * holds no session and reads nothing from the database; the record on display
 * in the masthead and the figures in section 05 are the seeded demo data
 * (`prisma/seed.ts`), labelled as such.
 *
 * Composition: seven bands, each given its own visual argument rather than one
 * template repeated — an aurora-lit masthead with a specimen record, a card
 * grid, a process rail, a decision cascade, an authority matrix, a portfolio
 * board, and an accent-lit close.
 *
 * Motion (DESIGN.md §8, transform/opacity only, no animation library): the
 * masthead headline unmasks word by word on load, and everything below
 * animates in once as it enters the viewport via `ScrollReveal`. The hidden
 * state is scoped to a class that component adds on mount, so a script failure
 * leaves the whole page visible. Reduced motion drops all of it.
 */

/** Stagger index, consumed by `.rise-in`, `.word-mask` and `[data-reveal]`. */
function step(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}

/**
 * One headline line, split into per-word clipping masks so each word unrolls
 * from beneath the line above it.
 *
 * The masks are inline-blocks in **normal flow**, separated by real space text
 * nodes, rather than flex children separated by a `gap`. A flex container
 * strips whitespace between children, which left the accessible name of the
 * `<h1>` as "Everyprojectanswersthesame…" — the animation must not cost the
 * heading its words.
 */
function MaskedLine({
  words,
  offset,
  className,
}: {
  words: string[];
  offset: number;
  className: string;
}) {
  return (
    <span className={`block ${className}`}>
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          {i > 0 ? " " : null}
          <span className="word-mask">
            <span style={step(offset + i)}>{word}</span>
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/** Band wrapper. `tint` alternates the surface; `id` anchors the footer nav. */
function Band({
  id,
  labelledBy,
  tint = false,
  className = "",
  children,
}: {
  id: string;
  labelledBy: string;
  tint?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`relative border-b border-outline-low ${tint ? "bg-surface-1" : ""} ${className}`}
    >
      <div className="mx-auto w-full max-w-page px-ds-2xl py-[clamp(64px,7vw,112px)] lg:px-ds-7xl">
        {children}
      </div>
    </section>
  );
}

/**
 * Band opener: an accent tick and mono ordinal over a two-tone display
 * heading, the same cadence as the masthead at a smaller step.
 */
function BandHead({
  ordinal,
  kicker,
  headingId,
  headingLead,
  headingTail,
  lead,
}: {
  ordinal: string;
  kicker: string;
  headingId: string;
  /** Rendered in `text-high` — the part that carries the claim. */
  headingLead: string;
  /** Rendered in `text-low` — the qualifier that completes the sentence. */
  headingTail: string;
  lead: string;
}) {
  return (
    <div data-reveal>
      <p className="annotation flex items-center gap-ds-lg">
        <span aria-hidden="true" className="h-px w-10 bg-primary-med" />
        <span className="font-data tabular-nums text-text-med">{ordinal}</span>
        <span>{kicker}</span>
      </p>
      <div className="mt-ds-5xl grid grid-cols-1 gap-ds-5xl lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end lg:gap-ds-9xl">
        <h2
          id={headingId}
          className="max-w-[17ch] text-balance text-display-2 font-semibold"
        >
          <span className="text-text-high">{headingLead} </span>
          <span className="text-text-low">{headingTail}</span>
        </h2>
        <p className="max-w-[46ch] text-pretty text-body-2 text-text-med">
          {lead}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ data -- */

const OwnerIcon = alias(UserRound, { size: 26 });
const StageIcon = alias(Route, { size: 26 });
const DateIcon = alias(CalendarClock, { size: 26 });
const HealthIcon = alias(Activity, { size: 26 });
const AuthorityIcon = alias(ShieldCheck, { size: 26 });

/** The four things the record guarantees. Section 01's card grid. */
const GUARANTEES: {
  icon: typeof OwnerIcon;
  term: string;
  detail: string;
  figure: string;
  figureLabel: string;
}[] = [
  {
    icon: OwnerIcon,
    term: "One owner",
    detail:
      "Exactly one accountable name, held separately from whoever is analysing or building. Only the AI Team Lead can move it.",
    figure: "1",
    figureLabel: "accountable person",
  },
  {
    icon: StageIcon,
    term: "One current stage",
    detail:
      "Ten stages, identical for every project. A project sits at exactly one of them and moves forward a single step at a time.",
    figure: "10",
    figureLabel: "stages, 4 gated",
  },
  {
    icon: DateIcon,
    term: "One next date",
    detail:
      "The next milestone, its own owner, and the day it is due. Slip it and the record demands a reason before anything else moves.",
    figure: "1",
    figureLabel: "dated checkpoint",
  },
  {
    icon: HealthIcon,
    term: "One computed health",
    detail:
      "Derived from open blockers and milestone dates on every write. There is no field anywhere in the product for typing it in.",
    figure: "4",
    figureLabel: "rules, first match wins",
  },
];

/** What the shape of the record forces. Section 01's ledger panel. */
const RECORD_RULES: { term: string; detail: string }[] = [
  {
    term: "Accountability does not spread",
    detail:
      "Analyst and developer are separate assignments and neither dilutes the owner, so a project cannot quietly acquire a committee.",
  },
  {
    term: "A gate is cleared, not asserted",
    detail:
      "While a required exit criterion is unticked the stage will not advance, however confident the status meeting was.",
  },
  {
    term: "A slipped date owes an explanation",
    detail:
      "An overdue milestone cannot be edited past without a delay reason from a fixed list, so the portfolio keeps the account of why.",
  },
  {
    term: "A blocker names the action that clears it",
    detail:
      "Impact and required action are part of the blocker, which turns escalation into one sentence somebody can act on.",
  },
  {
    term: "A moved delivery date leaves a trace",
    detail:
      "Scope changes carry the reason and the delivery impact, so a date that moved twice still reads honestly six months later.",
  },
];

/** Evaluation order of `computeProjectHealth` — first match wins. */
const HEALTH_RULES: {
  tone: "neutral" | "error" | "warning" | "success";
  label: string;
  condition: string;
  rationale: string;
  /** Border/dot classes, so each rung is lit by its own status colour. */
  edge: string;
}[] = [
  {
    tone: "neutral",
    label: "Blocked",
    condition: "any blocker is still open",
    rationale:
      "Outranks a slipped date, because nobody on the project can clear it alone.",
    edge: "border-outline-high",
  },
  {
    tone: "error",
    label: "Delayed",
    condition: "a milestone is past its due date and not done",
    rationale: "The date has already gone. There is nothing left to protect.",
    edge: "border-danger-outline",
  },
  {
    tone: "warning",
    label: "At risk",
    condition: `a milestone falls due within ${AT_RISK_WINDOW_DAYS} days and is not done`,
    rationale:
      "Early enough that the owner can still move something, late enough to be worth saying.",
    edge: "border-warn-outline",
  },
  {
    tone: "success",
    label: "On track",
    condition: "none of the above",
    rationale: "Not a self-assessment. The absence of the other three.",
    edge: "border-success-outline",
  },
];

const ROLES: { role: Role; label: string; short: string; person: string }[] = [
  { role: "AI_ANALYST", label: "AI Analyst", short: "AN", person: "Nusrat Jahan" },
  { role: "DEVELOPER", label: "Developer", short: "DV", person: "Tanvir Ahmed" },
  {
    role: "BUSINESS_OWNER",
    label: "Business Owner",
    short: "BO",
    person: "Kamrul Hasan",
  },
  {
    role: "AI_TEAM_LEAD",
    label: "AI Team Lead",
    short: "TL",
    person: "Farzana Rahman",
  },
  {
    role: "MANAGEMENT",
    label: "Management",
    short: "MG",
    person: "Anwar Chowdhury",
  },
];

/**
 * Human wording for each key of `PROJECT_PERMISSIONS`, ordered so the matrix
 * reads top to bottom: creation, then the day-to-day record, then the two
 * capabilities that separate the lead and management from everyone else.
 */
const CAPABILITIES: { permission: ProjectPermission; label: string }[] = [
  { permission: "CREATE_PROJECT", label: "Create a project" },
  { permission: "EDIT_REQUIREMENTS", label: "Write the requirements" },
  { permission: "APPROVE_DESIGN", label: "Approve the design" },
  { permission: "MANAGE_MILESTONES", label: "Set and move milestones" },
  { permission: "UPDATE_TASK", label: "Update a task" },
  { permission: "TOGGLE_CHECKLIST_ITEM", label: "Tick a gate criterion" },
  { permission: "TRANSITION_STAGE", label: "Advance the stage" },
  { permission: "RECORD_BLOCKER", label: "Raise a blocker" },
  { permission: "RESOLVE_BLOCKER", label: "Resolve a blocker" },
  { permission: "RECORD_DELAY_REASON", label: "Record a delay reason" },
  { permission: "RECORD_SCOPE_CHANGE", label: "Record a scope change" },
  { permission: "ASSIGN_RESOURCES", label: "Assign owner, analyst, developer" },
  {
    permission: "VIEW_MANAGEMENT_DASHBOARD",
    label: "Open the management dashboard",
  },
];

/** Business units the seeded portfolio spans (`prisma/seed.ts`). */
const BUSINESS_UNITS: { name: string; departments: string[] }[] =
  [
    {
      name: "Anwar Cement Ltd.",
      departments: ["Plant Operations", "Sales & Distribution"],
    },
    {
      name: "Anwar Ispat Ltd.",
      departments: ["Production", "Quality Assurance"],
    },
    {
      name: "Bengal Fine Ceramics",
      departments: ["Product Design", "Retail Operations"],
    },
    {
      name: "Anwar Group Real Estate",
      departments: ["Project Development", "Sales & CRM"],
    },
    {
      name: "Corporate IT & Digital Transformation",
      departments: [
        "AI & Digital Transformation",
        "Enterprise IT",
        "Data & Analytics",
      ],
    },
  ];

const PORTFOLIO_CONTENTS: string[] = [
  "Projects at every one of the ten stages, from an untouched Idea to a Completed delivery.",
  "Open blockers with their impact and the single required action written down.",
  "Overdue milestones carrying the delay reason recorded against them.",
  "Stage history showing who advanced what, and when.",
];

/* ------------------------------------------------------------------ page -- */

export default async function MarketingPage() {
  // A signed-in visitor has no reason to land on the explanation of a tool
  // they already use — send them to their home dashboard. This makes the page
  // dynamic (session cookies vary per request), trading the static prerender
  // for correct behaviour.
  const session = await getSession();
  if (session) redirect("/home");

  const gatedStageCount = STAGE_ORDER.filter(
    (stage) => (STAGE_GATE_TEMPLATES[stage]?.length ?? 0) > 0,
  ).length;
  const specimenStageIndex = STAGE_ORDER.indexOf("DEVELOPMENT");

  return (
    <>
      <ScrollReveal />

      {/* ---------------------------------------------------------- masthead */}
      <section
        aria-labelledby="masthead-heading"
        className="relative isolate overflow-hidden border-b border-outline-low"
      >
        <GlowField />

        <div className="mx-auto w-full max-w-page px-ds-2xl pt-[clamp(56px,9vw,120px)] pb-[clamp(56px,7vw,104px)] lg:px-ds-7xl">
          <p className="rise-in annotation flex items-center gap-ds-lg" style={step(0)}>
            <span aria-hidden="true" className="h-px w-10 bg-primary-med" />
            Anwar Group &middot; AI &amp; Digital Transformation
          </p>

          {/* Two-tone display headline. Each word is its own clipping mask so
              it unrolls from beneath the line above it. */}
          <h1
            id="masthead-heading"
            className="mt-ds-5xl max-w-[15ch] text-display-hero font-semibold"
          >
            <MaskedLine
              words={["Every", "project"]}
              offset={0}
              className="text-text-high"
            />
            {/* Explicit separator: the two lines are block-level, so without it
                the heading's accessible name runs "projectanswers" together. */}
            {" "}
            <MaskedLine
              words={["answers", "the", "same", "four", "questions."]}
              offset={2}
              className="text-text-low"
            />
          </h1>

          <div className="mt-[clamp(32px,4vw,56px)] grid grid-cols-1 gap-ds-7xl lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end lg:gap-ds-9xl">
            <p
              className="rise-in max-w-[54ch] text-pretty text-body-2 text-text-med"
              style={step(8)}
            >
              ProjectFlow is the governance record for Anwar Group&apos;s AI and
              software initiatives. It is not a task board and does not try to be
              one. It fixes the shape of a project so the answer to{" "}
              <span className="text-text-high">
                who owns this, where is it, what is next, and is it in trouble
              </span>{" "}
              always exists — for every initiative, in the same form, without
              asking anyone.
            </p>

            <div className="rise-in flex flex-col gap-ds-2xl" style={step(9)}>
              <div className="flex flex-wrap items-center gap-ds-xl">
                <ButtonPrimitive asChild size="hero-lg" variant="default">
                  <Link href="/login">Sign in to ProjectFlow</Link>
                </ButtonPrimitive>
                <ButtonPrimitive asChild size="hero-lg" variant="ghost">
                  <Link href="#guarantees">Read the model</Link>
                </ButtonPrimitive>
              </div>
              <p className="max-w-[38ch] text-pretty text-caption-2 text-text-low">
                Sign in with your Anwar Group account. Your role decides what
                you can change and which projects you can see — team leads
                and management see the whole portfolio.
              </p>
            </div>
          </div>

          {/* Showcase panel. There is no product screenshot to ship on a public
              page, so the specimen is the thing the product actually produces:
              one governed record, quoted field for field from the seed. */}
          <div
            className="rise-in relative mt-[clamp(48px,6vw,88px)] overflow-hidden rounded-3xl border border-outline-med bg-surface-1 shadow-e6"
            style={step(10)}
          >
            <span
              aria-hidden="true"
              className="glare-sweep pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-gradient-to-r from-transparent via-white/12 to-transparent"
            />

            <div className="flex flex-wrap items-center justify-between gap-ds-xl border-b border-outline-low bg-surface-2 px-ds-5xl py-ds-2xl">
              <p className="annotation">
                Portfolio <span aria-hidden="true">/</span> Project record
              </p>
              <p className="annotation">Seeded demo data</p>
            </div>

            <div className="px-ds-5xl py-[clamp(24px,3vw,40px)] lg:px-ds-9xl">
              <div className="flex flex-wrap items-center gap-ds-2xl">
                <h2 className="text-heading-1 font-semibold text-text-high">
                  Claims Intake Automation
                </h2>
                <Pill tone="error" label="Delayed" size="md" />
              </div>
              <p className="mt-ds-md text-body-1 text-text-low">
                Corporate IT &amp; Digital Transformation &middot; AI &amp;
                Digital Transformation
              </p>

              <dl className="mt-[clamp(24px,3vw,40px)] grid grid-cols-2 gap-x-ds-7xl gap-y-ds-5xl lg:grid-cols-4">
                {[
                  { label: "Owner", value: "Farzana Rahman", numeric: false },
                  {
                    label: "Current stage",
                    value: STAGE_LABELS.DEVELOPMENT,
                    numeric: false,
                  },
                  {
                    label: "Next milestone",
                    value: "Core OCR pipeline",
                    numeric: false,
                  },
                  { label: "Due", value: "2 days overdue", numeric: true },
                ].map((field) => (
                  <div
                    key={field.label}
                    className="border-t border-outline-med pt-ds-lg"
                  >
                    <dt className="annotation">{field.label}</dt>
                    <dd
                      className={`mt-ds-xs text-title-1 font-semibold text-text-high ${
                        field.numeric ? "font-data tabular-nums" : ""
                      }`}
                    >
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Stage rail: the whole pipeline as a row of ticks, with the
                  record's own position filled. */}
              <div className="mt-[clamp(28px,3.5vw,44px)]">
                <div className="flex items-end gap-ds-xs" aria-hidden="true">
                  {STAGE_ORDER.map((stage, i) => (
                    <span
                      key={stage}
                      className={`h-1.5 flex-1 rounded-pill ${
                        i < specimenStageIndex
                          ? "bg-text-low"
                          : i === specimenStageIndex
                            ? "h-3 bg-primary-med"
                            : "bg-outline-high"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-ds-lg text-caption-2 text-text-low">
                  Stage{" "}
                  <span className="font-data tabular-nums text-text-med">
                    {specimenStageIndex + 1}
                  </span>{" "}
                  of{" "}
                  <span className="font-data tabular-nums text-text-med">
                    {STAGE_ORDER.length}
                  </span>{" "}
                  &middot; {STAGE_LABELS.IDEA} to {STAGE_LABELS.COMPLETED}
                </p>
              </div>
            </div>

            <p className="border-t border-outline-low bg-surface-2 px-ds-5xl py-ds-2xl text-pretty text-caption-2 text-text-low lg:px-ds-9xl">
              Nobody set this project to Delayed. It reads Delayed because the
              Core OCR pipeline milestone passed its due date while still in
              progress — and the delay reason on record, integration dependency,
              was required before the record would let anyone move on.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- 01 */}
      <Band id="guarantees" labelledBy="guarantees-heading" tint>
        <BandHead
          ordinal="01"
          kicker="The guarantees"
          headingId="guarantees-heading"
          headingLead="Four questions"
          headingTail="every record already answers."
          lead="Anwar Group runs AI work for four operating companies plus corporate IT at once. The failure mode is never a missing task list — it is a review meeting where nobody can say who owns the next move."
        />

        <div className="mt-[clamp(40px,5vw,72px)] grid grid-cols-1 gap-ds-2xl sm:grid-cols-2 lg:grid-cols-4">
          {GUARANTEES.map((item, i) => {
            const Icon = item.icon;
            return (
              <article
                key={item.term}
                data-reveal
                style={step(i)}
                className="group flex flex-col justify-between gap-ds-5xl rounded-2xl sm:min-h-[17rem] border border-outline-low bg-surface-2 p-ds-5xl transition-colors duration-300 ease-move hover:border-outline-high hover:bg-surface-3"
              >
                <div className="flex items-start justify-between gap-ds-2xl">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-wash transition-transform duration-300 ease-move group-hover:scale-110">
                    <Icon className="text-primary-high [[data-theme=light]_&]:text-primary-onaccent" />
                  </span>
                  <span className="text-right">
                    <span className="block font-data text-metric tabular-nums text-text-high">
                      {item.figure}
                    </span>
                    <span className="mt-ds-xxs block max-w-[11ch] text-caption-1 text-text-low">
                      {item.figureLabel}
                    </span>
                  </span>
                </div>
                <div>
                  <h3 className="text-title-1 font-semibold text-text-high">
                    {item.term}
                  </h3>
                  <p className="mt-ds-md text-pretty text-para text-text-med">
                    {item.detail}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {/* Second texture in the same band: the mechanisms that make the four
            guarantees hold, as a ledger rather than more cards. */}
        <div
          data-reveal
          className="mt-ds-2xl overflow-hidden rounded-2xl border border-outline-low bg-surface-0"
        >
          <p className="annotation border-b border-outline-low bg-surface-2 px-ds-5xl py-ds-2xl">
            And what that forces
          </p>
          <ol>
            {RECORD_RULES.map((rule, i) => (
              <li
                key={rule.term}
                className="group grid grid-cols-1 gap-ds-xs border-b border-outline-low px-ds-5xl py-ds-5xl transition-colors duration-200 ease-move last:border-b-0 hover:bg-surface-1 sm:grid-cols-[2.5rem_minmax(0,22rem)_minmax(0,1fr)] sm:items-baseline sm:gap-x-ds-7xl"
              >
                <span
                  aria-hidden="true"
                  className="font-data text-caption-1 tabular-nums text-text-low transition-colors duration-200 ease-move group-hover:text-primary-high [[data-theme=light]_&]:group-hover:text-text-high"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-title-1 font-semibold text-text-high">
                  {rule.term}
                </h3>
                <p className="max-w-[58ch] text-pretty text-body-1 text-text-med sm:col-start-3">
                  {rule.detail}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Band>

      {/* ------------------------------------------------------------- 02 */}
      <Band id="pipeline" labelledBy="pipeline-heading">
        <BandHead
          ordinal="02"
          kicker="The pipeline"
          headingId="pipeline-heading"
          headingLead="Ten stages,"
          headingTail={`and the ${gatedStageCount} that are gates.`}
          lead="The stages are identical for every project, so two initiatives sitting at Development mean the same thing to everyone reading the portfolio. A gate will not open while one of its required criteria is unticked."
        />

        {/* Process rail. A continuous track runs behind the ten nodes; gated
            stages get a filled accent node and hang their real exit criteria
            beneath. Vertical on phones, horizontal from `lg`. */}
        {/* `items-start` lets each node hug its own content, so a gate is
            visibly the heavier stop on the rail instead of every card being
            padded out to the tallest one. */}
        <ol className="mt-[clamp(40px,5vw,72px)] grid grid-cols-1 items-start gap-ds-2xl md:grid-cols-2 lg:grid-cols-5">
          {STAGE_ORDER.map((stage, i) => {
            const criteria = STAGE_GATE_TEMPLATES[stage] ?? [];
            const isGate = criteria.length > 0;
            return (
              <li
                key={stage}
                data-reveal
                style={step(i % 5)}
                className={`group relative flex flex-col gap-ds-xl rounded-2xl border p-ds-5xl transition-colors duration-300 ease-move ${
                  isGate
                    ? "border-outline-high bg-surface-2 hover:bg-surface-3"
                    : "border-outline-low bg-surface-0 hover:bg-surface-1"
                }`}
              >
                {/* Node + track. The track is drawn to the right of the node
                    and hidden on the last item of each row. */}
                <div className="flex items-center gap-ds-md">
                  <span
                    aria-hidden="true"
                    /* The lime fill is invisible on a white surface, so the
                       light theme swaps the node and the criteria bullets to
                       `primary-onaccent`, the olive that pairs with it. */
                    className={`size-2.5 shrink-0 rounded-full ${
                      isGate
                        ? "bg-primary-med ring-4 ring-primary-wash [[data-theme=light]_&]:bg-primary-onaccent"
                        : "bg-outline-high [[data-theme=light]_&]:bg-text-low"
                    }`}
                  />
                  <span
                    aria-hidden="true"
                    className="h-px flex-1 bg-outline-low"
                  />
                  <span className="font-data text-caption-1 tabular-nums text-text-low">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-ds-lg">
                  <h3 className="text-title-1 font-semibold text-text-high">
                    {STAGE_LABELS[stage]}
                  </h3>
                  {isGate && (
                    /* Accent as a *fill* with `primary-onaccent` ink — the one
                       accent recipe that clears contrast in both themes. */
                    <span className="rounded-pill bg-primary-med px-ds-md py-[1px] text-caption-1 font-semibold tracking-[0.08em] text-primary-onaccent uppercase">
                      Gate
                    </span>
                  )}
                </div>

                {isGate ? (
                  <ul className="flex flex-col gap-ds-md">
                    {criteria.map((item) => (
                      <li
                        key={item.label}
                        className="flex items-start gap-ds-md text-para text-text-med"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[7px] size-1 shrink-0 rounded-full bg-primary-med [[data-theme=light]_&]:bg-primary-onaccent"
                        />
                        {item.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-para text-text-low">
                    No fixed exit criteria
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        <p
          data-reveal
          className="mt-ds-5xl max-w-[70ch] text-pretty text-body-1 text-text-low"
        >
          The other six transition on the owner&apos;s call, recorded with their
          name and the time. Inventing a checklist for them would only teach
          people to tick boxes.
        </p>
      </Band>

      {/* ------------------------------------------------------------- 03 */}
      <Band id="health" labelledBy="health-heading" tint>
        <BandHead
          ordinal="03"
          kicker="Health"
          headingId="health-heading"
          headingLead="Status is derived,"
          headingTail="never declared."
          lead="A self-reported green light is worth nothing, so ProjectFlow does not offer one. Health is recomputed on every write from two things the team already records."
        />

        <div className="mt-[clamp(40px,5vw,72px)] grid grid-cols-1 gap-[clamp(24px,3vw,40px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-ds-9xl">
          {/* Decision cascade: four rungs, each stepped further in than the
              last and lit by its own status colour, so the precedence order is
              visible before a word of it is read. */}
          <ol className="flex flex-col gap-ds-xl">
            {HEALTH_RULES.map((rule, i) => (
              <li
                key={rule.label}
                data-reveal
                /* The staircase indent is a `lg:` affordance only — applying
                   it on a 390px screen pushed the cascade past the viewport
                   and gave the whole page a horizontal scrollbar. */
                style={{ ...step(i), "--indent": `${i * 1.5}rem` } as CSSProperties}
                className={`relative rounded-2xl border-l-2 ${rule.edge} border-y border-r border-y-outline-low border-r-outline-low bg-surface-0 px-ds-5xl py-ds-5xl transition-colors duration-300 ease-move hover:bg-surface-2 lg:ms-[var(--indent)]`}
              >
                <div className="flex flex-wrap items-center gap-ds-2xl">
                  <span className="font-data text-caption-1 tabular-nums text-text-low">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Pill tone={rule.tone} label={rule.label} size="md" />
                </div>
                <p className="mt-ds-2xl text-body-2 text-text-high">
                  <span className="font-data text-body-1 text-text-low">
                    if{" "}
                  </span>
                  {rule.condition}
                </p>
                <p className="mt-ds-xs max-w-[54ch] text-pretty text-para text-text-med">
                  {rule.rationale}
                </p>
              </li>
            ))}
            <li
              data-reveal
              className="text-pretty text-caption-2 text-text-low lg:ms-24"
            >
              Evaluated top to bottom. The first rule that matches is the answer.
            </li>
          </ol>

          {/* Worked example, from a project the seed actually creates. Given
              its own quiet status glow so it reads as evidence, not another
              content card. */}
          <div
            data-reveal
            className="relative h-fit lg:sticky lg:top-ds-9xl"
          >
            <span
              aria-hidden="true"
              /* `inset-0`, not a negative inset: the blur already spreads the
                 light past the box, and a negative inset widened the document
                 enough to give a 390px viewport a horizontal scrollbar. */
              className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[rgba(240,251,103,0.07)] blur-[70px] [[data-theme=light]_&]:hidden"
            />
            <div className="overflow-hidden rounded-3xl border border-outline-med bg-surface-0 shadow-e6">
              <p className="annotation border-b border-outline-low bg-surface-2 px-ds-5xl py-ds-2xl">
                Worked example &middot; seeded data
              </p>
              <div className="px-ds-5xl py-ds-5xl">
                <h3 className="text-title-1 font-semibold text-text-high">
                  Steel Quality Defect Classifier
                </h3>
                <dl className="mt-ds-5xl flex flex-col gap-ds-2xl">
                  <div className="border-t border-outline-low pt-ds-lg">
                    <dt className="annotation">Open blockers</dt>
                    <dd className="mt-ds-xxs text-body-1 text-text-high">
                      <span className="font-data tabular-nums">1</span> — QA lab
                      has not granted access to the ultrasonic scan archive.
                    </dd>
                  </div>
                  <div className="border-t border-outline-low pt-ds-lg">
                    <dt className="annotation">Overdue milestone</dt>
                    <dd className="mt-ds-xxs text-body-1 text-text-high">
                      Labeled dataset ready, in progress,{" "}
                      <span className="font-data tabular-nums">5</span> days past
                      due.
                    </dd>
                  </div>
                  <div className="border-t border-outline-low pt-ds-lg">
                    <dt className="annotation">Computed health</dt>
                    <dd className="mt-ds-md">
                      <Pill tone="neutral" label="Blocked" size="md" />
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="border-t border-outline-low bg-surface-2 px-ds-5xl py-ds-2xl text-pretty text-caption-2 text-text-low">
                Rules 01 and 02 both match, so 01 wins. The project reads Blocked
                rather than Delayed because the required action sits outside the
                delivery team — the more useful thing for a reviewer to see
                first.
              </p>
            </div>
          </div>
        </div>
      </Band>

      {/* ------------------------------------------------------------- 04 */}
      <Band id="authority" labelledBy="authority-heading">
        <BandHead
          ordinal="04"
          kicker="Authority"
          headingId="authority-heading"
          headingLead="Five roles,"
          headingTail="separated by what they change."
          lead="Permissions are enforced on the server, not by hiding buttons. The matrix below is the same table the application checks on every write."
        />

        {/* Role plates: the cast, before the matrix that separates them. */}
        <ul className="mt-[clamp(40px,5vw,72px)] grid grid-cols-1 gap-ds-2xl sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((role, i) => (
            <li
              key={role.role}
              data-reveal
              style={step(i)}
              className="flex items-center gap-ds-2xl rounded-2xl border border-outline-low bg-surface-1 px-ds-5xl py-ds-2xl"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-wash font-data text-caption-2 font-semibold text-primary-high [[data-theme=light]_&]:text-primary-onaccent"
              >
                {role.short}
              </span>
              <span className="min-w-0">
                {/* Not truncated: a five-column plate is narrow enough to clip
                    "Anwar Chowdhury", and a person's name is the one thing on
                    this page that must not be abbreviated to fit. */}
                <span className="block text-pretty text-body-1 font-semibold text-text-high">
                  {role.label}
                </span>
                <span className="block text-pretty text-caption-2 text-text-low">
                  {role.person}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div
          data-reveal
          className="mt-ds-2xl overflow-hidden rounded-3xl border border-outline-med bg-surface-0 shadow-e2"
        >
          <div className="flex flex-wrap items-center justify-between gap-ds-xl border-b border-outline-low bg-surface-2 px-ds-5xl py-ds-2xl">
            <p className="annotation">Permission matrix</p>
            <p className="annotation flex items-center gap-ds-md">
              <AuthorityIcon
                className="size-4 text-text-low"
                size={16}
                aria-hidden="true"
              />
              lib/project-permissions.ts
            </p>
          </div>

          {/* A floor width so the five role columns scroll on a phone rather
              than collapsing into unreadable ribbons of wrapped text. */}
          <Table className="min-w-[46rem]">
            <caption className="sr-only">
              What each ProjectFlow role can change. A tick means the role holds
              that permission.
            </caption>
            <TableHeader>
              <TableRow>
                {/* Narrow enough that a role column always peeks past the right
                    edge on a phone, which is the only honest hint that the
                    matrix scrolls sideways. */}
                <TableHead scope="col" className="w-[14rem] px-ds-5xl">
                  Capability
                </TableHead>
                {ROLES.map((role) => (
                  <TableHead
                    key={role.role}
                    scope="col"
                    className={`text-center ${
                      role.role === "MANAGEMENT" ? "bg-surface-1" : ""
                    }`}
                  >
                    {role.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {CAPABILITIES.map((capability) => {
                const holders = PROJECT_PERMISSIONS[
                  capability.permission
                ] as readonly Role[];
                return (
                  <TableRow key={capability.permission}>
                    <TableCell className="px-ds-5xl whitespace-normal font-medium text-text-high">
                      {capability.label}
                    </TableCell>
                    {ROLES.map((role) => {
                      const allowed = holders.includes(role.role);
                      return (
                        <TableCell
                          key={role.role}
                          className={`text-center ${
                            role.role === "MANAGEMENT" ? "bg-surface-1" : ""
                          }`}
                        >
                          {allowed ? (
                            <span className="mx-auto flex size-6 items-center justify-center rounded-pill bg-primary-wash">
                              <CheckIcon
                                className="size-3.5 text-primary-high [[data-theme=light]_&]:text-primary-onaccent"
                                size={14}
                              />
                            </span>
                          ) : (
                            <span aria-hidden="true" className="text-text-low">
                              &mdash;
                            </span>
                          )}
                          <span className="sr-only">
                            {allowed ? "Yes" : "No"}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <p
          data-reveal
          className="mt-ds-5xl max-w-[76ch] text-pretty text-body-1 text-text-low"
        >
          <span className="text-text-high">
            Management is the column worth reading twice.
          </span>{" "}
          It can read everything and change nothing, so the portfolio stays
          the delivery team&apos;s own account of itself. Visibility follows
          the same shape: an analyst or developer sees the projects they are
          on, a business owner sees the ones their department requested, and
          the AI Team Lead and Management see everything.
        </p>
      </Band>

      {/* ------------------------------------------------------------- 05 */}
      <Band id="portfolio" labelledBy="portfolio-heading" tint>
        <BandHead
          ordinal="05"
          kicker="Demo portfolio"
          headingId="portfolio-heading"
          headingLead="A whole conglomerate,"
          headingTail="not a sample of one."
          lead="Seeding a governance tool with three tidy projects proves nothing. The demo database spans four operating companies plus corporate IT, with work spread across all ten stages."
        />

        {/* Board of operating companies. Each plate carries a ghosted index
            numeral that lights on hover, and its real departments as chips. */}
        <ul className="mt-[clamp(40px,5vw,72px)] grid grid-cols-1 gap-ds-2xl sm:grid-cols-2 lg:grid-cols-5">
          {BUSINESS_UNITS.map((unit, i) => (
            <li
              key={unit.name}
              data-reveal
              style={step(i)}
              className="group relative flex flex-col gap-ds-5xl overflow-hidden rounded-2xl border border-outline-low bg-surface-0 p-ds-5xl transition-colors duration-300 ease-move hover:border-outline-high hover:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className="font-data text-metric tabular-nums text-outline-high transition-colors duration-300 ease-move group-hover:text-primary-high [[data-theme=light]_&]:group-hover:text-text-med"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-pretty text-title-1 font-semibold text-text-high">
                {unit.name}
              </h3>
              <ul className="mt-auto flex flex-wrap gap-ds-md">
                {unit.departments.map((dept) => (
                  <li
                    key={dept}
                    className="rounded-pill border border-outline-low bg-surface-2 px-ds-xl py-ds-xs text-caption-2 text-text-med"
                  >
                    {dept}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        {/* What the board actually contains, as a strip rather than a sixth
            plate — the same information at a different rhythm. */}
        <div
          data-reveal
          className="mt-ds-2xl overflow-hidden rounded-2xl border border-outline-med bg-surface-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-ds-xl border-b border-outline-low px-ds-5xl py-ds-2xl">
            <p className="annotation">What you will find inside</p>
            <p className="annotation">prisma/seed.ts</p>
          </div>
          <ul className="grid grid-cols-1 gap-px bg-outline-low sm:grid-cols-2 lg:grid-cols-4">
            {PORTFOLIO_CONTENTS.map((line, i) => (
              <li
                key={line}
                data-reveal
                style={step(i)}
                className="flex items-start gap-ds-lg bg-surface-2 px-ds-5xl py-ds-5xl text-pretty text-para text-text-med"
              >
                <CheckIcon
                  className="mt-[3px] size-4 shrink-0 text-primary-high [[data-theme=light]_&]:text-text-high"
                  size={16}
                />
                {line}
              </li>
            ))}
          </ul>
          <p className="border-t border-outline-low px-ds-5xl py-ds-2xl text-pretty text-caption-2 text-text-low">
            Health on every one of those projects is computed by the rules in
            section 03. None of it was typed in.
          </p>
        </div>
      </Band>

      {/* --------------------------------------------------------- closing */}
      <section aria-labelledby="access-heading" className="relative isolate">
        <div className="mx-auto w-full max-w-page px-ds-2xl py-[clamp(56px,7vw,104px)] lg:px-ds-7xl">
          <div
            data-reveal
            className="relative isolate overflow-hidden rounded-3xl border border-outline-med bg-surface-1 px-ds-5xl py-[clamp(40px,5vw,72px)] shadow-e6 lg:px-ds-9xl"
          >
            {/* Accent light, cropped by the panel, so the page closes on the
                same pigment it opened with. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-[-40%] right-[-10%] -z-10 size-[560px] rounded-full bg-[rgba(240,251,103,0.13)] blur-[130px] [[data-theme=light]_&]:opacity-40"
            />
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-med via-outline-high to-transparent"
            />

            <div className="grid grid-cols-1 gap-ds-9xl lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <p className="annotation">Access</p>
                <h2
                  id="access-heading"
                  className="mt-ds-2xl max-w-[16ch] text-balance text-display-2 font-semibold"
                >
                  <span className="text-text-high">Sign in with your </span>
                  <span className="text-text-low">Anwar Group account.</span>
                </h2>
                <p className="mt-ds-5xl max-w-[54ch] text-pretty text-body-2 text-text-med">
                  If you are on the AI team your account already exists, and your
                  role decides what you can change. If you are reviewing the
                  portfolio for leadership, ask the AI Team Lead for a Management
                  account — it opens the dashboard in read-only form.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-ds-xl lg:justify-end">
                <ButtonPrimitive asChild size="hero-lg" variant="default">
                  <Link href="/login">Sign in to ProjectFlow</Link>
                </ButtonPrimitive>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
