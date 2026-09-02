import type { Task } from "@/components/tasks/types";

/**
 * TEMPORARY mock data for the Home ("My Tasks") view.
 *
 * Swap for the real fetch in one line inside `app/(dashboard)/page.tsx`:
 *   const tasks = getMockTasks();
 *     ->
 *   const tasks = await fetchMyTasks();   // GET /api/v1/tasks?assignee=me
 *
 * The returned shape is already the API-facing `Task` contract, so nothing
 * downstream changes. Due dates are generated relative to the current day so
 * the overdue / due-today groupings stay realistic in a demo.
 */
function daysFromNow(offset: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function getMockTasks(): Task[] {
  return [
    {
      id: "app_8814",
      candidateId: "cand_2201",
      candidateName: "Farhana Rahman",
      requisitionRef: "REQ-2026-114",
      requisitionTitle: "Senior Merchandiser",
      stage: "Panel feedback",
      nextAction: "Chase evaluation from Nusrat Jahan (Panel 2)",
      owner: "You",
      dueDate: daysFromNow(-4),
    },
    {
      id: "app_8790",
      candidateId: "cand_2177",
      candidateName: "Md. Tanvir Hasan",
      requisitionRef: "REQ-2026-098",
      requisitionTitle: "Production Planning Officer",
      stage: "Approval",
      nextAction: "Submit selection approval to Head of Operations",
      owner: "You",
      dueDate: daysFromNow(-2),
    },
    {
      id: "app_8832",
      candidateId: "cand_2233",
      candidateName: "Ayesha Siddika",
      requisitionRef: "REQ-2026-120",
      requisitionTitle: "Accounts Executive",
      stage: "Screening",
      nextAction: "Record eligibility assessment",
      owner: "You",
      dueDate: daysFromNow(-1),
    },
    {
      id: "app_8845",
      candidateId: "cand_2240",
      candidateName: "Rifat Chowdhury",
      requisitionRef: "REQ-2026-121",
      requisitionTitle: "IT Support Engineer",
      stage: "Interview 1",
      nextAction: "Confirm panel availability for Thursday slot",
      owner: "You",
      dueDate: daysFromNow(0),
    },
    {
      id: "app_8851",
      candidateId: "cand_2248",
      candidateName: "Sabina Yeasmin",
      requisitionRef: "REQ-2026-117",
      requisitionTitle: "HR Officer — Payroll",
      stage: "Offer",
      nextAction: "Send offer message for approval",
      owner: "You",
      dueDate: daysFromNow(0),
    },
    {
      id: "app_8802",
      candidateId: "cand_2190",
      candidateName: "Imran Kabir",
      requisitionRef: "REQ-2026-105",
      requisitionTitle: "Quality Control Inspector",
      stage: "Joining",
      nextAction: "Collect NID copy and academic certificates",
      owner: "You",
      dueDate: daysFromNow(0),
    },
    {
      id: "app_8860",
      candidateId: "cand_2255",
      candidateName: "Nazia Islam",
      requisitionRef: "REQ-2026-123",
      requisitionTitle: "Textile Design Assistant",
      stage: "Screening",
      nextAction: "Review CV against requisition criteria",
      owner: "You",
      dueDate: daysFromNow(2),
    },
    {
      id: "app_8866",
      candidateId: "cand_2261",
      candidateName: "Shahriar Alam",
      requisitionRef: "REQ-2026-124",
      requisitionTitle: "Logistics Coordinator",
      stage: "Interview 2",
      nextAction: "Share consolidated interview results with Dept. Head",
      owner: "You",
      dueDate: daysFromNow(3),
    },
  ];
}
