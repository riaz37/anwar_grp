import type {
  EvaluationFormRef,
  OrgUnitRef,
  PersonRef,
  UserRole,
  Viewer,
} from "@/lib/types/domain";

/**
 * TEMPORARY reference data (business units, departments, people).
 *
 * Same convention as `_mock-tasks.ts` — see that file's header. Phase 2's
 * pages need dropdown options and denormalised names that only exist once the
 * backend's Requisition/Candidate routes land.
 *
 * SWAP POINT — replace all four exports with real fetches:
 *   getBusinessUnits()   -> GET /api/v1/business-units
 *   getDepartments()     -> GET /api/v1/departments?businessUnitId=
 *   getRecruiters()      -> GET /api/v1/users?role=RECRUITER
 *   getHiringManagers()  -> GET /api/v1/users?role=HIRING_MANAGER
 *   getCurrentUser()     -> already available server-side via `getSession()`;
 *                           the pages pass it down so client components never
 *                           import `lib/session` (it is `server-only`).
 *
 * `BusinessUnit`, `Department` and `User` already exist in
 * `prisma/schema.prisma` from Phase 1, so these four are the cheapest to make
 * real — they need routes, not schema.
 */

export const MOCK_BUSINESS_UNITS: readonly OrgUnitRef[] = [
  { id: "bu_corp", name: "Anwar Group Corporate" },
  { id: "bu_textiles", name: "Anwar Textiles" },
  { id: "bu_cement", name: "Anwar Cement" },
  { id: "bu_landmark", name: "Anwar Landmark" },
];

/** Departments, each pinned to its business unit. */
export const MOCK_DEPARTMENTS: readonly (OrgUnitRef & {
  businessUnitId: string;
})[] = [
  { id: "dep_ta", name: "Talent Acquisition", businessUnitId: "bu_corp" },
  { id: "dep_finance", name: "Finance", businessUnitId: "bu_corp" },
  { id: "dep_it", name: "Information Technology", businessUnitId: "bu_corp" },
  { id: "dep_hr", name: "Human Resources", businessUnitId: "bu_corp" },
  { id: "dep_merch", name: "Merchandising", businessUnitId: "bu_textiles" },
  { id: "dep_prod", name: "Production", businessUnitId: "bu_textiles" },
  { id: "dep_quality", name: "Quality Control", businessUnitId: "bu_textiles" },
  { id: "dep_design", name: "Design Studio", businessUnitId: "bu_textiles" },
  { id: "dep_logistics", name: "Logistics", businessUnitId: "bu_cement" },
  { id: "dep_plant", name: "Plant Operations", businessUnitId: "bu_cement" },
  { id: "dep_sales", name: "Sales", businessUnitId: "bu_landmark" },
];

export const MOCK_RECRUITERS: readonly PersonRef[] = [
  { id: "usr_recruiter_1", name: "Sadia Karim" },
  { id: "usr_recruiter_2", name: "Mahmudul Haque" },
  { id: "usr_recruiter_3", name: "Tanjina Akter" },
  { id: "usr_recruiter_4", name: "Rezaul Karim" },
];

export const MOCK_HIRING_MANAGERS: readonly PersonRef[] = [
  { id: "usr_hm_1", name: "Kamrul Hasan" },
  { id: "usr_hm_2", name: "Shirin Sultana" },
  { id: "usr_hm_3", name: "Abdullah Al Mamun" },
  { id: "usr_hm_4", name: "Nusrat Jahan" },
  { id: "usr_hm_5", name: "Zahid Iqbal" },
];

/**
 * People who hold an approval-chain role but never sit on an interview panel
 * (Phase 5). An approval chain is a list of *roles*
 * (BUILD_PLAN.md Sec 2.9), and two of those roles — HR leadership and the TA
 * administrator — belong to nobody in the lists above, so a chain naming them
 * would have resolved to no one.
 *
 * SWAP POINT — GET /api/v1/users?role=HR_LEADERSHIP,TA_ADMIN. With the real
 * API the chain's approvers are resolved server-side from the role, and this
 * list disappears with the rest of the mock reference data.
 */
export const MOCK_APPROVERS: readonly PersonRef[] = [
  { id: "usr_hrl_1", name: "Rowshan Ara" },
  { id: "usr_ta_admin_1", name: "Iftekhar Alam" },
];

