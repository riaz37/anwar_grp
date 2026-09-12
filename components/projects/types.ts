import type {
  DelayReasonCategory,
  DependencyItemType,
  MilestoneStatus,
  ProjectHealth,
  ProjectStage,
  Role,
  TaskStatus,
} from "@prisma/client";

export interface RefUser {
  id: string;
  name: string;
  role: Role;
}

export interface ProjectDetail {
  id: string;
  name: string;
  businessProblem: string;
  expectedOutcome: string;
  currentStage: ProjectStage;
  health: ProjectHealth;
  expectedDeliveryDate: string;
  version: number;
  owner: RefUser;
  analyst: RefUser | null;
  developer: RefUser | null;
  businessUnit: { id: string; name: string };
  department: { id: string; name: string };
}

export interface ChecklistItemView {
  id: string;
  label: string;
  required: boolean;
  checked: boolean;
}

export interface StageHistoryView {
  id: string;
  fromStage: ProjectStage | null;
  toStage: ProjectStage;
  actorName: string;
  changedAt: string;
  notes: string | null;
}

export interface MilestoneView {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  dueDate: string;
  status: MilestoneStatus;
  overdue: boolean;
  atRisk: boolean;
}

export interface TaskView {
  id: string;
  action: string;
  ownerId: string;
  ownerName: string;
  deadline: string | null;
  status: TaskStatus;
  progressPercent: number;
  relatedMilestoneId: string | null;
}

export interface ItemDependencyView {
  id: string;
  dependentType: DependencyItemType;
  dependentId: string;
  dependsOnType: DependencyItemType;
  dependsOnId: string;
}

export interface BlockerView {
  id: string;
  description: string;
  impact: string;
  requiredAction: string | null;
  responsiblePersonId: string;
  responsiblePersonName: string;
  dateIdentified: string;
  raisedByName: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolutionNotes: string | null;
}

export interface ScopeChangeView {
  id: string;
  reason: string;
  deliveryImpact: string | null;
  requestedByName: string;
  previousExpectedDeliveryDate: string | null;
  newExpectedDeliveryDate: string | null;
  createdAt: string;
}

export interface DelayReasonView {
  id: string;
  category: DelayReasonCategory;
  note: string | null;
  milestoneId: string | null;
  recordedByName: string;
  createdAt: string;
}

export interface DocumentView {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}
