import type { OrgUnitRef, PersonRef } from "@/lib/types/domain";

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
 * Stand-in for the signed-in user. Real value comes from `getSession()` in a
 * server component — used here only so mock rows can render "You" as an
 * action owner consistently with `_mock-tasks.ts`.
 */
export const MOCK_CURRENT_USER: PersonRef = {
  id: "usr_recruiter_1",
  name: "Sadia Karim",
};

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
    MOCK_HIRING_MANAGERS.find((person) => person.id === id);
  return match ?? { id, name: "—" };
}