/**
 * People outside Talent Acquisition who own joining-checklist items (Phase 6).
 *
 * The spec's own checklist hands work to functions TA does not run — "IT
 * request", "Workspace", "ID card", "Transport" belong to IT and Administration,
 * "Offer letter" and "Induction" to HR — so a checklist whose owner picker only
 * offered recruiters and hiring managers would force every item onto the
 * recruiter and quietly defeat the point of having an owner column at all.
 *
 * SWAP POINT — GET /api/v1/users (the owner picker is "anyone in the company",
 * not a role-filtered list; joining coordination reaches outside recruiting by
 * design). Disappears with the rest of the mock reference data.
 */
export const MOCK_COORDINATORS: readonly (PersonRef & { role: string })[] = [
  { id: "usr_it_1", name: "Rakibul Islam", role: "Information Technology" },
  { id: "usr_it_2", name: "Sumaiya Noor", role: "Information Technology" },
  { id: "usr_admin_1", name: "Golam Kibria", role: "Administration" },
  { id: "usr_admin_2", name: "Parvin Akhtar", role: "Administration" },
  { id: "usr_hr_1", name: "Shamima Nasrin", role: "Human Resources" },
  { id: "usr_hr_2", name: "Mizanur Rahman", role: "Human Resources" },
];

/**
 * People who can sit on an interview panel (spec Sec 6 > Interview Scheduling,
 * "Interview-panel assignment"; spec Sec 3 lists "Interview panel members" as
 * a primary user in their own right).
 *
 * Deliberately a superset of hiring managers rather than a copy of it: a panel
 * is usually one hiring manager plus one or two subject-matter colleagues who
 * are not managers of anything, and modelling it as "hiring managers only"
 * would make half of Anwar Group's real panels unrepresentable.
 *
 * `role` is carried for display only — the picker groups by it so a recruiter
 * assembling a panel can see they have not booked three people from the same
 * function.
 *
 * SWAP POINT — GET /api/v1/users?role=HIRING_MANAGER,PANEL_MEMBER
 * RECONCILIATION NOTE — Prisma's `Role` enum (Phase 1) has no PANEL_MEMBER
 * value at the time of writing. Either add one, or treat "panelist" as a
 * per-interview relationship rather than a role, in which case this list is
 * simply "all internal users" and the `role` label below comes from the
 * user's department.
 */
export const MOCK_PANEL_MEMBERS: readonly (PersonRef & { role: string })[] = [
  { id: "usr_hm_1", name: "Kamrul Hasan", role: "Hiring manager" },
  { id: "usr_hm_2", name: "Shirin Sultana", role: "Hiring manager" },
  { id: "usr_hm_3", name: "Abdullah Al Mamun", role: "Hiring manager" },
  { id: "usr_hm_4", name: "Nusrat Jahan", role: "Hiring manager" },
  { id: "usr_hm_5", name: "Zahid Iqbal", role: "Hiring manager" },
  { id: "usr_panel_1", name: "Farzana Haque", role: "Department head" },
  { id: "usr_panel_2", name: "Sabbir Rahman", role: "Department head" },
  { id: "usr_panel_3", name: "Tuhin Chowdhury", role: "Subject specialist" },
  { id: "usr_panel_4", name: "Marufa Begum", role: "Subject specialist" },
  { id: "usr_panel_5", name: "Ashiqur Rahman", role: "Subject specialist" },
  { id: "usr_recruiter_1", name: "Sadia Karim", role: "Recruiter" },
  { id: "usr_recruiter_2", name: "Mahmudul Haque", role: "Recruiter" },
];

/**
 * Evaluation forms are Phase 4 (BUILD_PLAN.md Sec 3.1 item 4). Scheduling has
 * to name one now — spec Sec 6 lists "Evaluation-form assignment" under
 * Interview Scheduling, not under Evaluation — so these are forward-declared
 * placeholders. Assigning one records an intent; it does not create, open or
 * validate anything, and the scheduling form says so on screen.
 *
 * The criteria in each description are spec Sec 6 > Interview Evaluation's own
 * list ("relevant experience, technical or functional capability,
 * communication, problem-solving, leadership, organizational suitability"),
 * split across role types the way that section's "configurable for different
 * role types" sentence implies.
 *
 * SWAP POINT — GET /api/v1/evaluation-forms?positionLevel= (Phase 4).
 */
