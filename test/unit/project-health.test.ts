import { describe, expect, it } from "vitest";
import {
  AT_RISK_WINDOW_DAYS,
  isMilestoneAtRisk,
  isMilestoneOverdue,
} from "@/lib/project-health";

const DAY_MS = 24 * 60 * 60 * 1000;
function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

describe("isMilestoneOverdue", () => {
  it("is true when the due date has passed and status is not DONE", () => {
    expect(isMilestoneOverdue({ dueDate: daysFromNow(-1), status: "PENDING" })).toBe(true);
    expect(isMilestoneOverdue({ dueDate: daysFromNow(-1), status: "IN_PROGRESS" })).toBe(true);
  });

  it("is false once the due date has passed if status is DONE — completed work is never overdue", () => {
    expect(isMilestoneOverdue({ dueDate: daysFromNow(-1), status: "DONE" })).toBe(false);
  });

  it("is false when the due date is in the future", () => {
    expect(isMilestoneOverdue({ dueDate: daysFromNow(1), status: "PENDING" })).toBe(false);
  });
});

describe("isMilestoneAtRisk", () => {
  it("is true when due within the at-risk window and not yet due", () => {
    expect(isMilestoneAtRisk({ dueDate: daysFromNow(1), status: "PENDING" })).toBe(true);
    expect(
      isMilestoneAtRisk({ dueDate: daysFromNow(AT_RISK_WINDOW_DAYS), status: "IN_PROGRESS" }),
    ).toBe(true);
  });

  it("is false once overdue — that's DELAYED territory, not AT_RISK (mutually exclusive by design)", () => {
    expect(isMilestoneAtRisk({ dueDate: daysFromNow(-1), status: "PENDING" })).toBe(false);
  });

  it("is false when due date is further out than the at-risk window", () => {
    expect(isMilestoneAtRisk({ dueDate: daysFromNow(AT_RISK_WINDOW_DAYS + 1), status: "PENDING" })).toBe(
      false,
    );
  });

  it("is false for a DONE milestone regardless of due date", () => {
    expect(isMilestoneAtRisk({ dueDate: daysFromNow(1), status: "DONE" })).toBe(false);
  });
});