export const MOCK_EVALUATION_FORMS: readonly EvaluationFormRef[] = [
  {
    id: "evf_standard",
    name: "Standard technical round",
    description:
      "Relevant experience · technical capability · problem-solving · communication",
  },
  {
    id: "evf_functional",
    name: "Functional / commercial round",
    description:
      "Relevant experience · functional capability · communication · organisational suitability",
  },
  {
    id: "evf_leadership",
    name: "Leadership round",
    description:
      "Leadership · organisational suitability · strengths and concerns · overall recommendation",
  },
  {
    id: "evf_entry",
    name: "Entry-level screening round",
    description: "Communication · problem-solving · organisational suitability",
  },
];

/**
 * Each mock person's *system* role (`prisma.Role`), as distinct from the
 * display string on `MOCK_PANEL_MEMBERS` above ("Subject specialist" is a
 * label a recruiter reads; `PANEL_MEMBER` is what authorization keys off).
 *
 * Phase 4 needs the real thing: the blind-until-submit rule applies to
 * `PANEL_MEMBER` and to nobody else (`lib/evaluation-visibility.ts`), so a
 * display label cannot stand in for it.
 *
 * SWAP POINT — the role arrives on each user from
 * `GET /api/v1/users`, and for the signed-in user from `getSession()`.
 */
export const MOCK_SYSTEM_ROLES: Record<string, UserRole> = {
  usr_hm_1: "HIRING_MANAGER",
  usr_hm_2: "HIRING_MANAGER",
  usr_hm_3: "HIRING_MANAGER",
  usr_hm_4: "HIRING_MANAGER",
  usr_hm_5: "HIRING_MANAGER",
  usr_panel_1: "DEPT_HEAD",
  usr_panel_2: "DEPT_HEAD",
  usr_panel_3: "PANEL_MEMBER",
  usr_panel_4: "PANEL_MEMBER",
  usr_panel_5: "PANEL_MEMBER",
  usr_recruiter_1: "RECRUITER",
  usr_recruiter_2: "RECRUITER",
  usr_recruiter_3: "RECRUITER",
  usr_recruiter_4: "RECRUITER",
  usr_hrl_1: "HR_LEADERSHIP",
  usr_ta_admin_1: "TA_ADMIN",
};

export function systemRoleOf(userId: string): UserRole {
  return MOCK_SYSTEM_ROLES[userId] ?? "PANEL_MEMBER";
}

/**
 * Stand-in for the signed-in user. Real value comes from `getSession()` in a
 * server component — used here only so mock rows can render "You" as an
 * action owner consistently with `_mock-tasks.ts`.
 *
 * Carries `role` from Phase 4 onward: the evaluation surface is
 * role-conditional (own-evaluation form vs. consolidated results), and a
 * `PersonRef` cannot answer "may this viewer see the panel's feedback".
 */
export const MOCK_CURRENT_USER: Viewer = {
  id: "usr_recruiter_1",
  name: "Sadia Karim",
  role: "RECRUITER",
};

/**
 * Contact details for the signed-in recruiter, needed by the message-template
 * renderer (`recruiter.name` / `recruiter.email` / `recruiter.mobile` are on
 * the allowlist). Real values come from the session's user record.
 */
export const MOCK_CURRENT_USER_CONTACT = {
  email: "sadia.karim@anwargroup.test",
  mobile: "+8801711 000 100",
};

/** Legal entity name used by `company.name` in message templates. */
export const MOCK_COMPANY_NAME = "Anwar Group of Industries";

export function departmentsFor(businessUnitId: string): OrgUnitRef[] {
  return MOCK_DEPARTMENTS.filter(
    (department) => department.businessUnitId === businessUnitId,
  ).map(({ id, name }) => ({ id, name }));
}

export function orgUnitById(id: string): OrgUnitRef {
  const match =
    MOCK_BUSINESS_UNITS.find((unit) => unit.id === id) ??
    MOCK_DEPARTMENTS.find((department) => department.id === id);
  return match ? { id: match.id, name: match.name } : { id, name: "—" };
}

export function personById(id: string): PersonRef {
  const match =
    MOCK_RECRUITERS.find((person) => person.id === id) ??
    MOCK_HIRING_MANAGERS.find((person) => person.id === id) ??
    MOCK_PANEL_MEMBERS.find((person) => person.id === id) ??
    MOCK_APPROVERS.find((person) => person.id === id) ??
    MOCK_COORDINATORS.find((person) => person.id === id);
  return match ? { id: match.id, name: match.name } : { id, name: "—" };
}
